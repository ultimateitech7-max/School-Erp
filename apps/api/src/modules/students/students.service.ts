import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  Prisma,
  RoleType,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { HolidaysService } from '../holidays/holidays.service';
import { HomeworkService } from '../homework/homework.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NoticesService } from '../notices/notices.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const STUDENT_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const studentDetailsInclude = Prisma.validator<Prisma.StudentInclude>()({
  admissions: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
      academicSession: {
        select: {
          id: true,
          sessionName: true,
          isCurrent: true,
          isActive: true,
        },
      },
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
});

type StudentWithDetails = Prisma.StudentGetPayload<{
  include: typeof studentDetailsInclude;
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly noticesService: NoticesService,
    private readonly homeworkService: HomeworkService,
    private readonly holidaysService: HolidaysService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateStudentDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const manualRegistrationNumber =
      currentUser.role === RoleType.SUPER_ADMIN && dto.registrationNumber
        ? this.normalizeRegistrationNumber(dto.registrationNumber)
        : null;
    const student = await this.prisma.$transaction(
      async (tx) =>
        this.createStudentTransactional(tx, schoolId, dto, {
          manualRegistrationNumber,
        }),
      {
        maxWait: 20_000,
        timeout: 60_000,
      },
    );

    if (!student) {
      throw new ConflictException(
        'Unable to generate a unique registration number.',
      );
    }

    await this.invalidateStudentCache(schoolId);
    await this.auditService.write({
      action: 'students.create',
      entity: 'student',
      entityId: student.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        name: student.fullName,
        admissionNo: student.admissions[0]?.admissionNo ?? null,
      },
    });

    return {
      success: true,
      message: 'Student created successfully.',
      data: this.serializeStudent(student),
    };
  }

  async findAll(currentUser: JwtUser, query: StudentQueryDto) {
    const schoolId = this.resolveListScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheScope = schoolId ?? 'all';
    const cacheKey = this.buildStudentsCacheKey(cacheScope, {
      page,
      limit,
      search,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      STUDENT_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.StudentWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          status: {
            not: StudentStatus.INACTIVE,
          },
          ...(search
            ? {
                OR: [
                  {
                    firstName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    lastName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    fullName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    registrationNumber: {
                      contains: this.normalizeRegistrationNumber(search),
                      mode: 'insensitive',
                    },
                  },
                  {
                    admissions: {
                      some: {
                        admissionNo: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        const [students, total] = await Promise.all([
          this.prisma.student.findMany({
            where,
            include: studentDetailsInclude,
            orderBy: {
              createdAt: 'desc',
            },
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.student.count({ where }),
        ]);

        return {
          items: students.map((student) => this.serializeStudent(student)),
          meta: {
            page,
            limit,
            total,
          },
        };
      },
    );

    return {
      success: true,
      message: 'Students fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findByRegistration(
    currentUser: JwtUser,
    registrationNumber: string,
    overrideSchoolId?: string | null,
  ) {
    const normalizedRegistrationNumber =
      this.normalizeRegistrationNumber(registrationNumber);
    const schoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? overrideSchoolId ?? currentUser.schoolId ?? null
        : this.resolveSchoolScope(currentUser, overrideSchoolId);

    const student = await this.prisma.student.findFirst({
      where: {
        registrationNumber: normalizedRegistrationNumber,
        ...(schoolId ? { schoolId } : {}),
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: studentDetailsInclude,
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return {
      success: true,
      message: 'Student fetched successfully.',
      data: this.serializeStudent(student),
    };
  }

  async findOne(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const student = await this.findStudentOrThrow(
      currentUser,
      id,
      overrideSchoolId ?? null,
    );

    return {
      success: true,
      message: 'Student fetched successfully.',
      data: this.serializeStudent(student),
    };
  }

  async findHistory(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const student = await this.findStudentOrThrow(
      currentUser,
      id,
      overrideSchoolId ?? null,
    );
    const historyPayload = await this.buildStudentHistoryPayload(student);

    return {
      success: true,
      message: 'Student history fetched successfully.',
      data: historyPayload,
    };
  }

  async getPortalDashboard(currentUser: JwtUser) {
    const student = await this.findPortalStudentOrThrow(currentUser);
    const [historyPayload, noticesResponse] = await Promise.all([
      this.buildStudentHistoryPayload(student),
      this.noticesService.findPortalNotices(currentUser),
    ]);
    const currentEnrollment =
      historyPayload.enrollmentHistory.find((entry) => entry.session.isCurrent) ??
      historyPayload.enrollmentHistory.at(-1) ??
      null;
    const [homework, holidays] = await Promise.all([
      currentEnrollment?.class?.id
        ? this.homeworkService.findForStudentScope(
            student.schoolId,
            currentEnrollment.class.id,
            currentEnrollment.section?.id ?? null,
          )
        : Promise.resolve([]),
      this.holidaysService.getUpcomingForSchool(student.schoolId),
    ]);

    return {
      success: true,
      message: 'Student dashboard fetched successfully.',
      data: {
        student: historyPayload.student,
        currentEnrollment,
        attendanceSummary: historyPayload.attendanceSummary,
        feeSummary: historyPayload.feeSummary,
        resultSummary: historyPayload.resultSummary,
        homework,
        holidays,
        notices: noticesResponse.data,
      },
    };
  }

  async getPortalHomework(currentUser: JwtUser) {
    const dashboard = await this.getPortalDashboard(currentUser);

    return {
      success: true,
      message: 'Student homework fetched successfully.',
      data: {
        student: dashboard.data.student,
        currentEnrollment: dashboard.data.currentEnrollment,
        homework: dashboard.data.homework,
      },
    };
  }

  async getPortalHolidays(currentUser: JwtUser) {
    const dashboard = await this.getPortalDashboard(currentUser);

    return {
      success: true,
      message: 'Student holidays fetched successfully.',
      data: {
        student: dashboard.data.student,
        holidays: dashboard.data.holidays,
      },
    };
  }

  async getPortalAttendance(currentUser: JwtUser, sessionId?: string | null) {
    const student = await this.findPortalStudentOrThrow(currentUser);
    const historyPayload = await this.buildStudentHistoryPayload(student);

    return {
      success: true,
      message: 'Student attendance fetched successfully.',
      data: {
        student: historyPayload.student,
        attendanceSummary: sessionId
          ? this.filterAttendanceBySession(historyPayload.attendanceSummary, sessionId)
          : historyPayload.attendanceSummary,
      },
    };
  }

  async getPortalFees(currentUser: JwtUser, sessionId?: string | null) {
    const student = await this.findPortalStudentOrThrow(currentUser);
    const historyPayload = await this.buildStudentHistoryPayload(student);

    return {
      success: true,
      message: 'Student fee summary fetched successfully.',
      data: {
        student: historyPayload.student,
        feeSummary: sessionId
          ? this.filterFeeBySession(historyPayload.feeSummary, sessionId)
          : historyPayload.feeSummary,
        paymentHistory: sessionId
          ? historyPayload.paymentHistory.filter(
              (payment) => payment.session?.id === sessionId,
            )
          : historyPayload.paymentHistory,
      },
    };
  }

  async getPortalResults(currentUser: JwtUser, sessionId?: string | null) {
    const student = await this.findPortalStudentOrThrow(currentUser);
    const historyPayload = await this.buildStudentHistoryPayload(student);

    return {
      success: true,
      message: 'Student results fetched successfully.',
      data: {
        student: historyPayload.student,
        resultSummary: sessionId
          ? this.filterResultBySession(historyPayload.resultSummary, sessionId)
          : historyPayload.resultSummary,
      },
    };
  }

  async getScopedStudentHistoryPayload(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: studentDetailsInclude,
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return this.buildStudentHistoryPayload(student);
  }

  async findPortalStudentByUserId(userId: string, schoolId?: string | null) {
    const student = await this.prisma.student.findFirst({
      where: {
        userId,
        ...(schoolId ? { schoolId } : {}),
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: studentDetailsInclude,
    });

    if (!student) {
      throw new NotFoundException('Student not found for this portal user.');
    }

    return student;
  }

  private async findPortalStudentOrThrow(currentUser: JwtUser) {
    if (currentUser.role !== RoleType.STUDENT) {
      throw new ForbiddenException('Only student users can access this resource.');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    return this.findPortalStudentByUserId(currentUser.id, currentUser.schoolId);
  }

  private async buildStudentHistoryPayload(student: StudentWithDetails) {
    const schoolId = student.schoolId;

    const [
      admissions,
      promotions,
      attendanceRecords,
      feeAssignments,
      feePayments,
      reportCards,
    ] = await Promise.all([
      this.prisma.admission.findMany({
        where: {
          schoolId,
          studentId: student.id,
        },
        include: {
          academicSession: {
            select: {
              id: true,
              sessionName: true,
              startDate: true,
              endDate: true,
              isCurrent: true,
              isActive: true,
            },
          },
          academicClass: {
            select: {
              id: true,
              className: true,
              classCode: true,
            },
          },
          section: {
            select: {
              id: true,
              sectionName: true,
            },
          },
        },
      }),
      this.prisma.promotionHistory.findMany({
        where: {
          schoolId,
          studentId: student.id,
        },
        include: {
          fromAcademicSession: {
            select: {
              id: true,
              sessionName: true,
            },
          },
          toAcademicSession: {
            select: {
              id: true,
              sessionName: true,
            },
          },
          fromClass: {
            select: {
              id: true,
              className: true,
            },
          },
          toClass: {
            select: {
              id: true,
              className: true,
            },
          },
          fromSection: {
            select: {
              id: true,
              sectionName: true,
            },
          },
          toSection: {
            select: {
              id: true,
              sectionName: true,
            },
          },
          fromEnrollment: {
            select: {
              id: true,
              admissionNo: true,
              rollNo: true,
            },
          },
          toEnrollment: {
            select: {
              id: true,
              admissionNo: true,
              rollNo: true,
            },
          },
          promotedByUser: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          promotedAt: 'asc',
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          schoolId,
          studentId: student.id,
        },
        select: {
          id: true,
          sessionId: true,
          status: true,
          academicSession: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true,
            },
          },
        },
      }),
      this.prisma.feeAssignment.findMany({
        where: {
          schoolId,
          studentId: student.id,
        },
        select: {
          id: true,
          sessionId: true,
          netAmount: true,
          paidAmount: true,
          status: true,
          academicSession: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true,
            },
          },
        },
      }),
      this.prisma.feePayment.findMany({
        where: {
          schoolId,
          feeAssignment: {
            studentId: student.id,
          },
        },
        include: {
          feeAssignment: {
            select: {
              sessionId: true,
              feeStructure: {
                select: {
                  feeName: true,
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
          feeReceipt: {
            select: {
              receiptNo: true,
              paymentMode: true,
            },
          },
        },
        orderBy: {
          paymentDate: 'desc',
        },
      }),
      this.prisma.reportCard.findMany({
        where: {
          schoolId,
          studentId: student.id,
        },
        include: {
          academicSession: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true,
            },
          },
          exam: {
            select: {
              id: true,
              examName: true,
              examCode: true,
              examType: true,
              startDate: true,
              endDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const enrollmentHistory = admissions
      .slice()
      .sort(
        (left, right) =>
          new Date(left.academicSession.startDate).getTime() -
          new Date(right.academicSession.startDate).getTime(),
      )
      .map((admission) => ({
        id: admission.id,
        admissionNo: admission.admissionNo,
        rollNo: admission.rollNo,
        status: admission.admissionStatus,
        admissionDate: admission.admissionDate.toISOString(),
        session: {
          id: admission.academicSession.id,
          name: admission.academicSession.sessionName,
          startDate: admission.academicSession.startDate.toISOString(),
          endDate: admission.academicSession.endDate.toISOString(),
          isCurrent: admission.academicSession.isCurrent,
          isActive: admission.academicSession.isActive,
        },
        class: {
          id: admission.academicClass.id,
          name: admission.academicClass.className,
          classCode: admission.academicClass.classCode,
        },
        section: admission.section
          ? {
              id: admission.section.id,
              name: admission.section.sectionName,
            }
          : null,
      }));

    const promotionHistory = promotions.map((promotion) => ({
      id: promotion.id,
      schoolId: promotion.schoolId,
      action: promotion.action,
      remarks: promotion.remarks,
      promotedAt: promotion.promotedAt.toISOString(),
      createdAt: promotion.createdAt.toISOString(),
      updatedAt: promotion.updatedAt.toISOString(),
      student: {
        id: student.id,
        name: student.fullName,
        studentCode: student.studentCode,
      },
      fromAcademicSession: {
        id: promotion.fromAcademicSession.id,
        name: promotion.fromAcademicSession.sessionName,
      },
      toAcademicSession: {
        id: promotion.toAcademicSession.id,
        name: promotion.toAcademicSession.sessionName,
      },
      fromClass: {
        id: promotion.fromClass.id,
        name: promotion.fromClass.className,
      },
      toClass: {
        id: promotion.toClass.id,
        name: promotion.toClass.className,
      },
      fromSection: promotion.fromSection
        ? {
            id: promotion.fromSection.id,
            name: promotion.fromSection.sectionName,
          }
        : null,
      toSection: promotion.toSection
        ? {
            id: promotion.toSection.id,
            name: promotion.toSection.sectionName,
          }
        : null,
      fromEnrollment: {
        id: promotion.fromEnrollment.id,
        admissionNo: promotion.fromEnrollment.admissionNo,
        rollNo: promotion.fromEnrollment.rollNo,
      },
      toEnrollment: {
        id: promotion.toEnrollment.id,
        admissionNo: promotion.toEnrollment.admissionNo,
        rollNo: promotion.toEnrollment.rollNo,
      },
      promotedBy: promotion.promotedByUser
        ? {
            id: promotion.promotedByUser.id,
            name: promotion.promotedByUser.fullName,
          }
        : null,
    }));

    const attendanceSummary = this.buildAttendanceHistory(attendanceRecords);
    const feeSummary = this.buildFeeHistory(feeAssignments);
    const resultSummary = this.buildResultHistory(reportCards);
    const paymentHistory = feePayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.paidAmount),
      paymentDate: payment.paymentDate.toISOString(),
      remarks: payment.remarks,
      receiptNo: payment.feeReceipt.receiptNo,
      paymentMode: payment.feeReceipt.paymentMode,
      feeName: payment.feeAssignment.feeStructure.feeName,
      session: payment.feeAssignment.academicSession
        ? {
            id: payment.feeAssignment.academicSession.id,
            name: payment.feeAssignment.academicSession.sessionName,
            isCurrent: payment.feeAssignment.academicSession.isCurrent,
          }
        : null,
    }));

    return {
      student: this.serializeStudent(student),
      enrollmentHistory,
      promotionHistory,
      attendanceSummary,
      feeSummary,
      resultSummary,
      paymentHistory,
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateStudentDto) {
    const existingStudent = await this.findStudentOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const schoolId = existingStudent.schoolId;

    if (dto.studentCode) {
      await this.ensureUniqueStudentCode(
        this.prisma,
        schoolId,
        dto.studentCode.trim().toUpperCase(),
        id,
      );
    }

    const updatedStudent = await this.prisma.$transaction(async (tx) => {
      const updatedName = dto.name?.trim();
      const nameParts = updatedName ? this.splitName(updatedName) : null;

      await tx.student.update({
        where: { id },
        data: {
          ...(dto.studentCode
            ? { studentCode: dto.studentCode.trim().toUpperCase() }
            : {}),
          ...(updatedName && nameParts
            ? {
                firstName: nameParts.firstName,
                lastName: nameParts.lastName,
                fullName: updatedName,
              }
            : {}),
          ...(dto.email !== undefined ? { email: dto.email ?? null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone ?? null } : {}),
          ...(dto.gender ? { gender: dto.gender } : {}),
          ...(dto.dateOfBirth
            ? { dateOfBirth: new Date(dto.dateOfBirth) }
            : {}),
          ...(dto.joinedOn !== undefined
            ? { joinedOn: dto.joinedOn ? new Date(dto.joinedOn) : null }
            : {}),
        },
      });

      if (this.hasAdmissionPayload(dto)) {
        await this.upsertAdmission(tx, schoolId, id, dto);
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        include: studentDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateStudentCache(schoolId);
    await this.auditService.write({
      action: 'students.update',
      entity: 'student',
      entityId: updatedStudent.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        name: updatedStudent.fullName,
        admissionNo: updatedStudent.admissions[0]?.admissionNo ?? null,
      },
    });

    return {
      success: true,
      message: 'Student updated successfully.',
      data: this.serializeStudent(updatedStudent),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const student = await this.findStudentOrThrow(
      currentUser,
      id,
      schoolIdOverride ?? null,
    );

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        status: StudentStatus.INACTIVE,
      },
    });

    await this.invalidateStudentCache(student.schoolId);
    await this.auditService.write({
      action: 'students.delete',
      entity: 'student',
      entityId: student.id,
      actorUserId: currentUser.id,
      schoolId: student.schoolId,
      metadata: {
        name: student.fullName,
      },
    });

    return {
      success: true,
      message: 'Student deleted successfully.',
      data: {
        id: student.id,
        deleted: true,
      },
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride ?? null);

    const [currentSession, classes] = await Promise.all([
      this.prisma.academicSession.findFirst({
        where: {
          schoolId,
          isCurrent: true,
          isActive: true,
        },
        select: {
          id: true,
          sessionName: true,
        },
      }),
      this.prisma.academicClass.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          sections: {
            where: {
              isActive: true,
            },
            orderBy: {
              sectionName: 'asc',
            },
            select: {
              id: true,
              sectionName: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Student options fetched successfully.',
      data: {
        currentSessionId: currentSession?.id ?? null,
        currentSessionName: currentSession?.sessionName ?? null,
        classes: classes.map((academicClass) => ({
          id: academicClass.id,
          name: academicClass.className,
          sections: academicClass.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
      },
    };
  }

  async createStudentTransactional(
    tx: Prisma.TransactionClient,
    schoolId: string,
    dto: CreateStudentDto,
    options?: {
      manualRegistrationNumber?: string | null;
    },
  ) {
    const normalizedName = dto.name.trim();
    const { firstName, lastName } = this.splitName(normalizedName);
    const studentCode =
      dto.studentCode?.trim().toUpperCase() ??
      (await this.generateStudentCode(tx, schoolId));
    const manualRegistrationNumber =
      options?.manualRegistrationNumber ?? null;

    await this.ensureUniqueStudentCode(tx, schoolId, studentCode);

    let lastRegistrationError: unknown;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const registrationNumber =
          manualRegistrationNumber ??
          (await this.generateRegistrationNumber(tx, schoolId));

        await this.ensureUniqueRegistrationNumber(
          tx,
          schoolId,
          registrationNumber,
        );

        const createdStudent = await tx.student.create({
          data: {
            schoolId,
            studentCode,
            registrationNumber,
            firstName,
            lastName,
            fullName: normalizedName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            gender: dto.gender ?? 'OTHER',
            dateOfBirth: new Date(dto.dateOfBirth ?? '2000-01-01'),
            joinedOn: dto.joinedOn ? new Date(dto.joinedOn) : null,
            status: StudentStatus.ACTIVE,
          },
        });

        await this.upsertAdmission(tx, schoolId, createdStudent.id, dto);

        return tx.student.findUniqueOrThrow({
          where: { id: createdStudent.id },
          include: studentDetailsInclude,
        });
      } catch (error) {
        if (
          !manualRegistrationNumber &&
          this.isRegistrationConstraintError(error)
        ) {
          lastRegistrationError = error;
          continue;
        }

        throw error;
      }
    }

    throw (
      lastRegistrationError ??
      new ConflictException('Unable to generate a unique registration number.')
    );
  }

  private resolveSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = overrideSchoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new ForbiddenException(
          'SUPER_ADMIN must provide a school scope for this action.',
        );
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private resolveListScope(currentUser: JwtUser, overrideSchoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return overrideSchoolId ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private async findStudentOrThrow(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const schoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? overrideSchoolId ?? currentUser.schoolId ?? null
        : this.resolveSchoolScope(currentUser, overrideSchoolId);

    const student = await this.prisma.student.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: studentDetailsInclude,
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return student;
  }

  private async upsertAdmission(
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    dto: Pick<
      CreateStudentDto,
      'admissionNo' | 'classId' | 'sectionId' | 'sessionId'
    >,
  ) {
    if (!this.hasAdmissionPayload(dto)) {
      return;
    }

    if (!dto.classId) {
      throw new BadRequestException(
        'classId is required when admission details are provided.',
      );
    }

    const [academicClass, section] = await Promise.all([
      tx.academicClass.findFirst({
        where: {
          id: dto.classId,
          schoolId,
          isActive: true,
        },
      }),
      dto.sectionId
        ? tx.section.findFirst({
            where: {
              id: dto.sectionId,
              schoolId,
              isActive: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found for this school.');
    }

    if (section && section.classId !== dto.classId) {
      throw new BadRequestException('Selected section does not belong to class.');
    }

    const sessionId = await this.resolveAdmissionSessionId(
      tx,
      schoolId,
      dto.sessionId,
    );

    const existingAdmission = await tx.admission.findFirst({
      where: {
        schoolId,
        studentId,
        sessionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const admissionNo =
      dto.admissionNo?.trim().toUpperCase() ??
      existingAdmission?.admissionNo ??
      (await this.generateAdmissionNo(tx, schoolId));

    await this.ensureUniqueAdmissionNo(
      tx,
      schoolId,
      admissionNo,
      existingAdmission?.id,
    );

    const admissionData = {
      schoolId,
      studentId,
      sessionId,
      classId: academicClass.id,
      sectionId: section?.id ?? null,
      admissionNo,
      admissionDate: new Date(),
      admissionStatus: AdmissionStatus.ACTIVE,
    };

    if (existingAdmission) {
      await tx.admission.update({
        where: {
          id: existingAdmission.id,
        },
        data: admissionData,
      });

      return;
    }

    await tx.admission.create({
      data: admissionData,
    });
  }

  private async resolveAdmissionSessionId(
    tx: Prisma.TransactionClient,
    schoolId: string,
    sessionId?: string | null,
  ) {
    if (sessionId) {
      const session = await tx.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found for this school.');
      }

      return session.id;
    }

    const currentSession = await tx.academicSession.findFirst({
      where: {
        schoolId,
        isCurrent: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!currentSession) {
      throw new BadRequestException(
        'No active current session found for this school.',
      );
    }

    return currentSession.id;
  }

  private hasAdmissionPayload(
    dto: Pick<CreateStudentDto, 'admissionNo' | 'classId' | 'sectionId' | 'sessionId'>,
  ) {
    return Boolean(dto.admissionNo || dto.classId || dto.sectionId || dto.sessionId);
  }

  private splitName(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        firstName: name,
        lastName: name,
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: parts[0],
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private async ensureUniqueStudentCode(
    db: Prisma.TransactionClient | PrismaService,
    schoolId: string,
    studentCode: string,
    excludeStudentId?: string,
  ) {
    const existingStudent = await db.student.findUnique({
      where: {
        schoolId_studentCode: {
          schoolId,
          studentCode,
        },
      },
    });

    if (existingStudent && existingStudent.id !== excludeStudentId) {
      throw new ConflictException('Student code is already in use.');
    }
  }

  private async ensureUniqueAdmissionNo(
    tx: Prisma.TransactionClient,
    schoolId: string,
    admissionNo: string,
    excludeAdmissionId?: string,
  ) {
    const existingAdmission = await tx.admission.findUnique({
      where: {
        schoolId_admissionNo: {
          schoolId,
          admissionNo,
        },
      },
    });

    if (existingAdmission && existingAdmission.id !== excludeAdmissionId) {
      throw new ConflictException('Admission number is already in use.');
    }
  }

  private async ensureUniqueRegistrationNumber(
    tx: Prisma.TransactionClient,
    schoolId: string,
    registrationNumber: string,
    excludeStudentId?: string,
  ) {
    const existingStudent = await tx.student.findFirst({
      where: {
        schoolId,
        registrationNumber,
      },
      select: {
        id: true,
      },
    });

    if (existingStudent && existingStudent.id !== excludeStudentId) {
      throw new ConflictException(
        'Registration number is already in use for this school.',
      );
    }
  }

  private async generateStudentCode(
    db: Prisma.TransactionClient | PrismaService,
    schoolId: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const existingStudent = await db.student.findUnique({
        where: {
          schoolId_studentCode: {
            schoolId,
            studentCode: candidate,
          },
        },
      });

      if (!existingStudent) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique student code.');
  }

  private async generateAdmissionNo(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `ADM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const existingAdmission = await tx.admission.findUnique({
        where: {
          schoolId_admissionNo: {
            schoolId,
            admissionNo: candidate,
          },
        },
      });

      if (!existingAdmission) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique admission number.');
  }

  private async generateRegistrationNumber(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    const prefix = await this.getRegistrationPrefix(tx, schoolId);
    const year = new Date().getUTCFullYear();
    const scopedPrefix = `${prefix}-${year}`;
    const latestStudent = await tx.student.findFirst({
      where: {
        schoolId,
        registrationNumber: {
          startsWith: scopedPrefix,
        },
      },
      orderBy: {
        registrationNumber: 'desc',
      },
      select: {
        registrationNumber: true,
      },
    });
    const latestSequence = latestStudent?.registrationNumber
      ? Number.parseInt(
          latestStudent.registrationNumber.split('-').at(-1) ?? '0',
          10,
        )
      : 0;
    const baseSequence = Number.isFinite(latestSequence) ? latestSequence : 0;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = `${scopedPrefix}-${String(baseSequence + attempt + 1).padStart(4, '0')}`;
      const existingStudent = await tx.student.findFirst({
        where: {
          schoolId,
          registrationNumber: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existingStudent) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique registration number.',
    );
  }

  private isRegistrationConstraintError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.map((item) => String(item))
      : [];

    return target.includes('registration_number') || target.includes('registrationNumber');
  }

  private async getRegistrationPrefix(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    const school = await tx.school.findUnique({
      where: {
        id: schoolId,
      },
      select: {
        schoolCode: true,
      },
    });

    const normalizedPrefix =
      school?.schoolCode
        ?.replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 10) ?? 'SCH';

    return normalizedPrefix || 'SCH';
  }

  private normalizeRegistrationNumber(value: string) {
    return value.trim().toUpperCase();
  }

  private buildStudentsCacheKey(
    schoolScope: string,
    query: { page: number; limit: number; search: string },
  ) {
    return this.redisService.buildStudentListKey(
      schoolScope,
      JSON.stringify(query),
    );
  }

  private async invalidateStudentCache(schoolId: string) {
    await Promise.all([
      this.redisService.deleteByPattern(
        this.redisService.buildStudentListKey(schoolId, '*'),
      ),
      this.redisService.deleteByPattern(
        this.redisService.buildStudentListKey('all', '*'),
      ),
    ]);
  }

  private buildAttendanceHistory(
    attendanceRecords: Array<{
      id: string;
      sessionId: string;
      status: string;
      academicSession: {
        id: string;
        sessionName: string;
        isCurrent: boolean;
      };
    }>,
  ) {
    const bySessionMap = new Map<
      string,
      {
        session: {
          id: string;
          name: string;
          isCurrent: boolean;
        };
        totalDays: number;
        present: number;
        absent: number;
        late: number;
        leave: number;
        percentage: number;
      }
    >();

    for (const record of attendanceRecords) {
      if (!bySessionMap.has(record.sessionId)) {
        bySessionMap.set(record.sessionId, {
          session: {
            id: record.academicSession.id,
            name: record.academicSession.sessionName,
            isCurrent: record.academicSession.isCurrent,
          },
          totalDays: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          percentage: 0,
        });
      }

      const summary = bySessionMap.get(record.sessionId);

      if (!summary) {
        continue;
      }

      summary.totalDays += 1;

      if (record.status === 'PRESENT') {
        summary.present += 1;
      }

      if (record.status === 'ABSENT') {
        summary.absent += 1;
      }

      if (record.status === 'LATE') {
        summary.late += 1;
      }

      if (record.status === 'LEAVE') {
        summary.leave += 1;
      }
    }

    const bySession = Array.from(bySessionMap.values())
      .map((summary) => ({
        ...summary,
        percentage:
          summary.totalDays > 0
            ? Number(((summary.present / summary.totalDays) * 100).toFixed(2))
            : 0,
      }))
      .sort((left, right) => left.session.name.localeCompare(right.session.name));

    const overall = bySession.reduce(
      (aggregate, current) => ({
        totalDays: aggregate.totalDays + current.totalDays,
        present: aggregate.present + current.present,
        absent: aggregate.absent + current.absent,
        late: aggregate.late + current.late,
        leave: aggregate.leave + current.leave,
        percentage: 0,
      }),
      {
        totalDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        percentage: 0,
      },
    );

    return {
      overall: {
        ...overall,
        percentage:
          overall.totalDays > 0
            ? Number(((overall.present / overall.totalDays) * 100).toFixed(2))
            : 0,
      },
      bySession,
    };
  }

  private filterAttendanceBySession(
    summary: ReturnType<StudentsService['buildAttendanceHistory']>,
    sessionId: string,
  ) {
    const matchedSession = summary.bySession.filter(
      (entry) => entry.session.id === sessionId,
    );
    const aggregate = matchedSession.reduce(
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
      overall: {
        ...aggregate,
        percentage:
          aggregate.totalDays > 0
            ? Number(((aggregate.present / aggregate.totalDays) * 100).toFixed(2))
            : 0,
      },
      bySession: matchedSession,
    };
  }

  private buildFeeHistory(
    feeAssignments: Array<{
      id: string;
      sessionId: string;
      netAmount: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
      status: string;
      academicSession: {
        id: string;
        sessionName: string;
        isCurrent: boolean;
      };
    }>,
  ) {
    const bySessionMap = new Map<
      string,
      {
        session: {
          id: string;
          name: string;
          isCurrent: boolean;
        };
        assignmentsCount: number;
        totalAssigned: number;
        totalPaid: number;
        totalDue: number;
      }
    >();

    for (const assignment of feeAssignments) {
      if (!bySessionMap.has(assignment.sessionId)) {
        bySessionMap.set(assignment.sessionId, {
          session: {
            id: assignment.academicSession.id,
            name: assignment.academicSession.sessionName,
            isCurrent: assignment.academicSession.isCurrent,
          },
          assignmentsCount: 0,
          totalAssigned: 0,
          totalPaid: 0,
          totalDue: 0,
        });
      }

      const summary = bySessionMap.get(assignment.sessionId);

      if (!summary) {
        continue;
      }

      const assignedAmount = Number(assignment.netAmount);
      const paidAmount = Number(assignment.paidAmount);

      summary.assignmentsCount += 1;
      summary.totalAssigned += assignedAmount;
      summary.totalPaid += paidAmount;
      summary.totalDue += Math.max(assignedAmount - paidAmount, 0);
    }

    const bySession = Array.from(bySessionMap.values())
      .map((summary) => ({
        ...summary,
        totalAssigned: Number(summary.totalAssigned.toFixed(2)),
        totalPaid: Number(summary.totalPaid.toFixed(2)),
        totalDue: Number(summary.totalDue.toFixed(2)),
      }))
      .sort((left, right) => left.session.name.localeCompare(right.session.name));

    const overall = bySession.reduce(
      (aggregate, current) => ({
        assignmentsCount: aggregate.assignmentsCount + current.assignmentsCount,
        totalAssigned: aggregate.totalAssigned + current.totalAssigned,
        totalPaid: aggregate.totalPaid + current.totalPaid,
        totalDue: aggregate.totalDue + current.totalDue,
      }),
      {
        assignmentsCount: 0,
        totalAssigned: 0,
        totalPaid: 0,
        totalDue: 0,
      },
    );

    return {
      overall: {
        assignmentsCount: overall.assignmentsCount,
        totalAssigned: Number(overall.totalAssigned.toFixed(2)),
        totalPaid: Number(overall.totalPaid.toFixed(2)),
        totalDue: Number(overall.totalDue.toFixed(2)),
      },
      bySession,
    };
  }

  private filterFeeBySession(
    summary: ReturnType<StudentsService['buildFeeHistory']>,
    sessionId: string,
  ) {
    const matchedSession = summary.bySession.filter(
      (entry) => entry.session.id === sessionId,
    );
    const aggregate = matchedSession.reduce(
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
      overall: {
        assignmentsCount: aggregate.assignmentsCount,
        totalAssigned: Number(aggregate.totalAssigned.toFixed(2)),
        totalPaid: Number(aggregate.totalPaid.toFixed(2)),
        totalDue: Number(aggregate.totalDue.toFixed(2)),
      },
      bySession: matchedSession,
    };
  }

  private buildResultHistory(
    reportCards: Array<{
      id: string;
      examId: string;
      totalMarks: Prisma.Decimal;
      obtainedMarks: Prisma.Decimal;
      percentage: Prisma.Decimal;
      overallGrade: string | null;
      publishedAt: Date | null;
      createdAt: Date;
      academicSession: {
        id: string;
        sessionName: string;
        isCurrent: boolean;
      };
      exam: {
        id: string;
        examName: string;
        examCode: string;
        examType: string;
        startDate: Date;
        endDate: Date;
      };
    }>,
  ) {
    const bySessionMap = new Map<
      string,
      {
        session: {
          id: string;
          name: string;
          isCurrent: boolean;
        };
        examCount: number;
        averagePercentage: number;
        results: Array<{
          id: string;
          examId: string;
          examName: string;
          examCode: string;
          examType: string;
          startDate: Date;
          endDate: Date;
          totalMarks: number;
          obtainedMarks: number;
          percentage: number;
          grade: string | null;
          publishedAt: Date | null;
          createdAt: Date;
        }>;
      }
    >();

    for (const reportCard of reportCards) {
      if (!bySessionMap.has(reportCard.academicSession.id)) {
        bySessionMap.set(reportCard.academicSession.id, {
          session: {
            id: reportCard.academicSession.id,
            name: reportCard.academicSession.sessionName,
            isCurrent: reportCard.academicSession.isCurrent,
          },
          examCount: 0,
          averagePercentage: 0,
          results: [],
        });
      }

      const summary = bySessionMap.get(reportCard.academicSession.id);

      if (!summary) {
        continue;
      }

      summary.examCount += 1;
      summary.results.push({
        id: reportCard.id,
        examId: reportCard.examId,
        examName: reportCard.exam.examName,
        examCode: reportCard.exam.examCode,
        examType: reportCard.exam.examType,
        startDate: reportCard.exam.startDate,
        endDate: reportCard.exam.endDate,
        totalMarks: Number(reportCard.totalMarks),
        obtainedMarks: Number(reportCard.obtainedMarks),
        percentage: Number(reportCard.percentage),
        grade: reportCard.overallGrade,
        publishedAt: reportCard.publishedAt,
        createdAt: reportCard.createdAt,
      });
    }

    const bySession = Array.from(bySessionMap.values())
      .map((summary) => {
        const totalPercentage = summary.results.reduce(
          (aggregate, result) => aggregate + result.percentage,
          0,
        );

        return {
          ...summary,
          averagePercentage:
            summary.results.length > 0
              ? Number((totalPercentage / summary.results.length).toFixed(2))
              : 0,
          results: summary.results.sort(
            (left, right) =>
              new Date(right.startDate).getTime() -
              new Date(left.startDate).getTime(),
          ),
        };
      })
      .sort((left, right) => left.session.name.localeCompare(right.session.name));

    const overall = reportCards.reduce(
      (aggregate, reportCard) => ({
        examCount: aggregate.examCount + 1,
        totalMarks: aggregate.totalMarks + Number(reportCard.totalMarks),
        obtainedMarks: aggregate.obtainedMarks + Number(reportCard.obtainedMarks),
        averagePercentage: 0,
      }),
      {
        examCount: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        averagePercentage: 0,
      },
    );

    return {
      overall: {
        examCount: overall.examCount,
        totalMarks: Number(overall.totalMarks.toFixed(2)),
        obtainedMarks: Number(overall.obtainedMarks.toFixed(2)),
        averagePercentage:
          reportCards.length > 0
            ? Number(
                (
                  reportCards.reduce(
                    (aggregate, reportCard) =>
                      aggregate + Number(reportCard.percentage),
                    0,
                  ) / reportCards.length
                ).toFixed(2),
              )
            : 0,
      },
      bySession,
    };
  }

  private filterResultBySession(
    summary: ReturnType<StudentsService['buildResultHistory']>,
    sessionId: string,
  ) {
    const matchedSession = summary.bySession.filter(
      (entry) => entry.session.id === sessionId,
    );
    const aggregate = matchedSession.reduce(
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
        resultsCount: memo.resultsCount + entry.results.length,
      }),
      {
        examCount: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        percentageTotal: 0,
        resultsCount: 0,
      },
    );

    return {
      overall: {
        examCount: aggregate.examCount,
        totalMarks: Number(aggregate.totalMarks.toFixed(2)),
        obtainedMarks: Number(aggregate.obtainedMarks.toFixed(2)),
        averagePercentage:
          aggregate.resultsCount > 0
            ? Number(
                (aggregate.percentageTotal / aggregate.resultsCount).toFixed(2),
              )
            : 0,
      },
      bySession: matchedSession,
    };
  }

  private serializeStudent(student: StudentWithDetails) {
    const latestAdmission = student.admissions[0] ?? null;

    return {
      id: student.id,
      name: student.fullName,
      registrationNumber: student.registrationNumber,
      admissionNo: latestAdmission?.admissionNo ?? null,
      studentCode: student.studentCode,
      email: student.email,
      phone: student.phone,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      joinedOn: student.joinedOn,
      sessionId: latestAdmission?.sessionId ?? null,
      session: latestAdmission?.academicSession
        ? {
            id: latestAdmission.academicSession.id,
            name: latestAdmission.academicSession.sessionName,
            isCurrent: latestAdmission.academicSession.isCurrent,
            isActive: latestAdmission.academicSession.isActive,
          }
        : null,
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
      schoolId: student.schoolId,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      status: student.status,
    };
  }
}
