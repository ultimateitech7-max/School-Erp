import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuardianRelationship,
  Prisma,
  RoleType,
  StudentStatus,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { HolidaysService } from '../holidays/holidays.service';
import { NoticesService } from '../notices/notices.service';
import { StudentsService } from '../students/students.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';
import { ParentQueryDto } from './dto/parent-query.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const GLOBAL_SCOPE_KEY = 'GLOBAL';

const parentInclude = Prisma.validator<Prisma.ParentInclude>()({
  user: {
    select: {
      id: true,
      email: true,
      isActive: true,
    },
  },
  parentStudents: {
    include: {
      student: {
        include: {
          admissions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            include: {
              academicClass: {
                select: {
                  id: true,
                  className: true,
                },
              },
              section: {
                select: {
                  id: true,
                  sectionName: true,
                },
              },
              academicSession: {
                select: {
                  id: true,
                  sessionName: true,
                  isCurrent: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

type ParentRecord = Prisma.ParentGetPayload<{
  include: typeof parentInclude;
}>;

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly studentsService: StudentsService,
    private readonly noticesService: NoticesService,
    private readonly holidaysService: HolidaysService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateParentDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const normalizedEmail = dto.email?.trim().toLowerCase() ?? null;
    const fullName = dto.fullName.trim();
    const phone = dto.phone.trim();
    const relationType = dto.relationType;
    const studentLinks = Array.from(
      new Map(
        (dto.studentLinks ?? []).map((link) => [link.studentId, link]),
      ).values(),
    );

    const parent = await this.prisma.$transaction(async (tx) => {
      let createdUserId: string | null = null;

      if (dto.portalPassword) {
        if (!normalizedEmail) {
          throw new BadRequestException(
            'Email is required to create parent portal access.',
          );
        }

        const existingUser = await tx.user.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
          },
        });

        if (existingUser) {
          throw new ConflictException('Email is already in use.');
        }

        const parentRole = await this.resolveParentRole(tx, schoolId);
        const passwordHash = await bcrypt.hash(dto.portalPassword, 10);
        const createdUser = await tx.user.create({
          data: {
            schoolId,
            roleId: parentRole.id,
            fullName,
            email: normalizedEmail,
            passwordHash,
            phone,
            userType: UserType.PARENT,
            designation: 'Parent',
            isActive: true,
            passwordChangedAt: new Date(),
          },
        });

        createdUserId = createdUser.id;
      }

      const createdParent = await tx.parent.create({
        data: {
          schoolId,
          userId: createdUserId,
          fullName,
          phone,
          email: normalizedEmail,
          address: dto.address?.trim() ?? null,
          relationType,
          emergencyContact: dto.emergencyContact?.trim() ?? null,
        },
        include: parentInclude,
      });

      if (studentLinks.length) {
        const students = await tx.student.findMany({
          where: {
            schoolId,
            id: {
              in: studentLinks.map((link) => link.studentId),
            },
            status: {
              not: StudentStatus.INACTIVE,
            },
          },
          select: {
            id: true,
          },
        });

        if (students.length !== studentLinks.length) {
          throw new NotFoundException('One or more selected students were not found.');
        }

        await tx.parentStudent.createMany({
          data: studentLinks.map((link) => ({
            schoolId,
            parentId: createdParent.id,
            studentId: link.studentId,
            relationType: link.relationType ?? relationType,
          })),
        });
      }

      return tx.parent.findUniqueOrThrow({
        where: {
          id: createdParent.id,
        },
        include: parentInclude,
      });
    });

    await this.auditService.write({
      action: 'parents.create',
      entity: 'parent',
      entityId: parent.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        fullName: parent.fullName,
        relationType: parent.relationType,
        userId: parent.userId,
        linkedStudents: parent.parentStudents.length,
      },
    });

    return {
      success: true,
      message: 'Parent created successfully.',
      data: this.serializeParent(parent),
    };
  }

  async findAll(currentUser: JwtUser, query: ParentQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const where: Prisma.ParentWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [parents, total] = await Promise.all([
      this.prisma.parent.findMany({
        where,
        include: parentInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.parent.count({ where }),
    ]);

    return {
      success: true,
      message: 'Parents fetched successfully.',
      data: parents.map((parent) => this.serializeParent(parent)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const parent = await this.findParentOrThrow(currentUser, id, schoolId ?? null);

    return {
      success: true,
      message: 'Parent fetched successfully.',
      data: this.serializeParent(parent),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateParentDto) {
    const parent = await this.findParentOrThrow(currentUser, id, dto.schoolId ?? null);
    const fullName = dto.fullName?.trim() ?? parent.fullName;
    const normalizedEmail =
      dto.email !== undefined ? dto.email?.trim().toLowerCase() ?? null : parent.email;
    const phone = dto.phone?.trim() ?? parent.phone;
    const hashedPortalPassword = dto.portalPassword
      ? await bcrypt.hash(dto.portalPassword, 10)
      : null;

    const updatedParent = await this.prisma.$transaction(async (tx) => {
      let userId = parent.userId;

      if (parent.userId) {
        const conflictingUser = normalizedEmail
          ? await tx.user.findUnique({
              where: {
                email: normalizedEmail,
              },
              select: {
                id: true,
              },
            })
          : null;

        if (conflictingUser && conflictingUser.id !== parent.userId) {
          throw new ConflictException('Email is already in use.');
        }

        await tx.user.update({
          where: {
            id: parent.userId,
          },
          data: {
            fullName,
            email: normalizedEmail ?? undefined,
            phone,
            ...(hashedPortalPassword
              ? {
                  passwordHash: hashedPortalPassword,
                  passwordChangedAt: new Date(),
                }
              : {}),
          },
        });
      } else if (dto.portalPassword) {
        if (!normalizedEmail) {
          throw new BadRequestException(
            'Email is required to create parent portal access.',
          );
        }

        const existingUser = await tx.user.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
          },
        });

        if (existingUser) {
          throw new ConflictException('Email is already in use.');
        }

        const parentRole = await this.resolveParentRole(tx, parent.schoolId);
        const createdUser = await tx.user.create({
          data: {
            schoolId: parent.schoolId,
            roleId: parentRole.id,
            fullName,
            email: normalizedEmail,
            passwordHash: hashedPortalPassword!,
            phone,
            userType: UserType.PARENT,
            designation: 'Parent',
            isActive: true,
            passwordChangedAt: new Date(),
          },
        });

        userId = createdUser.id;
      }

      return tx.parent.update({
        where: {
          id: parent.id,
        },
        data: {
          fullName,
          phone,
          email: normalizedEmail,
          address: dto.address !== undefined ? dto.address?.trim() ?? null : undefined,
          relationType: dto.relationType ?? undefined,
          emergencyContact:
            dto.emergencyContact !== undefined
              ? dto.emergencyContact?.trim() ?? null
              : undefined,
          userId,
        },
        include: parentInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    await this.auditService.write({
      action: 'parents.update',
      entity: 'parent',
      entityId: updatedParent.id,
      actorUserId: currentUser.id,
      schoolId: updatedParent.schoolId,
      metadata: {
        fullName: updatedParent.fullName,
        relationType: updatedParent.relationType,
      },
    });

    return {
      success: true,
      message: 'Parent updated successfully.',
      data: this.serializeParent(updatedParent),
    };
  }

  async linkStudent(currentUser: JwtUser, id: string, dto: LinkParentStudentDto) {
    const parent = await this.findParentOrThrow(currentUser, id);
    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        schoolId: parent.schoolId,
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: {
        admissions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            academicClass: {
              select: {
                id: true,
                className: true,
              },
            },
            section: {
              select: {
                id: true,
                sectionName: true,
              },
            },
            academicSession: {
              select: {
                id: true,
                sessionName: true,
                isCurrent: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const existingLink = await this.prisma.parentStudent.findFirst({
      where: {
        schoolId: parent.schoolId,
        parentId: parent.id,
        studentId: student.id,
      },
      select: {
        id: true,
      },
    });

    if (existingLink) {
      throw new ConflictException('Student is already linked to this parent.');
    }

    const link = await this.prisma.parentStudent.create({
      data: {
        schoolId: parent.schoolId,
        parentId: parent.id,
        studentId: student.id,
        relationType: dto.relationType ?? parent.relationType,
      },
      include: {
        student: {
          include: {
            admissions: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              include: {
                academicClass: {
                  select: {
                    id: true,
                    className: true,
                  },
                },
                section: {
                  select: {
                    id: true,
                    sectionName: true,
                  },
                },
                academicSession: {
                  select: {
                    id: true,
                    sessionName: true,
                    isCurrent: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await this.auditService.write({
      action: 'parents.link-student',
      entity: 'parent_student',
      entityId: link.id,
      actorUserId: currentUser.id,
      schoolId: parent.schoolId,
      metadata: {
        parentId: parent.id,
        studentId: student.id,
        relationType: link.relationType,
      },
    });

    return {
      success: true,
      message: 'Student linked to parent successfully.',
      data: this.serializeLinkedStudent(link),
    };
  }

  async findChildren(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const parent = await this.findParentOrThrow(currentUser, id, schoolId ?? null);

    return {
      success: true,
      message: 'Parent children fetched successfully.',
      data: parent.parentStudents.map((link) => this.serializeChild(link)),
    };
  }

  async getParentDashboard(currentUser: JwtUser) {
    if (currentUser.role !== RoleType.PARENT) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    const [noticesResponse, holidaysResponse] = await Promise.all([
      this.noticesService.findPortalNotices(currentUser),
      this.holidaysService.findPortal(currentUser),
    ]);

    const parent = await this.prisma.parent.findFirst({
      where: {
        userId: currentUser.id,
        ...(currentUser.schoolId ? { schoolId: currentUser.schoolId } : {}),
      },
      include: {
        parentStudents: {
          include: {
            student: {
              include: {
                admissions: {
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 1,
                  include: {
                    academicClass: {
                      select: {
                        id: true,
                        className: true,
                      },
                    },
                    section: {
                      select: {
                        id: true,
                        sectionName: true,
                      },
                    },
                  },
                },
                attendanceRecords: {
                  select: {
                    status: true,
                  },
                },
                feeAssignments: {
                  select: {
                    netAmount: true,
                    paidAmount: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found.');
    }

    return {
      success: true,
      message: 'Parent dashboard fetched successfully.',
      data: {
        parent: this.serializeParent(parent as ParentRecord),
        children: parent.parentStudents.map((link) => {
          const latestAdmission = link.student.admissions[0];
          const attendanceTotal = link.student.attendanceRecords.length;
          const attendancePresent = link.student.attendanceRecords.filter(
            (record) => record.status === 'PRESENT',
          ).length;
          const attendancePercentage =
            attendanceTotal > 0
              ? Number(((attendancePresent / attendanceTotal) * 100).toFixed(2))
              : 0;
          const totalAssigned = link.student.feeAssignments.reduce(
            (sum, assignment) => sum + Number(assignment.netAmount),
            0,
          );
          const totalPaid = link.student.feeAssignments.reduce(
            (sum, assignment) => sum + Number(assignment.paidAmount),
            0,
          );

          return {
            id: link.student.id,
            name: link.student.fullName,
            registrationNumber: link.student.registrationNumber,
            relationType: link.relationType,
            class: latestAdmission?.academicClass
              ? {
                  id: latestAdmission.academicClass.id,
                  name: latestAdmission.academicClass.className,
                }
              : null,
            section: latestAdmission?.section
              ? {
                  id: latestAdmission.section.id,
                  name: latestAdmission.section.sectionName,
                }
              : null,
            feeSummary: {
              totalAssigned,
              totalPaid,
              totalDue: Math.max(totalAssigned - totalPaid, 0),
            },
            attendanceSummary: {
              totalDays: attendanceTotal,
              present: attendancePresent,
              percentage: attendancePercentage,
            },
          };
        }),
        notices: noticesResponse.data,
        holidays: holidaysResponse.data,
      },
    };
  }

  async getPortalBranding(currentUser: JwtUser) {
    if (currentUser.role !== RoleType.PARENT) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    const school = await this.prisma.school.findUnique({
      where: {
        id: currentUser.schoolId,
      },
      select: {
        id: true,
        schoolCode: true,
        name: true,
        settingsJson: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found.');
    }

    return {
      success: true,
      message: 'Parent portal branding fetched successfully.',
      data: this.serializePortalBranding(school),
    };
  }

  async getParentAttendance(currentUser: JwtUser, studentId: string, sessionId?: string | null) {
    const child = await this.getLinkedStudentOrThrow(currentUser, studentId);
    const history = await this.studentsService.getScopedStudentHistoryPayload(
      child.id,
      child.schoolId,
    );

    const bySession = sessionId
      ? history.attendanceSummary.bySession.filter(
          (entry) => entry.session.id === sessionId,
        )
      : history.attendanceSummary.bySession;
    const overall = bySession.reduce(
      (memo, entry) => ({
        totalDays: memo.totalDays + entry.totalDays,
        present: memo.present + entry.present,
        absent: memo.absent + entry.absent,
        late: memo.late + entry.late,
        leave: memo.leave + entry.leave,
      }),
      {
        totalDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      },
    );

    return {
      success: true,
      message: 'Parent attendance detail fetched successfully.',
      data: {
        student: history.student,
        attendanceSummary: {
          overall: {
            ...overall,
            percentage:
              overall.totalDays > 0
                ? Number(((overall.present / overall.totalDays) * 100).toFixed(2))
                : 0,
          },
          bySession,
          records: sessionId
            ? history.attendanceSummary.records.filter(
                (entry) => entry.session.id === sessionId,
              )
            : history.attendanceSummary.records,
        },
      },
    };
  }

  async getParentFees(currentUser: JwtUser, studentId: string, sessionId?: string | null) {
    const child = await this.getLinkedStudentOrThrow(currentUser, studentId);
    const history = await this.studentsService.getScopedStudentHistoryPayload(
      child.id,
      child.schoolId,
    );

    const bySession = sessionId
      ? history.feeSummary.bySession.filter((entry) => entry.session.id === sessionId)
      : history.feeSummary.bySession;
    const overall = bySession.reduce(
      (memo, entry) => ({
        assignmentsCount: memo.assignmentsCount + entry.assignmentsCount,
        totalAssigned: memo.totalAssigned + entry.totalAssigned,
        totalPaid: memo.totalPaid + entry.totalPaid,
        totalDue: memo.totalDue + entry.totalDue,
      }),
      {
        assignmentsCount: 0,
        totalAssigned: 0,
        totalPaid: 0,
        totalDue: 0,
      },
    );

    return {
      success: true,
      message: 'Parent fee detail fetched successfully.',
      data: {
        student: history.student,
        feeSummary: {
          overall: {
            assignmentsCount: overall.assignmentsCount,
            totalAssigned: Number(overall.totalAssigned.toFixed(2)),
            totalPaid: Number(overall.totalPaid.toFixed(2)),
            totalDue: Number(overall.totalDue.toFixed(2)),
          },
          bySession,
        },
        paymentHistory: sessionId
          ? history.paymentHistory.filter((payment) => payment.session?.id === sessionId)
          : history.paymentHistory,
      },
    };
  }

  async getParentFeeReceipt(
    currentUser: JwtUser,
    studentId: string,
    paymentId: string,
  ) {
    await this.getLinkedStudentOrThrow(currentUser, studentId);

    return this.studentsService.getParentFeeReceipt(currentUser, studentId, paymentId);
  }

  async getParentResults(currentUser: JwtUser, studentId: string, sessionId?: string | null) {
    const child = await this.getLinkedStudentOrThrow(currentUser, studentId);
    const history = await this.studentsService.getScopedStudentHistoryPayload(
      child.id,
      child.schoolId,
    );

    const bySession = sessionId
      ? history.resultSummary.bySession.filter(
          (entry) => entry.session.id === sessionId,
        )
      : history.resultSummary.bySession;
    const aggregate = bySession.reduce(
      (memo, entry) => ({
        examCount: memo.examCount + entry.examCount,
        totalMarks:
          memo.totalMarks +
          entry.results.reduce((sum, item) => sum + item.totalMarks, 0),
        obtainedMarks:
          memo.obtainedMarks +
          entry.results.reduce((sum, item) => sum + item.obtainedMarks, 0),
        percentageTotal:
          memo.percentageTotal +
          entry.results.reduce((sum, item) => sum + item.percentage, 0),
        count: memo.count + entry.results.length,
      }),
      {
        examCount: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        percentageTotal: 0,
        count: 0,
      },
    );

    return {
      success: true,
      message: 'Parent result detail fetched successfully.',
      data: {
        student: history.student,
        resultSummary: {
          overall: {
            examCount: aggregate.examCount,
            totalMarks: Number(aggregate.totalMarks.toFixed(2)),
            obtainedMarks: Number(aggregate.obtainedMarks.toFixed(2)),
            averagePercentage:
              aggregate.count > 0
                ? Number((aggregate.percentageTotal / aggregate.count).toFixed(2))
                : 0,
          },
          bySession,
        },
      },
    };
  }

  async getParentExams(
    currentUser: JwtUser,
    studentId: string,
    sessionId?: string | null,
  ) {
    const child = await this.getLinkedStudentOrThrow(currentUser, studentId);
    const payload = await this.studentsService.getScopedStudentExamPayload(
      child.id,
      child.schoolId,
      sessionId ?? null,
    );

    return {
      success: true,
      message: 'Parent exam detail fetched successfully.',
      data: payload,
    };
  }

  private async findParentOrThrow(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const schoolId = this.resolveReadSchoolScope(currentUser, overrideSchoolId);
    const parent = await this.prisma.parent.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: parentInclude,
    });

    if (!parent) {
      throw new NotFoundException('Parent not found.');
    }

    return parent;
  }

  private resolveReadSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Parent not found.');
    }

    return currentUser.schoolId;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for platform-scoped parent writes.',
        );
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Parent not found.');
    }

    return currentUser.schoolId;
  }

  private async resolveParentRole(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    const roles = await tx.role.findMany({
      where: {
        roleType: RoleType.PARENT,
        isActive: true,
        OR: [{ scopeKey: schoolId }, { scopeKey: GLOBAL_SCOPE_KEY }],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const role =
      roles.find((item) => item.scopeKey === schoolId) ??
      roles.find((item) => item.scopeKey === GLOBAL_SCOPE_KEY);

    if (!role) {
      throw new NotFoundException('Parent role not found.');
    }

    return role;
  }

  private serializeParent(parent: ParentRecord) {
    return {
      id: parent.id,
      schoolId: parent.schoolId,
      userId: parent.userId,
      fullName: parent.fullName,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      relationType: parent.relationType,
      emergencyContact: parent.emergencyContact,
      childrenCount: parent.parentStudents.length,
      linkedStudents: parent.parentStudents.map((link) => this.serializeChild(link)),
      portalAccess: parent.user
        ? {
            userId: parent.user.id,
            email: parent.user.email,
            isActive: parent.user.isActive,
          }
        : null,
      createdAt: parent.createdAt.toISOString(),
      updatedAt: parent.updatedAt.toISOString(),
    };
  }

  private serializeChild(link: ParentRecord['parentStudents'][number]) {
    const latestAdmission = link.student.admissions[0];

    return {
      id: link.student.id,
      name: link.student.fullName,
      registrationNumber: link.student.registrationNumber,
      relationType: link.relationType,
      class: latestAdmission?.academicClass
        ? {
            id: latestAdmission.academicClass.id,
            name: latestAdmission.academicClass.className,
          }
        : null,
      section: latestAdmission?.section
        ? {
            id: latestAdmission.section.id,
            name: latestAdmission.section.sectionName,
          }
        : null,
      session: latestAdmission?.academicSession
        ? {
            id: latestAdmission.academicSession.id,
            name: latestAdmission.academicSession.sessionName,
            isCurrent: latestAdmission.academicSession.isCurrent,
          }
        : null,
    };
  }

  private serializeLinkedStudent(link: {
    id: string;
    relationType: GuardianRelationship;
    student: {
      id: string;
      fullName: string;
      registrationNumber: string | null;
      admissions: Array<{
        academicClass: {
          id: string;
          className: string;
        };
        section: {
          id: string;
          sectionName: string;
        } | null;
        academicSession: {
          id: string;
          sessionName: string;
          isCurrent: boolean;
        };
      }>;
    };
  }) {
    const latestAdmission = link.student.admissions[0];

    return {
      id: link.id,
      relationType: link.relationType,
      student: {
        id: link.student.id,
        name: link.student.fullName,
        registrationNumber: link.student.registrationNumber,
        class: latestAdmission?.academicClass
          ? {
              id: latestAdmission.academicClass.id,
              name: latestAdmission.academicClass.className,
            }
          : null,
        section: latestAdmission?.section
          ? {
              id: latestAdmission.section.id,
              name: latestAdmission.section.sectionName,
            }
          : null,
        session: latestAdmission?.academicSession
          ? {
              id: latestAdmission.academicSession.id,
              name: latestAdmission.academicSession.sessionName,
              isCurrent: latestAdmission.academicSession.isCurrent,
            }
          : null,
      },
    };
  }

  private serializePortalBranding(school: {
    id: string;
    schoolCode: string;
    name: string;
    settingsJson: Prisma.JsonValue;
  }) {
    const settingsJson = this.getSettingsJson(school.settingsJson);
    const branding = this.getBrandingSettings(settingsJson);

    return {
      schoolId: school.id,
      schoolCode: school.schoolCode,
      schoolName: school.name,
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? null,
      secondaryColor: branding.secondaryColor ?? null,
      website: branding.website ?? null,
      supportEmail: branding.supportEmail ?? null,
    };
  }

  private getSettingsJson(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, any>;
    }

    return value as Record<string, any>;
  }

  private getBrandingSettings(settingsJson: Record<string, any>) {
    if (
      !settingsJson.branding ||
      typeof settingsJson.branding !== 'object' ||
      Array.isArray(settingsJson.branding)
    ) {
      return {} as Record<string, any>;
    }

    return settingsJson.branding as Record<string, any>;
  }

  private async getLinkedStudentOrThrow(currentUser: JwtUser, studentId: string) {
    if (currentUser.role !== RoleType.PARENT) {
      throw new ForbiddenException('Only parent users can access this resource.');
    }

    if (!studentId) {
      throw new BadRequestException('studentId is required.');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    const parent = await this.prisma.parent.findFirst({
      where: {
        schoolId: currentUser.schoolId,
        userId: currentUser.id,
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found.');
    }

    const linkedStudent = await this.prisma.parentStudent.findFirst({
      where: {
        schoolId: currentUser.schoolId,
        parentId: parent.id,
        studentId,
      },
      select: {
        student: {
          select: {
            id: true,
            schoolId: true,
          },
        },
      },
    });

    if (!linkedStudent?.student) {
      throw new NotFoundException('Linked student not found.');
    }

    return linkedStudent.student;
  }
}
