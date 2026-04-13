import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HolidayAudience, HolidayType, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';

const holidayInclude = Prisma.validator<Prisma.HolidayInclude>()({
  targetClasses: {
    include: {
      academicClass: {
        select: {
          id: true,
          className: true,
          classCode: true,
        },
      },
    },
  },
});

type HolidayRecord = Prisma.HolidayGetPayload<{
  include: typeof holidayInclude;
}>;

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateHolidayDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const audience = dto.audience ?? HolidayAudience.ALL;
    const allClasses = dto.allClasses ?? true;
    const classIds = Array.from(new Set(dto.classIds ?? []));

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate.');
    }

    if (!allClasses && classIds.length === 0) {
      throw new BadRequestException(
        'Select at least one class when the holiday is not for all classes.',
      );
    }

    if (classIds.length > 0) {
      const classCount = await this.prisma.academicClass.count({
        where: {
          schoolId,
          id: {
            in: classIds,
          },
          isActive: true,
        },
      });

      if (classCount !== classIds.length) {
        throw new NotFoundException('One or more selected classes were not found.');
      }
    }

    const holiday = await this.prisma.holiday.create({
      data: {
        schoolId,
        title: dto.title.trim(),
        startDate,
        endDate,
        type: dto.type,
        audience,
        allClasses,
        targetClasses: allClasses
          ? undefined
          : {
              create: classIds.map((classId) => ({
                schoolId,
                classId,
              })),
            },
      },
      include: holidayInclude,
    });

    await this.auditService.write({
      action: 'holidays.create',
      entity: 'holiday',
      entityId: holiday.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        title: holiday.title,
        type: holiday.type,
        audience: holiday.audience,
      },
    });

    return {
      success: true,
      message: 'Holiday created successfully.',
      data: this.serialize(holiday),
    };
  }

  async findAll(currentUser: JwtUser, query: HolidayQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const visibilityFilter = await this.buildVisibilityFilter(currentUser, schoolId);
    const holidays = await this.prisma.holiday.findMany({
      where: {
        schoolId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.audience ? { audience: query.audience } : {}),
        ...visibilityFilter,
      },
      include: holidayInclude,
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      success: true,
      message: 'Holidays fetched successfully.',
      data: holidays.map((holiday) => this.serialize(holiday)),
    };
  }

  async findPortal(currentUser: JwtUser) {
    return this.findAll(currentUser, {} as HolidayQueryDto);
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);
    const classes = await this.prisma.academicClass.findMany({
      where: {
        schoolId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
      select: {
        id: true,
        className: true,
        classCode: true,
      },
    });

    return {
      success: true,
      message: 'Holiday options fetched successfully.',
      data: {
        audiences: Object.values(HolidayAudience),
        classes: classes.map((item) => ({
          id: item.id,
          name: item.className,
          classCode: item.classCode,
        })),
      },
    };
  }

  async getUpcomingForSchool(
    currentUser: JwtUser,
    schoolId: string,
    type?: HolidayType,
  ) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const visibilityFilter = await this.buildVisibilityFilter(currentUser, schoolId);

    const holidays = await this.prisma.holiday.findMany({
      where: {
        schoolId,
        ...(type ? { type } : {}),
        endDate: {
          gte: today,
        },
        ...visibilityFilter,
      },
      include: holidayInclude,
      orderBy: [{ startDate: 'asc' }],
      take: 10,
    });

    return holidays.map((holiday) => this.serialize(holiday));
  }

  private resolveSchoolScope(currentUser: JwtUser, schoolIdOverride?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const schoolId = schoolIdOverride ?? currentUser.schoolId ?? null;
      if (!schoolId) {
        throw new BadRequestException('schoolId is required for this action.');
      }
      return schoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolIdOverride && schoolIdOverride !== currentUser.schoolId) {
      throw new NotFoundException('Holiday not found.');
    }

    return currentUser.schoolId;
  }

  private async buildVisibilityFilter(currentUser: JwtUser, schoolId: string) {
    if (
      currentUser.role === RoleType.SUPER_ADMIN ||
      currentUser.role === RoleType.SCHOOL_ADMIN
    ) {
      return {};
    }

    if (currentUser.role === RoleType.TEACHER || currentUser.role === RoleType.STAFF) {
      return {
        audience: {
          in: [HolidayAudience.ALL, HolidayAudience.STAFF],
        },
      } satisfies Prisma.HolidayWhereInput;
    }

    const targetClassIds = await this.resolveStudentAudienceClassIds(currentUser, schoolId);

    return {
      audience: {
        in: [HolidayAudience.ALL, HolidayAudience.STUDENT],
      },
      OR: [
        {
          allClasses: true,
        },
        ...(targetClassIds.length
          ? [
              {
                targetClasses: {
                  some: {
                    classId: {
                      in: targetClassIds,
                    },
                  },
                },
              },
            ]
          : []),
      ],
    } satisfies Prisma.HolidayWhereInput;
  }

  private async resolveStudentAudienceClassIds(currentUser: JwtUser, schoolId: string) {
    if (currentUser.role === RoleType.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.id,
          schoolId,
        },
        select: {
          admissions: {
            where: {
              admissionStatus: {
                in: ['ACTIVE', 'PROMOTED'],
              },
            },
            orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              classId: true,
            },
          },
        },
      });

      return student?.admissions.map((item: { classId: string }) => item.classId) ?? [];
    }

    if (currentUser.role === RoleType.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.id,
          schoolId,
        },
        select: {
          parentStudents: {
            select: {
              student: {
                select: {
                  admissions: {
                    where: {
                      admissionStatus: {
                        in: ['ACTIVE', 'PROMOTED'],
                      },
                    },
                    orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
                    take: 1,
                    select: {
                      classId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return Array.from(
        new Set(
          (parent?.parentStudents ?? [])
            .flatMap((link: { student: { admissions: Array<{ classId: string }> } }) =>
              link.student.admissions.map((admission) => admission.classId),
            )
            .filter(Boolean),
        ),
      );
    }

    return [];
  }

  private serialize(record: HolidayRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      title: record.title,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      type: record.type,
      audience: record.audience,
      allClasses: record.allClasses,
      classIds: record.targetClasses.map((item) => item.classId),
      classes: record.targetClasses.map((item) => ({
        id: item.academicClass.id,
        name: item.academicClass.className,
        classCode: item.academicClass.classCode,
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
