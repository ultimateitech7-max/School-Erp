import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  AttendanceStatus,
  Prisma,
  RoleType,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

const ATTENDANCE_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const attendanceInclude = Prisma.validator<Prisma.AttendanceRecordInclude>()({
  student: {
    select: {
      id: true,
      fullName: true,
      studentCode: true,
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
  academicSession: {
    select: {
      id: true,
      sessionName: true,
      isCurrent: true,
    },
  },
  markedByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
});

type AttendanceWithDetails = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceInclude;
}>;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);

    const [currentSession, classes, students] = await Promise.all([
      this.resolveAcademicSession(schoolId),
      this.prisma.academicClass.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          classCode: true,
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
      this.prisma.student.findMany({
        where: {
          schoolId,
          status: {
            not: StudentStatus.INACTIVE,
          },
        },
        orderBy: {
          fullName: 'asc',
        },
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          admissions: {
            where: {
              admissionStatus: AdmissionStatus.ACTIVE,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              classId: true,
              sectionId: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Attendance options fetched successfully.',
      data: {
        currentSessionId: currentSession.id,
        currentSessionName: currentSession.sessionName,
        classes: classes.map((academicClass) => ({
          id: academicClass.id,
          name: academicClass.className,
          classCode: academicClass.classCode,
          sections: academicClass.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
        students: students.map((student) => ({
          id: student.id,
          name: student.fullName,
          studentCode: student.studentCode,
          classId: student.admissions[0]?.classId ?? null,
          sectionId: student.admissions[0]?.sectionId ?? null,
        })),
        statuses: [
          AttendanceStatus.PRESENT,
          AttendanceStatus.ABSENT,
          AttendanceStatus.LATE,
          AttendanceStatus.LEAVE,
        ],
      },
    };
  }

  async create(currentUser: JwtUser, dto: CreateAttendanceDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const attendanceDate = this.normalizeDate(dto.attendanceDate);
    const studentContext = await this.ensureStudentAttendanceContext(
      schoolId,
      dto.studentId,
      dto.classId,
      dto.sectionId,
      dto.sessionId,
    );

    const existingRecord = await this.prisma.attendanceRecord.findUnique({
      where: {
        schoolId_studentId_attendanceDate: {
          schoolId,
          studentId: dto.studentId,
          attendanceDate,
        },
      },
    });

    if (existingRecord) {
      throw new ConflictException(
        'Attendance already marked for this student on the selected date.',
      );
    }

    const attendanceRecord = await this.prisma.attendanceRecord.create({
      data: {
        schoolId,
        sessionId: studentContext.sessionId,
        studentId: dto.studentId,
        classId: studentContext.classId,
        sectionId: studentContext.sectionId,
        attendanceDate,
        status: dto.status as AttendanceStatus,
        remarks: dto.remarks ?? null,
        markedByUserId: currentUser.id,
      },
      include: attendanceInclude,
    });

    await this.invalidateAttendanceCache(schoolId);
    await this.auditService.write({
      action: 'attendance.create',
      entity: 'attendance_record',
      entityId: attendanceRecord.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        studentId: attendanceRecord.studentId,
        attendanceDate: attendanceRecord.attendanceDate.toISOString(),
        status: attendanceRecord.status,
      },
    });

    return {
      success: true,
      message: 'Attendance marked successfully.',
      data: this.serializeAttendance(attendanceRecord),
    };
  }

  async createBulk(currentUser: JwtUser, dto: BulkAttendanceDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const attendanceDate = this.normalizeDate(dto.attendanceDate);
    const session = await this.resolveAcademicSession(schoolId, dto.sessionId);
    await this.ensureClassInSchool(schoolId, dto.classId);

    if (dto.sectionId) {
      await this.ensureSectionInSchool(schoolId, dto.classId, dto.sectionId);
    }

    const uniqueStudentIds = new Set(dto.records.map((record) => record.studentId));

    if (uniqueStudentIds.size !== dto.records.length) {
      throw new BadRequestException(
        'Duplicate student ids are not allowed in bulk attendance.',
      );
    }

    await Promise.all(
      dto.records.map((record) =>
        this.ensureStudentAttendanceContext(
          schoolId,
          record.studentId,
          dto.classId,
          dto.sectionId,
          session.id,
        ),
      ),
    );

    const existingRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        schoolId,
        attendanceDate,
        studentId: {
          in: dto.records.map((record) => record.studentId),
        },
      },
      select: {
        studentId: true,
      },
    });

    if (existingRecords.length > 0) {
      throw new ConflictException(
        'Attendance already exists for one or more selected students on this date.',
      );
    }

    const createdRecords = await this.prisma.$transaction(async (tx) => {
      const records: AttendanceWithDetails[] = [];

      for (const record of dto.records) {
        const createdRecord = await tx.attendanceRecord.create({
          data: {
            schoolId,
            sessionId: session.id,
            studentId: record.studentId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            attendanceDate,
            status: record.status as AttendanceStatus,
            remarks: record.remarks ?? null,
            markedByUserId: currentUser.id,
          },
          include: attendanceInclude,
        });

        records.push(createdRecord);
      }

      return records;
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateAttendanceCache(schoolId);
    await this.auditService.write({
      action: 'attendance.bulk.create',
      entity: 'attendance_record',
      entityId: dto.classId,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        attendanceDate: attendanceDate.toISOString(),
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        totalRecords: createdRecords.length,
      },
    });

    return {
      success: true,
      message: 'Bulk attendance marked successfully.',
      data: createdRecords.map((record) => this.serializeAttendance(record)),
    };
  }

  async findAll(currentUser: JwtUser, query: AttendanceQueryDto) {
    return this.findMany(currentUser, query, {});
  }

  async findByStudent(
    currentUser: JwtUser,
    studentId: string,
    query: AttendanceQueryDto,
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);

    if (schoolId) {
      await this.findStudentOrThrow(
        schoolId,
        studentId,
        query.includeInactiveStudents,
      );
    }

    return this.findMany(currentUser, query, { studentId });
  }

  async findByClass(
    currentUser: JwtUser,
    classId: string,
    query: AttendanceQueryDto,
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);

    if (schoolId) {
      await this.ensureClassInSchool(schoolId, classId);
    }

    return this.findMany(currentUser, query, { classId });
  }

  async findSummary(currentUser: JwtUser, query: AttendanceQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const where = await this.buildAttendanceWhere(currentUser, query);
    const cacheKey = this.buildCacheKey('summary', schoolId ?? 'all', {
      attendanceDate: query.attendanceDate,
      startDate: query.startDate,
      endDate: query.endDate,
      studentId: query.studentId,
      classId: query.classId,
      sectionId: query.sectionId,
      sessionId: query.sessionId,
      status: query.status,
      search: query.search,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      ATTENDANCE_LIST_TTL_SECONDS,
      async () => {
        const [total, groupedCounts] = await Promise.all([
          this.prisma.attendanceRecord.count({ where }),
          this.prisma.attendanceRecord.groupBy({
            by: ['status'],
            where,
            _count: {
              status: true,
            },
          }),
        ]);

        const counts = new Map(
          groupedCounts.map((entry) => [entry.status, entry._count.status]),
        );

        return {
          total,
          totalPresent: counts.get(AttendanceStatus.PRESENT) ?? 0,
          totalAbsent: counts.get(AttendanceStatus.ABSENT) ?? 0,
          totalLate: counts.get(AttendanceStatus.LATE) ?? 0,
          totalLeave: counts.get(AttendanceStatus.LEAVE) ?? 0,
        };
      },
    );

    return {
      success: true,
      message: 'Attendance summary fetched successfully.',
      data: payload,
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateAttendanceDto) {
    const attendanceRecord = await this.findAttendanceOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: {
        id: attendanceRecord.id,
      },
      data: {
        ...(dto.status ? { status: dto.status as AttendanceStatus } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks ?? null } : {}),
        markedByUserId: currentUser.id,
      },
      include: attendanceInclude,
    });

    await this.invalidateAttendanceCache(attendanceRecord.schoolId);
    await this.auditService.write({
      action: 'attendance.update',
      entity: 'attendance_record',
      entityId: updatedRecord.id,
      actorUserId: currentUser.id,
      schoolId: updatedRecord.schoolId,
      metadata: {
        status: updatedRecord.status,
      },
    });

    return {
      success: true,
      message: 'Attendance updated successfully.',
      data: this.serializeAttendance(updatedRecord),
    };
  }

  async remove(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const attendanceRecord = await this.findAttendanceOrThrow(
      currentUser,
      id,
      overrideSchoolId ?? null,
    );

    await this.prisma.attendanceRecord.delete({
      where: {
        id: attendanceRecord.id,
      },
    });

    await this.invalidateAttendanceCache(attendanceRecord.schoolId);
    await this.auditService.write({
      action: 'attendance.delete',
      entity: 'attendance_record',
      entityId: attendanceRecord.id,
      actorUserId: currentUser.id,
      schoolId: attendanceRecord.schoolId,
      metadata: {
        studentId: attendanceRecord.studentId,
        attendanceDate: attendanceRecord.attendanceDate.toISOString(),
      },
    });

    return {
      success: true,
      message: 'Attendance deleted successfully.',
      data: {
        id: attendanceRecord.id,
        deleted: true,
      },
    };
  }

  private async findMany(
    currentUser: JwtUser,
    query: AttendanceQueryDto,
    forcedFilters: {
      studentId?: string;
      classId?: string;
    },
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const where = await this.buildAttendanceWhere(currentUser, query, forcedFilters);
    const cacheKey = this.buildCacheKey('list', schoolId ?? 'all', {
      page,
      limit,
      search: query.search,
      attendanceDate: query.attendanceDate,
      startDate: query.startDate,
      endDate: query.endDate,
      studentId: forcedFilters.studentId ?? query.studentId,
      classId: forcedFilters.classId ?? query.classId,
      sectionId: query.sectionId,
      sessionId: query.sessionId,
      status: query.status,
      includeInactiveStudents: query.includeInactiveStudents,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      ATTENDANCE_LIST_TTL_SECONDS,
      async () => {
        const [records, total] = await Promise.all([
          this.prisma.attendanceRecord.findMany({
            where,
            include: attendanceInclude,
            orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.attendanceRecord.count({ where }),
        ]);

        return {
          items: records.map((record) => this.serializeAttendance(record)),
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
      message: 'Attendance records fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  private async buildAttendanceWhere(
    currentUser: JwtUser,
    query: AttendanceQueryDto,
    forcedFilters: {
      studentId?: string;
      classId?: string;
    } = {},
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const search = query.search?.trim() ?? '';
    const attendanceDate = query.attendanceDate
      ? this.normalizeDate(query.attendanceDate)
      : null;
    const startDate = query.startDate ? this.normalizeDate(query.startDate) : null;
    const endDate = query.endDate ? this.normalizeDate(query.endDate) : null;

    return {
      ...(schoolId ? { schoolId } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(forcedFilters.studentId ?? query.studentId
        ? { studentId: forcedFilters.studentId ?? query.studentId }
        : {}),
      ...(forcedFilters.classId ?? query.classId
        ? { classId: forcedFilters.classId ?? query.classId }
        : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.status ? { status: query.status as AttendanceStatus } : {}),
      ...(attendanceDate
        ? { attendanceDate }
        : startDate || endDate
          ? {
              attendanceDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      ...(!query.includeInactiveStudents
        ? {
            student: {
              status: {
                not: StudentStatus.INACTIVE,
              },
            },
          }
        : {}),
      ...(search
        ? {
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
                academicClass: {
                  className: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                section: {
                  sectionName: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.AttendanceRecordWhereInput;
  }

  private async ensureStudentAttendanceContext(
    schoolId: string,
    studentId: string,
    classId?: string,
    sectionId?: string,
    sessionId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: {
        admissions: {
          where: {
            admissionStatus: AdmissionStatus.ACTIVE,
            ...(sessionId ? { sessionId } : {}),
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const latestAdmission = student.admissions[0] ?? null;
    const resolvedSessionId =
      sessionId ??
      latestAdmission?.sessionId ??
      (await this.resolveAcademicSession(schoolId)).id;
    const resolvedClassId = classId ?? latestAdmission?.classId ?? null;
    const resolvedSectionId =
      sectionId !== undefined ? sectionId : latestAdmission?.sectionId ?? null;

    if (!resolvedClassId) {
      throw new BadRequestException(
        'Class is required for attendance and could not be derived from student admission.',
      );
    }

    await this.ensureClassInSchool(schoolId, resolvedClassId);

    if (resolvedSectionId) {
      await this.ensureSectionInSchool(schoolId, resolvedClassId, resolvedSectionId);
    }

    if (latestAdmission) {
      if (latestAdmission.classId !== resolvedClassId) {
        throw new BadRequestException(
          'Student does not belong to the selected class for the current admission.',
        );
      }

      if (
        resolvedSectionId &&
        latestAdmission.sectionId &&
        latestAdmission.sectionId !== resolvedSectionId
      ) {
        throw new BadRequestException(
          'Student does not belong to the selected section for the current admission.',
        );
      }
    }

    return {
      sessionId: resolvedSessionId,
      classId: resolvedClassId,
      sectionId: resolvedSectionId,
    };
  }

  private async findAttendanceOrThrow(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, overrideSchoolId);

    const attendanceRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        id,
        schoolId,
      },
      include: attendanceInclude,
    });

    if (!attendanceRecord) {
      throw new NotFoundException('Attendance record not found.');
    }

    return attendanceRecord;
  }

  private async findStudentOrThrow(
    schoolId: string,
    studentId: string,
    includeInactiveStudents?: boolean,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        ...(!includeInactiveStudents
          ? {
              status: {
                not: StudentStatus.INACTIVE,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    return student;
  }

  private async ensureClassInSchool(schoolId: string, classId: string) {
    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        id: classId,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }
  }

  private async ensureSectionInSchool(
    schoolId: string,
    classId: string,
    sectionId: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        schoolId,
        classId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found for this class and school.');
    }
  }

  private async resolveAcademicSession(schoolId: string, sessionId?: string | null) {
    const session = await this.prisma.academicSession.findFirst({
      where: {
        schoolId,
        ...(sessionId ? { id: sessionId } : { isCurrent: true }),
        isActive: true,
      },
      select: {
        id: true,
        sessionName: true,
        isCurrent: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Active academic session not found for this school.');
    }

    return session;
  }

  private resolveWriteSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const schoolId = overrideSchoolId ?? currentUser.schoolId ?? null;

      if (!schoolId) {
        throw new ForbiddenException(
          'SUPER_ADMIN must provide a school scope for this action.',
        );
      }

      return schoolId;
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

  private resolveListSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
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

  private normalizeDate(dateValue: string) {
    const normalizedDate = new Date(dateValue);
    normalizedDate.setUTCHours(0, 0, 0, 0);
    return normalizedDate;
  }

  private buildCacheKey(
    suffix: string,
    schoolScope: string,
    payload: Record<string, unknown>,
  ) {
    return `attendance:${schoolScope}:${suffix}:${JSON.stringify(payload)}`;
  }

  private async invalidateAttendanceCache(schoolId: string) {
    await this.redisService.deleteByPattern(`attendance:${schoolId}:*`);
  }

  private serializeAttendance(record: AttendanceWithDetails) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      sessionId: record.sessionId,
      attendanceDate: record.attendanceDate.toISOString(),
      status: record.status,
      remarks: record.remarks,
      student: {
        id: record.student.id,
        name: record.student.fullName,
        studentCode: record.student.studentCode,
      },
      class: {
        id: record.academicClass.id,
        className: record.academicClass.className,
        classCode: record.academicClass.classCode,
      },
      section: record.section
        ? {
            id: record.section.id,
            sectionName: record.section.sectionName,
          }
        : null,
      session: {
        id: record.academicSession.id,
        sessionName: record.academicSession.sessionName,
        isCurrent: record.academicSession.isCurrent,
      },
      markedBy: record.markedByUser
        ? {
            id: record.markedByUser.id,
            name: record.markedByUser.fullName,
            email: record.markedByUser.email,
          }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
