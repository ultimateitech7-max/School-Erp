import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateExamDateSheetDto } from './dto/create-exam-date-sheet.dto';
import { ExamDateSheetQueryDto } from './dto/exam-date-sheet-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const dateSheetInclude = Prisma.validator<Prisma.ExamDateSheetInclude>()({
  school: {
    select: {
      id: true,
      name: true,
      schoolCode: true,
    },
  },
  academicClass: {
    select: {
      id: true,
      className: true,
      classCode: true,
    },
  },
  entries: {
    include: {
      subject: {
        select: {
          id: true,
          subjectName: true,
          subjectCode: true,
        },
      },
    },
    orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
  },
});

type ExamDateSheetRecord = Prisma.ExamDateSheetGetPayload<{
  include: typeof dateSheetInclude;
}>;

@Injectable()
export class ExamDateSheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateExamDateSheetDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const classRecord = await this.prisma.academicClass.findFirst({
      where: {
        id: dto.classId,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        className: true,
      },
    });

    if (!classRecord) {
      throw new NotFoundException('Class not found for this school.');
    }

    const normalizedEntries = dto.entries.map((entry) => ({
      ...entry,
      examDate: this.normalizeDate(entry.examDate),
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));

    for (const entry of normalizedEntries) {
      this.validateTimeWindow(entry.startTime, entry.endTime);
    }

    await this.ensureSubjectsBelongToClass(
      schoolId,
      classRecord.id,
      normalizedEntries.map((entry) => entry.subjectId),
    );

    this.ensureNoInternalOverlaps(normalizedEntries);
    await this.ensureNoExistingExamOverlaps(
      schoolId,
      classRecord.id,
      normalizedEntries,
    );

    const createdDateSheet = await this.prisma.$transaction(
      async (tx) => {
        const dateSheet = await tx.examDateSheet.create({
          data: {
            schoolId,
            classId: classRecord.id,
            examName: dto.examName.trim(),
            isPublished: false,
          },
        });

        await tx.examDateSheetEntry.createMany({
          data: normalizedEntries.map((entry) => ({
            dateSheetId: dateSheet.id,
            subjectId: entry.subjectId,
            examDate: entry.examDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
          })),
        });

        return tx.examDateSheet.findUniqueOrThrow({
          where: {
            id: dateSheet.id,
          },
          include: dateSheetInclude,
        });
      },
      {
        maxWait: 20_000,
        timeout: 60_000,
      },
    );

    await this.auditService.write({
      action: 'exam_date_sheets.create',
      entity: 'exam_date_sheet',
      entityId: createdDateSheet.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        examName: createdDateSheet.examName,
        classId: createdDateSheet.classId,
        entriesCount: createdDateSheet.entries.length,
      },
    });

    return {
      success: true,
      message: 'Exam date sheet created successfully.',
      data: this.serializeDateSheet(createdDateSheet),
    };
  }

  async findAll(currentUser: JwtUser, query: ExamDateSheetQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const where: Prisma.ExamDateSheetWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.isPublished !== undefined
        ? { isPublished: query.isPublished }
        : {}),
      ...(search
        ? {
            examName: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.examDateSheet.findMany({
        where,
        include: dateSheetInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.examDateSheet.count({ where }),
    ]);

    return {
      success: true,
      message: 'Exam date sheets fetched successfully.',
      data: items.map((item) => this.serializeDateSheet(item)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const schoolId = this.resolveReadSchoolScope(currentUser, schoolIdOverride);
    const item = await this.prisma.examDateSheet.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: dateSheetInclude,
    });

    if (!item) {
      throw new NotFoundException('Exam date sheet not found.');
    }

    return {
      success: true,
      message: 'Exam date sheet fetched successfully.',
      data: this.serializeDateSheet(item),
    };
  }

  async publish(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const item = await this.findScopedDateSheetOrThrow(currentUser, id, schoolIdOverride);

    if (item.isPublished) {
      return {
        success: true,
        message: 'Exam date sheet is already published.',
        data: this.serializeDateSheet(item),
      };
    }

    const published = await this.prisma.examDateSheet.update({
      where: {
        id: item.id,
      },
      data: {
        isPublished: true,
      },
      include: dateSheetInclude,
    });

    await this.auditService.write({
      action: 'exam_date_sheets.publish',
      entity: 'exam_date_sheet',
      entityId: published.id,
      actorUserId: currentUser.id,
      schoolId: published.schoolId,
      metadata: {
        examName: published.examName,
        classId: published.classId,
      },
    });

    return {
      success: true,
      message: 'Exam date sheet published successfully.',
      data: this.serializeDateSheet(published),
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveReadSchoolScope(currentUser, schoolIdOverride);
    const currentSession = schoolId
      ? await this.prisma.academicSession.findFirst({
          where: {
            schoolId,
            isCurrent: true,
            isActive: true,
          },
          select: {
            id: true,
          },
        })
      : null;

    const classes = await this.prisma.academicClass.findMany({
      where: {
        schoolId: schoolId ?? undefined,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
      select: {
        id: true,
        className: true,
        classCode: true,
        classSubjects: {
          where: {
            schoolId: schoolId ?? undefined,
            ...(currentSession ? { sessionId: currentSession.id } : {}),
          },
          select: {
            subject: {
              select: {
                id: true,
                subjectName: true,
                subjectCode: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Exam date sheet options fetched successfully.',
      data: {
        classes: classes.map((item) => ({
          id: item.id,
          name: item.className,
          classCode: item.classCode,
          subjects: item.classSubjects.map((link) => ({
            id: link.subject.id,
            name: link.subject.subjectName,
            code: link.subject.subjectCode,
          })),
        })),
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
      throw new NotFoundException('Exam date sheet not found.');
    }

    return currentUser.schoolId;
  }

  private async findScopedDateSheetOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);
    const item = await this.prisma.examDateSheet.findFirst({
      where: {
        id,
        schoolId,
      },
      include: dateSheetInclude,
    });

    if (!item) {
      throw new NotFoundException('Exam date sheet not found.');
    }

    return item;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for platform-scoped exam date sheet writes.',
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
      throw new NotFoundException('Exam date sheet not found.');
    }

    return currentUser.schoolId;
  }

  private validateTimeWindow(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('endTime must be after startTime.');
    }
  }

  private normalizeDate(value: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid examDate provided.');
    }

    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }

  private async ensureSubjectsBelongToClass(
    schoolId: string,
    classId: string,
    subjectIds: string[],
  ) {
    const uniqueSubjectIds = [...new Set(subjectIds)];
    const linkedSubjects = await this.prisma.classSubject.findMany({
      where: {
        schoolId,
        classId,
        subjectId: {
          in: uniqueSubjectIds,
        },
      },
      select: {
        subjectId: true,
      },
    });

    const linkedSubjectSet = new Set(linkedSubjects.map((item) => item.subjectId));

    for (const subjectId of uniqueSubjectIds) {
      if (!linkedSubjectSet.has(subjectId)) {
        throw new BadRequestException(
          'Selected subject does not belong to the chosen class.',
        );
      }
    }
  }

  private ensureNoInternalOverlaps(entries: Array<{
    subjectId: string;
    examDate: Date;
    startTime: string;
    endTime: string;
  }>) {
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];

      for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
        const compare = entries[compareIndex];

        if (
          current.examDate.getTime() === compare.examDate.getTime() &&
          this.hasTimeOverlap(
            current.startTime,
            current.endTime,
            compare.startTime,
            compare.endTime,
          )
        ) {
          throw new ConflictException('Exam date sheet has overlapping exam times.');
        }
      }
    }
  }

  private async ensureNoExistingExamOverlaps(
    schoolId: string,
    classId: string,
    entries: Array<{
      subjectId: string;
      examDate: Date;
      startTime: string;
      endTime: string;
    }>,
  ) {
    const examDates = [...new Set(entries.map((entry) => entry.examDate.toISOString()))].map(
      (value) => new Date(value),
    );

    const existingEntries = await this.prisma.examDateSheetEntry.findMany({
      where: {
        examDate: {
          in: examDates,
        },
        dateSheet: {
          schoolId,
          classId,
        },
      },
      include: {
        dateSheet: {
          select: {
            id: true,
            examName: true,
          },
        },
      },
    });

    for (const incomingEntry of entries) {
      const overlappingEntry = existingEntries.find((existingEntry) => {
        return (
          existingEntry.examDate.getTime() === incomingEntry.examDate.getTime() &&
          this.hasTimeOverlap(
            existingEntry.startTime,
            existingEntry.endTime,
            incomingEntry.startTime,
            incomingEntry.endTime,
          )
        );
      });

      if (overlappingEntry) {
        throw new ConflictException(
          `Class already has an exam scheduled during this time slot in ${overlappingEntry.dateSheet.examName}.`,
        );
      }
    }
  }

  private hasTimeOverlap(
    startTime: string,
    endTime: string,
    compareStartTime: string,
    compareEndTime: string,
  ) {
    return startTime < compareEndTime && endTime > compareStartTime;
  }

  private serializeDateSheet(record: ExamDateSheetRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      examName: record.examName,
      isPublished: record.isPublished,
      school: {
        id: record.school.id,
        name: record.school.name,
        schoolCode: record.school.schoolCode,
      },
      class: {
        id: record.academicClass.id,
        name: record.academicClass.className,
        classCode: record.academicClass.classCode,
      },
      entries: record.entries.map((entry) => ({
        id: entry.id,
        subject: {
          id: entry.subject.id,
          name: entry.subject.subjectName,
          code: entry.subject.subjectCode,
        },
        examDate: entry.examDate.toISOString(),
        startTime: entry.startTime,
        endTime: entry.endTime,
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
