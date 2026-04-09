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
  PromotionAction,
  RoleType,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { BulkPromoteStudentsDto } from './dto/bulk-promote-students.dto';
import { PromotionPreviewDto } from './dto/promotion-preview.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const promotionHistorySelect = Prisma.validator<Prisma.PromotionHistorySelect>()({
  id: true,
  schoolId: true,
  action: true,
  remarks: true,
  promotedAt: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      fullName: true,
      studentCode: true,
    },
  },
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
      sessionId: true,
      classId: true,
      sectionId: true,
    },
  },
  toEnrollment: {
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      sessionId: true,
      classId: true,
      sectionId: true,
    },
  },
  promotedByUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
});

const eligibleStudentSelect = Prisma.validator<Prisma.StudentSelect>()({
  id: true,
  schoolId: true,
  fullName: true,
  studentCode: true,
  email: true,
  phone: true,
  admissions: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      sessionId: true,
      classId: true,
      sectionId: true,
      admissionStatus: true,
      academicSession: {
        select: {
          id: true,
          sessionName: true,
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
    where: {},
  },
});

type PromotionHistoryRecord = Prisma.PromotionHistoryGetPayload<{
  select: typeof promotionHistorySelect;
}>;

type EligibleStudentRecord = Prisma.StudentGetPayload<{
  select: typeof eligibleStudentSelect;
}>;

type PromotionTargetContext = {
  fromSession: {
    id: string;
    sessionName: string;
  };
  toSession: {
    id: string;
    sessionName: string;
  };
  fromClass: {
    id: string;
    className: string;
  };
  toClass: {
    id: string;
    className: string;
  };
  fromSection: {
    id: string;
    classId: string;
    sectionName: string;
  } | null;
  toSection: {
    id: string;
    classId: string;
    sectionName: string;
  } | null;
};

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findOptions(currentUser: JwtUser, schoolId?: string | null) {
    const resolvedSchoolId = this.resolveRequiredReadSchoolScope(
      currentUser,
      schoolId,
      'schoolId is required to load promotion options for a platform-scoped super admin.',
    );

    const [sessions, classes] = await Promise.all([
      this.prisma.academicSession.findMany({
        where: {
          schoolId: resolvedSchoolId,
        },
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        select: {
          id: true,
          sessionName: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          isActive: true,
        },
      }),
      this.prisma.academicClass.findMany({
        where: {
          schoolId: resolvedSchoolId,
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

    const currentSession = sessions.find((session) => session.isCurrent) ?? null;

    return {
      success: true,
      message: 'Promotion options fetched successfully.',
      data: {
        currentSessionId: currentSession?.id ?? null,
        academicSessions: sessions.map((session) => ({
          id: session.id,
          name: session.sessionName,
          startDate: session.startDate,
          endDate: session.endDate,
          isCurrent: session.isCurrent,
          status: this.serializeSessionStatus(session.isActive, session.endDate),
        })),
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

  async findEligibleStudents(currentUser: JwtUser, query: PromotionQueryDto) {
    const schoolId = this.resolveRequiredReadSchoolScope(
      currentUser,
      query.schoolId,
      'schoolId is required to load promotable students for a platform-scoped super admin.',
    );
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    if (!query.fromAcademicSessionId || !query.fromClassId) {
      return {
        success: true,
        message: 'Promotable students fetched successfully.',
        data: [],
        meta: {
          page,
          limit,
          total: 0,
        },
      };
    }

    await this.validatePromotionTargets({
      schoolId,
      fromAcademicSessionId: query.fromAcademicSessionId,
      toAcademicSessionId: query.toAcademicSessionId,
      fromClassId: query.fromClassId,
      toClassId: query.toClassId,
      fromSectionId: query.fromSectionId,
      toSectionId: query.toSectionId,
      action: query.action,
    });

    const admissionWhere = this.buildSourceAdmissionWhere(
      schoolId,
      query.fromAcademicSessionId,
      query.fromClassId,
      query.fromSectionId,
    );

    const where: Prisma.StudentWhereInput = {
      schoolId,
      status: {
        not: StudentStatus.INACTIVE,
      },
      admissions: {
        some: admissionWhere,
      },
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
                studentCode: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                admissions: {
                  some: {
                    ...admissionWhere,
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
        orderBy: {
          fullName: 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...eligibleStudentSelect,
          admissions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            where: admissionWhere,
            select: eligibleStudentSelect.admissions.select,
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      success: true,
      message: 'Promotable students fetched successfully.',
      data: students.map((student) => this.serializeEligibleStudent(student)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async previewPromotions(currentUser: JwtUser, dto: PromotionPreviewDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const uniqueStudentIds = Array.from(new Set(dto.studentIds ?? []));
    const sourceAdmissionWhere = this.buildSourceAdmissionWhere(
      schoolId,
      dto.fromAcademicSessionId,
      dto.fromClassId,
      dto.fromSectionId,
    );
    const targets = await this.loadPromotionTargets(this.prisma, schoolId, {
      fromAcademicSessionId: dto.fromAcademicSessionId,
      toAcademicSessionId: dto.toAcademicSessionId,
      fromClassId: dto.fromClassId,
      toClassId: dto.toClassId,
      fromSectionId: dto.fromSectionId,
      toSectionId: dto.toSectionId,
      action: dto.action,
    });

    const students = uniqueStudentIds.length
      ? await this.prisma.student.findMany({
          where: {
            schoolId,
            id: {
              in: uniqueStudentIds,
            },
            status: {
              not: StudentStatus.INACTIVE,
            },
          },
          select: {
            ...eligibleStudentSelect,
            admissions: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              where: sourceAdmissionWhere,
              select: eligibleStudentSelect.admissions.select,
            },
          },
        })
      : await this.prisma.student.findMany({
          where: {
            schoolId,
            status: {
              not: StudentStatus.INACTIVE,
            },
            admissions: {
              some: sourceAdmissionWhere,
            },
          },
          orderBy: {
            fullName: 'asc',
          },
          select: {
            ...eligibleStudentSelect,
            admissions: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              where: sourceAdmissionWhere,
              select: eligibleStudentSelect.admissions.select,
            },
          },
        });

    const studentMap = new Map(
      students.map((student) => [student.id, student] as const),
    );
    const orderedStudents = uniqueStudentIds.length
      ? uniqueStudentIds.map((studentId) => studentMap.get(studentId) ?? null)
      : students;

    const items = await Promise.all(
      orderedStudents.map((student) =>
        this.buildPromotionPreviewItem(schoolId, student, targets, dto.action),
      ),
    );

    const summary = {
      total: items.length,
      valid: items.filter((item) => item.status === 'VALID').length,
      skipped: items.filter((item) => item.status === 'ALREADY_PROMOTED').length,
      errors: items.filter((item) => item.status !== 'VALID' && item.status !== 'ALREADY_PROMOTED').length,
    };

    return {
      success: true,
      message: 'Promotion preview generated successfully.',
      data: {
        items,
        summary,
      },
    };
  }

  async promoteStudent(currentUser: JwtUser, dto: PromoteStudentDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const promotion = await this.executePromotion(currentUser, schoolId, dto);

    return {
      success: true,
      message:
        dto.action === PromotionAction.DETAINED
          ? 'Student detained successfully.'
          : 'Student promoted successfully.',
      data: this.serializePromotion(promotion),
    };
  }

  async bulkPromoteStudents(currentUser: JwtUser, dto: BulkPromoteStudentsDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const successes: Array<ReturnType<PromotionsService['serializePromotion']>> = [];
    const failures: Array<{ studentId: string; reason: string }> = [];

    for (const studentId of dto.studentIds) {
      try {
        const promotion = await this.executePromotion(currentUser, schoolId, {
          ...dto,
          studentId,
        });
        successes.push(this.serializePromotion(promotion));
      } catch (error) {
        failures.push({
          studentId,
          reason:
            error instanceof Error ? error.message : 'Failed to process promotion.',
        });
      }
    }

    return {
      success: true,
      message: 'Bulk promotion processed.',
      data: {
        total: dto.studentIds.length,
        promoted: successes.length,
        failed: failures.length,
        successes,
        failures,
      },
    };
  }

  async findPromotions(currentUser: JwtUser, query: PromotionQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const payload = await this.findPromotionHistory({
      schoolId,
      query,
      page,
      limit,
      search,
    });

    return {
      success: true,
      message: 'Promotion history fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findStudentPromotions(
    currentUser: JwtUser,
    studentId: string,
    query: PromotionQueryDto,
  ) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);

    await this.validateStudentScope(studentId, schoolId);

    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const payload = await this.findPromotionHistory({
      schoolId,
      query: {
        ...query,
        studentId,
      },
      page,
      limit,
      search,
    });

    return {
      success: true,
      message: 'Student promotion history fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findClassPromotions(
    currentUser: JwtUser,
    classId: string,
    query: PromotionQueryDto,
  ) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);

    await this.validateClassScope(classId, schoolId);

    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const payload = await this.findPromotionHistory({
      schoolId,
      query,
      page,
      limit,
      search,
      classId,
    });

    return {
      success: true,
      message: 'Class promotion history fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  private buildSourceAdmissionWhere(
    schoolId: string,
    fromAcademicSessionId: string,
    fromClassId: string,
    fromSectionId?: string | null,
  ): Prisma.AdmissionWhereInput {
    return {
      schoolId,
      sessionId: fromAcademicSessionId,
      classId: fromClassId,
      ...(fromSectionId ? { sectionId: fromSectionId } : {}),
      admissionStatus: AdmissionStatus.ACTIVE,
    };
  }

  private async findPromotionHistory({
    schoolId,
    query,
    page,
    limit,
    search,
    classId,
  }: {
    schoolId: string | null;
    query: PromotionQueryDto;
    page: number;
    limit: number;
    search: string;
    classId?: string;
  }) {
    const where = this.buildPromotionHistoryWhere({
      schoolId,
      query,
      search,
      classId,
    });

    const [records, total] = await Promise.all([
      this.prisma.promotionHistory.findMany({
        where,
        orderBy: [{ promotedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: promotionHistorySelect,
      }),
      this.prisma.promotionHistory.count({ where }),
    ]);

    return {
      items: records.map((record) => this.serializePromotion(record)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  private buildPromotionHistoryWhere({
    schoolId,
    query,
    search,
    classId,
  }: {
    schoolId: string | null;
    query: PromotionQueryDto;
    search: string;
    classId?: string;
  }): Prisma.PromotionHistoryWhereInput {
    return {
      ...(schoolId ? { schoolId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.fromAcademicSessionId
        ? { fromAcademicSessionId: query.fromAcademicSessionId }
        : {}),
      ...(query.toAcademicSessionId
        ? { toAcademicSessionId: query.toAcademicSessionId }
        : {}),
      ...(query.fromClassId ? { fromClassId: query.fromClassId } : {}),
      ...(query.toClassId ? { toClassId: query.toClassId } : {}),
      ...(query.fromSectionId ? { fromSectionId: query.fromSectionId } : {}),
      ...(query.toSectionId ? { toSectionId: query.toSectionId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(classId
        ? {
            OR: [
              { fromClassId: classId },
              { toClassId: classId },
            ],
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  {
                    student: {
                      fullName: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    student: {
                      studentCode: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    fromEnrollment: {
                      admissionNo: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    toEnrollment: {
                      admissionNo: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
  }

  private async validateStudentScope(studentId: string, schoolId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }
  }

  private async validateClassScope(classId: string, schoolId: string | null) {
    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        id: classId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }
  }

  private async buildPromotionPreviewItem(
    schoolId: string,
    student: EligibleStudentRecord | null,
    targets: PromotionTargetContext,
    action: PromotionAction,
  ) {
    const sourceEnrollment = student?.admissions[0] ?? null;
    const targetEnrollmentPreview = this.serializeTargetEnrollmentPreview(targets);

    if (!student) {
      return {
        student: null,
        currentEnrollment: null,
        targetEnrollment: targetEnrollmentPreview,
        action,
        status: 'INVALID_DATA' as const,
        message: 'Student not found for this school.',
      };
    }

    const [existingTargetEnrollment, existingPromotion] = await Promise.all([
      this.prisma.admission.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          sessionId: targets.toSession.id,
        },
        select: {
          id: true,
          admissionNo: true,
        },
      }),
      this.prisma.promotionHistory.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          toAcademicSessionId: targets.toSession.id,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (existingTargetEnrollment || existingPromotion) {
      return {
        student: this.serializePreviewStudent(student),
        currentEnrollment: sourceEnrollment
          ? this.serializePreviewEnrollment(sourceEnrollment)
          : null,
        targetEnrollment: targetEnrollmentPreview,
        action,
        status: 'ALREADY_PROMOTED' as const,
        message: existingTargetEnrollment
          ? `Enrollment ${existingTargetEnrollment.admissionNo} already exists in the target academic session.`
          : 'Promotion history already exists for the target academic session.',
      };
    }

    if (!sourceEnrollment) {
      return {
        student: this.serializePreviewStudent(student),
        currentEnrollment: null,
        targetEnrollment: targetEnrollmentPreview,
        action,
        status: 'INVALID_DATA' as const,
        message: 'Active source enrollment not found for the selected session and class.',
      };
    }

    const resolvedSourceEnrollment = sourceEnrollment;

    return {
      student: this.serializePreviewStudent(student),
      currentEnrollment: this.serializePreviewEnrollment(resolvedSourceEnrollment),
      targetEnrollment: targetEnrollmentPreview,
      action,
      status: 'VALID' as const,
      message: 'Ready to promote.',
    };
  }

  private async loadPromotionTargets(
    db: PrismaService | Prisma.TransactionClient,
    schoolId: string,
    dto: {
      fromAcademicSessionId: string;
      toAcademicSessionId: string;
      fromClassId: string;
      toClassId: string;
      fromSectionId?: string | null;
      toSectionId?: string | null;
      action?: PromotionAction;
    },
  ): Promise<PromotionTargetContext> {
    const [fromSession, toSession, fromClass, toClass, fromSection, toSection] =
      await Promise.all([
        db.academicSession.findFirst({
          where: {
            id: dto.fromAcademicSessionId,
            schoolId,
          },
          select: {
            id: true,
            sessionName: true,
          },
        }),
        db.academicSession.findFirst({
          where: {
            id: dto.toAcademicSessionId,
            schoolId,
          },
          select: {
            id: true,
            sessionName: true,
          },
        }),
        db.academicClass.findFirst({
          where: {
            id: dto.fromClassId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
            className: true,
          },
        }),
        db.academicClass.findFirst({
          where: {
            id: dto.toClassId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
            className: true,
          },
        }),
        dto.fromSectionId
          ? db.section.findFirst({
              where: {
                id: dto.fromSectionId,
                schoolId,
                isActive: true,
              },
              select: {
                id: true,
                classId: true,
                sectionName: true,
              },
            })
          : Promise.resolve(null),
        dto.toSectionId
          ? db.section.findFirst({
              where: {
                id: dto.toSectionId,
                schoolId,
                isActive: true,
              },
              select: {
                id: true,
                classId: true,
                sectionName: true,
              },
            })
          : Promise.resolve(null),
      ]);

    if (!fromSession) {
      throw new NotFoundException('Source academic session not found.');
    }

    if (!toSession) {
      throw new NotFoundException('Target academic session not found.');
    }

    if (!fromClass) {
      throw new NotFoundException('Source class not found.');
    }

    if (!toClass) {
      throw new NotFoundException('Target class not found.');
    }

    if (fromSection && fromSection.classId !== fromClass.id) {
      throw new BadRequestException('Source section does not belong to source class.');
    }

    if (toSection && toSection.classId !== toClass.id) {
      throw new BadRequestException('Target section does not belong to target class.');
    }

    if (dto.fromAcademicSessionId === dto.toAcademicSessionId) {
      throw new BadRequestException(
        'Source and target academic sessions must be different.',
      );
    }

    if (
      dto.action === PromotionAction.PROMOTED &&
      dto.fromClassId === dto.toClassId &&
      (dto.fromSectionId ?? null) === (dto.toSectionId ?? null)
    ) {
      throw new BadRequestException(
        'Use detained action when the student remains in the same class and section.',
      );
    }

    if (
      dto.action === PromotionAction.DETAINED &&
      dto.fromClassId !== dto.toClassId
    ) {
      throw new BadRequestException(
        'Detained students must remain in the same class for the target session.',
      );
    }

    return {
      fromSession,
      toSession,
      fromClass,
      toClass,
      fromSection,
      toSection,
    };
  }

  private async executePromotion(
    currentUser: JwtUser,
    schoolId: string,
    dto: {
      studentId: string;
      fromAcademicSessionId: string;
      toAcademicSessionId: string;
      fromClassId: string;
      toClassId: string;
      fromSectionId?: string | null;
      toSectionId?: string | null;
      fromEnrollmentId?: string | null;
      action: PromotionAction;
      remarks?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.validatePromotionContext(tx, schoolId, dto);
      const admissionNo = await this.generateAdmissionNo(tx, schoolId);
      const targetAdmission = await tx.admission.create({
        data: {
          schoolId,
          studentId: context.student.id,
          sessionId: context.toSession.id,
          classId: context.toClass.id,
          sectionId: context.toSection?.id ?? null,
          admissionNo,
          rollNo: null,
          admissionDate: new Date(),
          admissionStatus: AdmissionStatus.ACTIVE,
          remarks: dto.remarks ?? null,
        },
      });

      await tx.admission.update({
        where: {
          id: context.sourceEnrollment.id,
        },
        data: {
          admissionStatus:
            dto.action === PromotionAction.PROMOTED
              ? AdmissionStatus.PROMOTED
              : AdmissionStatus.COMPLETED,
          remarks: dto.remarks ?? context.sourceEnrollment.remarks ?? null,
        },
      });

      const promotion = await tx.promotionHistory.create({
        data: {
          schoolId,
          studentId: context.student.id,
          fromAcademicSessionId: context.fromSession.id,
          toAcademicSessionId: context.toSession.id,
          fromClassId: context.fromClass.id,
          toClassId: context.toClass.id,
          fromSectionId: context.fromSection?.id ?? null,
          toSectionId: context.toSection?.id ?? null,
          fromEnrollmentId: context.sourceEnrollment.id,
          toEnrollmentId: targetAdmission.id,
          action: dto.action,
          remarks: dto.remarks ?? null,
          promotedByUserId: currentUser.id,
        },
        select: promotionHistorySelect,
      });

      await this.auditService.write({
        action:
          dto.action === PromotionAction.DETAINED
            ? 'promotions.detain'
            : 'promotions.promote',
        entity: 'promotion_history',
        entityId: promotion.id,
        actorUserId: currentUser.id,
        schoolId,
        metadata: {
          studentId: context.student.id,
          fromAcademicSessionId: context.fromSession.id,
          toAcademicSessionId: context.toSession.id,
          action: dto.action,
        },
      });

      return promotion;
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });
  }

  private async validatePromotionContext(
    tx: Prisma.TransactionClient,
    schoolId: string,
    dto: {
      studentId: string;
      fromAcademicSessionId: string;
      toAcademicSessionId: string;
      fromClassId: string;
      toClassId: string;
      fromSectionId?: string | null;
      toSectionId?: string | null;
      fromEnrollmentId?: string | null;
      action?: PromotionAction;
    },
  ) {
    const {
      fromSession,
      toSession,
      fromClass,
      toClass,
      fromSection,
      toSection,
    } = await this.loadPromotionTargets(tx, schoolId, {
      fromAcademicSessionId: dto.fromAcademicSessionId,
      toAcademicSessionId: dto.toAcademicSessionId,
      fromClassId: dto.fromClassId,
      toClassId: dto.toClassId,
      fromSectionId: dto.fromSectionId,
      toSectionId: dto.toSectionId,
      action: dto.action,
    });

    const student = await tx.student.findFirst({
      where: {
        id: dto.studentId,
        schoolId,
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      select: {
        id: true,
        fullName: true,
        studentCode: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    if (!dto.action) {
      throw new BadRequestException('Promotion action is required.');
    }

    const [existingTargetEnrollment, existingPromotion] = await Promise.all([
      tx.admission.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          sessionId: toSession.id,
        },
        select: {
          id: true,
        },
      }),
      tx.promotionHistory.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          toAcademicSessionId: toSession.id,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (existingTargetEnrollment || existingPromotion) {
      throw new ConflictException(
        'Target enrollment already exists for this student in the selected academic session.',
      );
    }

    const sourceEnrollment = await tx.admission.findFirst({
      where: {
        id: dto.fromEnrollmentId ?? undefined,
        schoolId,
        studentId: student.id,
        sessionId: fromSession.id,
        classId: fromClass.id,
        ...(dto.fromSectionId ? { sectionId: dto.fromSectionId } : {}),
        admissionStatus: AdmissionStatus.ACTIVE,
      },
    });

    if (!sourceEnrollment) {
      throw new NotFoundException('Active source enrollment not found for this student.');
    }

    if (dto.fromEnrollmentId && sourceEnrollment.id !== dto.fromEnrollmentId) {
      throw new BadRequestException('Source enrollment does not match selected filters.');
    }

    return {
      student,
      fromSession,
      toSession,
      fromClass,
      toClass,
      fromSection,
      toSection,
      sourceEnrollment,
    };
  }

  private async validatePromotionTargets({
    schoolId,
    fromAcademicSessionId,
    toAcademicSessionId,
    fromClassId,
    toClassId,
    fromSectionId,
    toSectionId,
    action,
    tx,
  }: {
    schoolId: string;
    fromAcademicSessionId?: string;
    toAcademicSessionId?: string;
    fromClassId?: string;
    toClassId?: string;
    fromSectionId?: string;
    toSectionId?: string;
    action?: PromotionAction;
    tx?: Prisma.TransactionClient;
  }) {
    const db = tx ?? this.prisma;
    const lookups: Promise<unknown>[] = [];

    if (fromAcademicSessionId) {
      lookups.push(
        db.academicSession.findFirst({
          where: {
            id: fromAcademicSessionId,
            schoolId,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Source academic session not found.');
          }
        }),
      );
    }

    if (toAcademicSessionId) {
      lookups.push(
        db.academicSession.findFirst({
          where: {
            id: toAcademicSessionId,
            schoolId,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Target academic session not found.');
          }
        }),
      );
    }

    if (fromClassId) {
      lookups.push(
        db.academicClass.findFirst({
          where: {
            id: fromClassId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Source class not found.');
          }
        }),
      );
    }

    if (toClassId) {
      lookups.push(
        db.academicClass.findFirst({
          where: {
            id: toClassId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Target class not found.');
          }
        }),
      );
    }

    if (fromSectionId) {
      lookups.push(
        db.section.findFirst({
          where: {
            id: fromSectionId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Source section not found.');
          }
        }),
      );
    }

    if (toSectionId) {
      lookups.push(
        db.section.findFirst({
          where: {
            id: toSectionId,
            schoolId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }).then((record) => {
          if (!record) {
            throw new NotFoundException('Target section not found.');
          }
        }),
      );
    }

    await Promise.all(lookups);

    if (
      action === PromotionAction.DETAINED &&
      fromClassId &&
      toClassId &&
      fromClassId !== toClassId
    ) {
      throw new BadRequestException(
        'Detained students must stay in the same class for the next session.',
      );
    }
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for super admin promotion actions.',
        );
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This endpoint requires a school-scoped authenticated user.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You can only manage promotions for your own school.');
    }

    return currentUser.schoolId;
  }

  private resolveReadSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This endpoint requires a school-scoped authenticated user.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You can only access promotions for your own school.');
    }

    return currentUser.schoolId;
  }

  private resolveRequiredReadSchoolScope(
    currentUser: JwtUser,
    schoolId: string | null | undefined,
    message: string,
  ) {
    const resolvedSchoolId = this.resolveReadSchoolScope(currentUser, schoolId);

    if (!resolvedSchoolId) {
      throw new BadRequestException(message);
    }

    return resolvedSchoolId;
  }

  private serializeSessionStatus(isActive: boolean, endDate: Date) {
    const today = this.todayDate();

    if (!isActive && endDate.getTime() <= today.getTime()) {
      return 'COMPLETED';
    }

    return isActive ? 'ACTIVE' : 'INACTIVE';
  }

  private todayDate() {
    const now = new Date();

    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
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
        select: {
          id: true,
        },
      });

      if (!existingAdmission) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique admission number.');
  }

  private serializeEligibleStudent(student: EligibleStudentRecord) {
    const sourceEnrollment = student.admissions[0] ?? null;

    return {
      id: student.id,
      schoolId: student.schoolId,
      name: student.fullName,
      studentCode: student.studentCode,
      email: student.email,
      phone: student.phone,
      sourceEnrollment: sourceEnrollment
        ? {
            id: sourceEnrollment.id,
            admissionNo: sourceEnrollment.admissionNo,
            rollNo: sourceEnrollment.rollNo,
            status: sourceEnrollment.admissionStatus,
            academicSession: {
              id: sourceEnrollment.academicSession.id,
              name: sourceEnrollment.academicSession.sessionName,
            },
            academicClass: {
              id: sourceEnrollment.academicClass.id,
              name: sourceEnrollment.academicClass.className,
            },
            section: sourceEnrollment.section
              ? {
                  id: sourceEnrollment.section.id,
                  name: sourceEnrollment.section.sectionName,
                }
              : null,
          }
        : null,
    };
  }

  private serializePreviewStudent(student: EligibleStudentRecord) {
    return {
      id: student.id,
      schoolId: student.schoolId,
      name: student.fullName,
      studentCode: student.studentCode,
      email: student.email,
      phone: student.phone,
    };
  }

  private serializePreviewEnrollment(
    enrollment: EligibleStudentRecord['admissions'][number],
  ) {
    return {
      id: enrollment.id,
      admissionNo: enrollment.admissionNo,
      rollNo: enrollment.rollNo,
      status: enrollment.admissionStatus,
      academicSession: {
        id: enrollment.academicSession.id,
        name: enrollment.academicSession.sessionName,
      },
      academicClass: {
        id: enrollment.academicClass.id,
        name: enrollment.academicClass.className,
      },
      section: enrollment.section
        ? {
            id: enrollment.section.id,
            name: enrollment.section.sectionName,
          }
        : null,
    };
  }

  private serializeTargetEnrollmentPreview(targets: PromotionTargetContext) {
    return {
      academicSession: {
        id: targets.toSession.id,
        name: targets.toSession.sessionName,
      },
      academicClass: {
        id: targets.toClass.id,
        name: targets.toClass.className,
      },
      section: targets.toSection
        ? {
            id: targets.toSection.id,
            name: targets.toSection.sectionName,
          }
        : null,
    };
  }

  private serializePromotion(record: PromotionHistoryRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      action: record.action,
      remarks: record.remarks,
      promotedAt: record.promotedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      student: {
        id: record.student.id,
        name: record.student.fullName,
        studentCode: record.student.studentCode,
      },
      fromAcademicSession: {
        id: record.fromAcademicSession.id,
        name: record.fromAcademicSession.sessionName,
      },
      toAcademicSession: {
        id: record.toAcademicSession.id,
        name: record.toAcademicSession.sessionName,
      },
      fromClass: {
        id: record.fromClass.id,
        name: record.fromClass.className,
      },
      toClass: {
        id: record.toClass.id,
        name: record.toClass.className,
      },
      fromSection: record.fromSection
        ? {
            id: record.fromSection.id,
            name: record.fromSection.sectionName,
          }
        : null,
      toSection: record.toSection
        ? {
            id: record.toSection.id,
            name: record.toSection.sectionName,
          }
        : null,
      fromEnrollment: {
        id: record.fromEnrollment.id,
        admissionNo: record.fromEnrollment.admissionNo,
        rollNo: record.fromEnrollment.rollNo,
      },
      toEnrollment: {
        id: record.toEnrollment.id,
        admissionNo: record.toEnrollment.admissionNo,
        rollNo: record.toEnrollment.rollNo,
      },
      promotedBy: record.promotedByUser
        ? {
            id: record.promotedByUser.id,
            name: record.promotedByUser.fullName,
          }
        : null,
    };
  }
}
