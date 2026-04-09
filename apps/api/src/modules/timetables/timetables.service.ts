import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek, Prisma, RoleType, TeacherStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { TimetableQueryDto } from './dto/timetable-query.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const timetableInclude = Prisma.validator<Prisma.TimetableEntryInclude>()({
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
  subject: {
    select: {
      id: true,
      subjectName: true,
      subjectCode: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
    },
  },
});

type TimetableEntryRecord = Prisma.TimetableEntryGetPayload<{
  include: typeof timetableInclude;
}>;

@Injectable()
export class TimetablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateTimetableEntryDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);

    this.validateTimeWindow(dto.startTime, dto.endTime);

    const validatedReferences = await this.validateReferences(schoolId, dto);

    await this.checkTimetableConflict(schoolId, {
      classId: validatedReferences.academicClass.id,
      sectionId: validatedReferences.section?.id ?? null,
      teacherId: validatedReferences.teacher.id,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      periodNumber: dto.periodNumber,
    });

    const createdEntry = await this.prisma.timetableEntry.create({
      data: {
        schoolId,
        classId: validatedReferences.academicClass.id,
        sectionId: validatedReferences.section?.id ?? null,
        subjectId: validatedReferences.subject.id,
        teacherId: validatedReferences.teacher.id,
        dayOfWeek: dto.dayOfWeek,
        periodNumber: dto.periodNumber,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: timetableInclude,
    });

    await this.auditService.write({
      action: 'timetables.create',
      entity: 'timetable_entry',
      entityId: createdEntry.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        classId: createdEntry.classId,
        sectionId: createdEntry.sectionId,
        teacherId: createdEntry.teacherId,
        subjectId: createdEntry.subjectId,
        dayOfWeek: createdEntry.dayOfWeek,
        periodNumber: createdEntry.periodNumber,
      },
    });

    return {
      success: true,
      message: 'Timetable entry created successfully.',
      data: this.serializeEntry(createdEntry),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateTimetableEntryDto) {
    const existingEntry = await this.findScopedEntryOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const schoolId = existingEntry.schoolId;
    const mergedPayload = {
      classId: dto.classId ?? existingEntry.classId,
      sectionId:
        dto.sectionId !== undefined ? dto.sectionId : existingEntry.sectionId ?? undefined,
      subjectId: dto.subjectId ?? existingEntry.subjectId,
      teacherId: dto.teacherId ?? existingEntry.teacherId,
      dayOfWeek: dto.dayOfWeek ?? existingEntry.dayOfWeek,
      periodNumber: dto.periodNumber ?? existingEntry.periodNumber,
      startTime: dto.startTime ?? existingEntry.startTime,
      endTime: dto.endTime ?? existingEntry.endTime,
    };

    this.validateTimeWindow(mergedPayload.startTime, mergedPayload.endTime);

    const validatedReferences = await this.validateReferences(schoolId, mergedPayload);

    await this.checkTimetableConflict(schoolId, {
      classId: validatedReferences.academicClass.id,
      sectionId: validatedReferences.section?.id ?? null,
      teacherId: validatedReferences.teacher.id,
      dayOfWeek: mergedPayload.dayOfWeek,
      startTime: mergedPayload.startTime,
      endTime: mergedPayload.endTime,
      periodNumber: mergedPayload.periodNumber,
      excludeId: existingEntry.id,
    });

    const updatedEntry = await this.prisma.timetableEntry.update({
      where: {
        id: existingEntry.id,
      },
      data: {
        classId: validatedReferences.academicClass.id,
        sectionId: validatedReferences.section?.id ?? null,
        subjectId: validatedReferences.subject.id,
        teacherId: validatedReferences.teacher.id,
        dayOfWeek: mergedPayload.dayOfWeek,
        periodNumber: mergedPayload.periodNumber,
        startTime: mergedPayload.startTime,
        endTime: mergedPayload.endTime,
      },
      include: timetableInclude,
    });

    await this.auditService.write({
      action: 'timetables.update',
      entity: 'timetable_entry',
      entityId: updatedEntry.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        classId: updatedEntry.classId,
        sectionId: updatedEntry.sectionId,
        teacherId: updatedEntry.teacherId,
        subjectId: updatedEntry.subjectId,
        dayOfWeek: updatedEntry.dayOfWeek,
        periodNumber: updatedEntry.periodNumber,
      },
    });

    return {
      success: true,
      message: 'Timetable entry updated successfully.',
      data: this.serializeEntry(updatedEntry),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const entry = await this.findScopedEntryOrThrow(currentUser, id, schoolIdOverride);

    await this.prisma.timetableEntry.delete({
      where: {
        id: entry.id,
      },
    });

    await this.auditService.write({
      action: 'timetables.delete',
      entity: 'timetable_entry',
      entityId: entry.id,
      actorUserId: currentUser.id,
      schoolId: entry.schoolId,
      metadata: {
        classId: entry.classId,
        sectionId: entry.sectionId,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
      },
    });

    return {
      success: true,
      message: 'Timetable entry deleted successfully.',
      data: {
        id: entry.id,
        deleted: true,
      },
    };
  }

  async findAll(currentUser: JwtUser, query: TimetableQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const where: Prisma.TimetableEntryWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.timetableEntry.findMany({
        where,
        include: timetableInclude,
        orderBy: [
          { classId: 'asc' },
          { sectionId: 'asc' },
          { dayOfWeek: 'asc' },
          { periodNumber: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timetableEntry.count({ where }),
    ]);

    return {
      success: true,
      message: 'Timetable entries fetched successfully.',
      data: items.map((entry) => this.serializeEntry(entry)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findByClass(
    currentUser: JwtUser,
    classId: string,
    query: TimetableQueryDto,
  ) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);

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
      throw new NotFoundException('Class not found.');
    }

    const where: Prisma.TimetableEntryWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      classId,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    };

    const items = await this.prisma.timetableEntry.findMany({
      where,
      include: timetableInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return {
      success: true,
      message: 'Class timetable fetched successfully.',
      data: items.map((entry) => this.serializeEntry(entry)),
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveReadSchoolScope(currentUser, schoolIdOverride);

    const [classes, teachers, subjects] = await Promise.all([
      this.prisma.academicClass.findMany({
        where: {
          schoolId: schoolId ?? undefined,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          sections: {
            where: { isActive: true },
            orderBy: { sectionName: 'asc' },
            select: {
              id: true,
              sectionName: true,
            },
          },
        },
      }),
      this.prisma.teacher.findMany({
        where: {
          schoolId: schoolId ?? undefined,
          status: TeacherStatus.ACTIVE,
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
        },
      }),
      this.prisma.subject.findMany({
        where: {
          schoolId: schoolId ?? undefined,
          isActive: true,
        },
        orderBy: { subjectName: 'asc' },
        select: {
          id: true,
          subjectName: true,
          subjectCode: true,
        },
      }),
    ]);

    return {
      success: true,
      message: 'Timetable options fetched successfully.',
      data: {
        classes: classes.map((item) => ({
          id: item.id,
          name: item.className,
          sections: item.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
        teachers: teachers.map((item) => ({
          id: item.id,
          name: item.fullName,
        })),
        subjects: subjects.map((item) => ({
          id: item.id,
          name: item.subjectName,
          code: item.subjectCode,
        })),
        days: Object.values(DayOfWeek),
      },
    };
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
      throw new NotFoundException('Timetable not found.');
    }

    return currentUser.schoolId;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for platform-scoped timetable writes.',
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
      throw new NotFoundException('Timetable not found.');
    }

    return currentUser.schoolId;
  }

  private validateTimeWindow(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('endTime must be after startTime.');
    }
  }

  private async validateReferences(
    schoolId: string,
    payload: {
      classId: string;
      sectionId?: string | null;
      subjectId: string;
      teacherId: string;
    },
  ) {
    const [academicClass, section, subject, teacher] = await Promise.all([
      this.prisma.academicClass.findFirst({
        where: {
          id: payload.classId,
          schoolId,
          isActive: true,
        },
      }),
      payload.sectionId
        ? this.prisma.section.findFirst({
            where: {
              id: payload.sectionId,
              schoolId,
              isActive: true,
            },
          })
        : Promise.resolve(null),
      this.prisma.subject.findFirst({
        where: {
          id: payload.subjectId,
          schoolId,
          isActive: true,
        },
      }),
      this.prisma.teacher.findFirst({
        where: {
          id: payload.teacherId,
          schoolId,
          status: TeacherStatus.ACTIVE,
        },
      }),
    ]);

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }

    if (payload.sectionId && !section) {
      throw new NotFoundException('Section not found for this school.');
    }

    if (section && section.classId !== academicClass.id) {
      throw new BadRequestException('Selected section does not belong to class.');
    }

    if (!subject) {
      throw new NotFoundException('Subject not found for this school.');
    }

    if (!teacher) {
      throw new NotFoundException('Teacher not found for this school.');
    }

    return {
      academicClass,
      section,
      subject,
      teacher,
    };
  }

  async checkTimetableConflict(
    schoolId: string,
    payload: {
      classId: string;
      sectionId: string | null;
      teacherId: string;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      periodNumber: number;
      excludeId?: string;
    },
  ) {
    const overlappingWindow: Prisma.TimetableEntryWhereInput = {
      dayOfWeek: payload.dayOfWeek,
      ...(payload.excludeId
        ? {
            id: {
              not: payload.excludeId,
            },
          }
        : {}),
      OR: [
        {
          periodNumber: payload.periodNumber,
        },
        {
          AND: [
            { startTime: { lt: payload.endTime } },
            { endTime: { gt: payload.startTime } },
          ],
        },
      ],
    };

    const [teacherConflict, classConflict] = await Promise.all([
      this.prisma.timetableEntry.findFirst({
        where: {
          schoolId,
          teacherId: payload.teacherId,
          ...overlappingWindow,
        },
        select: { id: true },
      }),
      this.prisma.timetableEntry.findFirst({
        where: {
          schoolId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          ...overlappingWindow,
        },
        select: { id: true },
      }),
    ]);

    if (teacherConflict) {
      throw new ConflictException('Teacher already assigned in this time slot');
    }

    if (classConflict) {
      throw new ConflictException('Class already has a subject in this period');
    }
  }

  private async findScopedEntryOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolId?: string | null,
  ) {
    const resolvedSchoolId = this.resolveReadSchoolScope(currentUser, schoolId);
    const entry = await this.prisma.timetableEntry.findFirst({
      where: {
        id,
        ...(resolvedSchoolId ? { schoolId: resolvedSchoolId } : {}),
      },
      include: timetableInclude,
    });

    if (!entry) {
      throw new NotFoundException('Timetable entry not found.');
    }

    return entry;
  }

  private serializeEntry(entry: TimetableEntryRecord) {
    return {
      id: entry.id,
      schoolId: entry.schoolId,
      dayOfWeek: entry.dayOfWeek,
      periodNumber: entry.periodNumber,
      startTime: entry.startTime,
      endTime: entry.endTime,
      class: {
        id: entry.academicClass.id,
        name: entry.academicClass.className,
        classCode: entry.academicClass.classCode,
      },
      section: entry.section
        ? {
            id: entry.section.id,
            name: entry.section.sectionName,
          }
        : null,
      subject: {
        id: entry.subject.id,
        name: entry.subject.subjectName,
        code: entry.subject.subjectCode,
      },
      teacher: {
        id: entry.teacher.id,
        name: entry.teacher.fullName,
        employeeCode: entry.teacher.employeeCode,
      },
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}
