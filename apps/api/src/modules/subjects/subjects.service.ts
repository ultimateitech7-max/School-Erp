import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

const SUBJECT_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const subjectDetailsInclude = Prisma.validator<Prisma.SubjectInclude>()({
  classSubjects: {
    include: {
      academicClass: {
        select: {
          id: true,
          classCode: true,
          className: true,
          isActive: true,
        },
      },
      academicSession: {
        select: {
          id: true,
          sessionName: true,
          isCurrent: true,
          isActive: true,
        },
      },
    },
  },
});

type SubjectWithClasses = Prisma.SubjectGetPayload<{
  include: typeof subjectDetailsInclude;
}>;

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateSubjectDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const subjectName = dto.subjectName.trim();
    const subjectCode =
      dto.subjectCode?.trim().toUpperCase() ??
      (await this.generateSubjectCode(schoolId));

    await this.ensureUniqueSubject(schoolId, subjectName, subjectCode);

    const subject = await this.prisma.subject.create({
      data: {
        schoolId,
        subjectName,
        subjectCode,
        subjectType: dto.subjectType ?? 'THEORY',
        isOptional: dto.isOptional ?? false,
        isActive: dto.isActive ?? true,
      },
      include: subjectDetailsInclude,
    });

    await this.invalidateCaches(subject.schoolId);
    await this.auditService.write({
      action: 'subjects.create',
      entity: 'subject',
      entityId: subject.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
      },
    });

    return {
      success: true,
      message: 'Subject created successfully.',
      data: this.serializeSubject(subject),
    };
  }

  async findAll(currentUser: JwtUser, query: SubjectQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildSubjectCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      subjectType: query.subjectType,
      isActive: query.isActive,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      SUBJECT_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.SubjectWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          ...(query.subjectType ? { subjectType: query.subjectType } : {}),
          ...(query.isActive !== undefined
            ? { isActive: query.isActive }
            : { isActive: true }),
          ...(search
            ? {
                OR: [
                  {
                    subjectName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    subjectCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        };

        const [subjects, total] = await Promise.all([
          this.prisma.subject.findMany({
            where,
            include: subjectDetailsInclude,
            orderBy: [{ subjectName: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.subject.count({ where }),
        ]);

        return {
          items: subjects.map((subject) => this.serializeSubject(subject)),
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
      message: 'Subjects fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const subject = await this.findSubjectOrThrow(currentUser, id, schoolId);

    return {
      success: true,
      message: 'Subject fetched successfully.',
      data: this.serializeSubject(subject),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateSubjectDto) {
    const subject = await this.findSubjectOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const subjectName = dto.subjectName?.trim();
    const subjectCode = dto.subjectCode?.trim().toUpperCase();

    await this.ensureUniqueSubject(
      subject.schoolId,
      subjectName,
      subjectCode,
      subject.id,
    );

    const updatedSubject = await this.prisma.subject.update({
      where: { id: subject.id },
      data: {
        ...(subjectName ? { subjectName } : {}),
        ...(subjectCode ? { subjectCode } : {}),
        ...(dto.subjectType ? { subjectType: dto.subjectType } : {}),
        ...(dto.isOptional !== undefined ? { isOptional: dto.isOptional } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: subjectDetailsInclude,
    });

    await this.invalidateCaches(updatedSubject.schoolId);
    await this.auditService.write({
      action: 'subjects.update',
      entity: 'subject',
      entityId: updatedSubject.id,
      actorUserId: currentUser.id,
      schoolId: updatedSubject.schoolId,
      metadata: {
        subjectName: updatedSubject.subjectName,
      },
    });

    return {
      success: true,
      message: 'Subject updated successfully.',
      data: this.serializeSubject(updatedSubject),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const subject = await this.findSubjectOrThrow(currentUser, id, schoolId);

    await this.prisma.subject.update({
      where: { id: subject.id },
      data: {
        isActive: false,
      },
    });

    await this.invalidateCaches(subject.schoolId);
    await this.auditService.write({
      action: 'subjects.delete',
      entity: 'subject',
      entityId: subject.id,
      actorUserId: currentUser.id,
      schoolId: subject.schoolId,
      metadata: {
        subjectName: subject.subjectName,
      },
    });

    return {
      success: true,
      message: 'Subject deleted successfully.',
      data: {
        id: subject.id,
        deleted: true,
      },
    };
  }

  private async findSubjectOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolId?: string | null,
  ) {
    const scopeSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? schoolId ?? null
        : this.resolveWriteSchoolScope(currentUser, schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        ...(scopeSchoolId ? { schoolId: scopeSchoolId } : {}),
        isActive: true,
      },
      include: subjectDetailsInclude,
    });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      subject.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return subject;
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
      return overrideSchoolId ?? null;
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

  private async ensureUniqueSubject(
    schoolId: string,
    subjectName?: string,
    subjectCode?: string,
    excludeId?: string,
  ) {
    if (subjectName) {
      const existingByName = await this.prisma.subject.findFirst({
        where: {
          schoolId,
          subjectName: {
            equals: subjectName,
            mode: 'insensitive',
          },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByName) {
        throw new ConflictException('Subject name already exists in this school.');
      }
    }

    if (subjectCode) {
      const existingByCode = await this.prisma.subject.findFirst({
        where: {
          schoolId,
          subjectCode: {
            equals: subjectCode,
            mode: 'insensitive',
          },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByCode) {
        throw new ConflictException('Subject code already exists in this school.');
      }
    }
  }

  private async generateSubjectCode(schoolId: string) {
    const totalSubjects = await this.prisma.subject.count({
      where: {
        schoolId,
      },
    });

    let nextIndex = totalSubjects + 1;

    while (true) {
      const candidate = `SUB-${String(nextIndex).padStart(3, '0')}`;
      const existingSubject = await this.prisma.subject.findFirst({
        where: {
          schoolId,
          subjectCode: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existingSubject) {
        return candidate;
      }

      nextIndex += 1;
    }
  }

  private buildSubjectCacheKey(
    schoolScope: string,
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return `academics:subjects:${schoolScope}:${JSON.stringify(params)}`;
  }

  private async invalidateCaches(schoolId: string) {
    await this.redisService.deleteByPattern(`academics:subjects:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:subjects:all:*');
    await this.redisService.deleteByPattern(`academics:classes:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:classes:all:*');
  }

  private serializeSubject(subject: SubjectWithClasses) {
    const sortedAssignments = [...subject.classSubjects].sort((left, right) => {
      if (left.academicSession.isCurrent === right.academicSession.isCurrent) {
        return left.academicClass.className.localeCompare(
          right.academicClass.className,
        );
      }

      return left.academicSession.isCurrent ? -1 : 1;
    });
    const classes = new Map<
      string,
      {
        id: string;
        classCode: string;
        className: string;
        sessionId: string;
        sessionName: string;
        isMandatory: boolean;
        periodsPerWeek: number | null;
      }
    >();

    for (const assignment of sortedAssignments) {
      if (!assignment.academicClass.isActive || classes.has(assignment.classId)) {
        continue;
      }

      classes.set(assignment.classId, {
        id: assignment.academicClass.id,
        classCode: assignment.academicClass.classCode,
        className: assignment.academicClass.className,
        sessionId: assignment.academicSession.id,
        sessionName: assignment.academicSession.sessionName,
        isMandatory: assignment.isMandatory,
        periodsPerWeek: assignment.periodsPerWeek,
      });
    }

    return {
      id: subject.id,
      subjectCode: subject.subjectCode,
      name: subject.subjectName,
      subjectName: subject.subjectName,
      subjectType: subject.subjectType,
      isOptional: subject.isOptional,
      schoolId: subject.schoolId,
      status: subject.isActive ? 'ACTIVE' : 'INACTIVE',
      isActive: subject.isActive,
      classes: [...classes.values()],
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  }
}
