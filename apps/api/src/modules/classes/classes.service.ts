import {
  BadRequestException,
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
import { AssignSubjectsToClassDto } from './dto/assign-subjects-to-class.dto';
import { ClassQueryDto } from './dto/class-query.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const CLASS_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const classDetailsInclude = Prisma.validator<Prisma.AcademicClassInclude>()({
  sections: {
    orderBy: [{ sectionName: 'asc' }],
  },
  classSubjects: {
    include: {
      subject: true,
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

type AcademicClassWithDetails = Prisma.AcademicClassGetPayload<{
  include: typeof classDetailsInclude;
}>;

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateClassDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const className = dto.className.trim();
    const classCode =
      dto.classCode?.trim().toUpperCase() ??
      (await this.generateClassCode(schoolId));

    await this.ensureUniqueClass(schoolId, className, classCode);

    const academicClass = await this.prisma.academicClass.create({
      data: {
        schoolId,
        className,
        classCode,
        gradeLevel: dto.gradeLevel,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: classDetailsInclude,
    });

    await this.invalidateClassCache(schoolId);
    await this.auditService.write({
      action: 'classes.create',
      entity: 'class',
      entityId: academicClass.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        className: academicClass.className,
        classCode: academicClass.classCode,
      },
    });

    return {
      success: true,
      message: 'Class created successfully.',
      data: this.serializeClass(academicClass),
    };
  }

  async findAll(currentUser: JwtUser, query: ClassQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildClassCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      isActive: query.isActive,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      CLASS_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.AcademicClassWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          ...(query.isActive !== undefined
            ? { isActive: query.isActive }
            : { isActive: true }),
          ...(search
            ? {
                OR: [
                  {
                    className: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    classCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        };

        const [classes, total] = await Promise.all([
          this.prisma.academicClass.findMany({
            where,
            include: classDetailsInclude,
            orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.academicClass.count({ where }),
        ]);

        return {
          items: classes.map((academicClass) =>
            this.serializeClass(academicClass),
          ),
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
      message: 'Classes fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const academicClass = await this.findClassOrThrow(currentUser, id, schoolId);

    return {
      success: true,
      message: 'Class fetched successfully.',
      data: this.serializeClass(academicClass),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateClassDto) {
    const academicClass = await this.findClassOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const className = dto.className?.trim();
    const classCode = dto.classCode?.trim().toUpperCase();

    await this.ensureUniqueClass(
      academicClass.schoolId,
      className,
      classCode,
      academicClass.id,
    );

    const updatedClass = await this.prisma.academicClass.update({
      where: { id: academicClass.id },
      data: {
        ...(className ? { className } : {}),
        ...(classCode ? { classCode } : {}),
        ...(dto.gradeLevel !== undefined ? { gradeLevel: dto.gradeLevel } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: classDetailsInclude,
    });

    await this.invalidateClassCache(updatedClass.schoolId);
    await this.invalidateSectionCache(updatedClass.schoolId);
    await this.auditService.write({
      action: 'classes.update',
      entity: 'class',
      entityId: updatedClass.id,
      actorUserId: currentUser.id,
      schoolId: updatedClass.schoolId,
      metadata: {
        className: updatedClass.className,
      },
    });

    return {
      success: true,
      message: 'Class updated successfully.',
      data: this.serializeClass(updatedClass),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const academicClass = await this.findClassOrThrow(currentUser, id, schoolId);

    await this.prisma.academicClass.update({
      where: { id: academicClass.id },
      data: {
        isActive: false,
      },
    });

    await this.invalidateClassCache(academicClass.schoolId);
    await this.invalidateSectionCache(academicClass.schoolId);
    await this.auditService.write({
      action: 'classes.delete',
      entity: 'class',
      entityId: academicClass.id,
      actorUserId: currentUser.id,
      schoolId: academicClass.schoolId,
      metadata: {
        className: academicClass.className,
      },
    });

    return {
      success: true,
      message: 'Class deleted successfully.',
      data: {
        id: academicClass.id,
        deleted: true,
      },
    };
  }

  async findSections(
    currentUser: JwtUser,
    classId: string,
    schoolId?: string | null,
  ) {
    const academicClass = await this.findClassOrThrow(currentUser, classId, schoolId);

    return {
      success: true,
      message: 'Class sections fetched successfully.',
      data: {
        id: academicClass.id,
        className: academicClass.className,
        sections: academicClass.sections
          .filter((section) => section.isActive)
          .map((section) => ({
            id: section.id,
            name: section.sectionName,
            roomNo: section.roomNo,
            capacity: section.capacity,
            status: section.isActive ? 'ACTIVE' : 'INACTIVE',
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
          })),
      },
    };
  }

  async createSection(
    currentUser: JwtUser,
    classId: string,
    dto: CreateClassSectionDto,
  ) {
    const academicClass = await this.findClassOrThrow(currentUser, classId, null);
    const sectionName = dto.sectionName.trim();

    await this.ensureUniqueSectionName(
      academicClass.schoolId,
      academicClass.id,
      sectionName,
    );

    const section = await this.prisma.section.create({
      data: {
        schoolId: academicClass.schoolId,
        classId: academicClass.id,
        sectionName,
        roomNo: dto.roomNo ?? null,
        capacity: dto.capacity,
        isActive: dto.isActive ?? true,
      },
      include: {
        academicClass: {
          select: {
            id: true,
            classCode: true,
            className: true,
          },
        },
      },
    });

    await this.invalidateClassCache(academicClass.schoolId);
    await this.invalidateSectionCache(academicClass.schoolId);
    await this.auditService.write({
      action: 'sections.create',
      entity: 'section',
      entityId: section.id,
      actorUserId: currentUser.id,
      schoolId: academicClass.schoolId,
      metadata: {
        className: academicClass.className,
        sectionName: section.sectionName,
      },
    });

    return {
      success: true,
      message: 'Section created successfully.',
      data: {
        id: section.id,
        name: section.sectionName,
        roomNo: section.roomNo,
        capacity: section.capacity,
        class: {
          id: section.academicClass.id,
          classCode: section.academicClass.classCode,
          className: section.academicClass.className,
        },
        schoolId: section.schoolId,
        status: section.isActive ? 'ACTIVE' : 'INACTIVE',
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      },
    };
  }

  async findSubjects(
    currentUser: JwtUser,
    classId: string,
    sessionId?: string | null,
    schoolId?: string | null,
  ) {
    const academicClass = await this.findClassOrThrow(currentUser, classId, schoolId);
    const resolvedSessionId = await this.resolveAcademicSessionId(
      academicClass.schoolId,
      sessionId ?? undefined,
    );
    const classSubjects = await this.prisma.classSubject.findMany({
      where: {
        schoolId: academicClass.schoolId,
        classId: academicClass.id,
        sessionId: resolvedSessionId,
      },
      include: {
        subject: true,
        academicSession: {
          select: {
            id: true,
            sessionName: true,
            isCurrent: true,
            isActive: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Class subjects fetched successfully.',
      data: {
        id: academicClass.id,
        className: academicClass.className,
        sessionId: classSubjects[0]?.academicSession.id ?? resolvedSessionId,
        sessionName: classSubjects[0]?.academicSession.sessionName ?? null,
        subjects: this.serializeClassSubjects(classSubjects),
      },
    };
  }

  async assignSubjects(
    currentUser: JwtUser,
    classId: string,
    dto: AssignSubjectsToClassDto,
  ) {
    const academicClass = await this.findClassOrThrow(currentUser, classId, null);
    const schoolId = academicClass.schoolId;
    const sessionId = await this.resolveAcademicSessionId(schoolId, dto.sessionId);
    const uniqueSubjectIds = [...new Set(dto.subjects.map((item) => item.subjectId))];

    if (dto.subjects.length !== uniqueSubjectIds.length) {
      throw new BadRequestException('Duplicate subjects are not allowed.');
    }

    if (uniqueSubjectIds.length > 0) {
      const validSubjectsCount = await this.prisma.subject.count({
        where: {
          id: {
            in: uniqueSubjectIds,
          },
          schoolId,
          isActive: true,
        },
      });

      if (validSubjectsCount !== uniqueSubjectIds.length) {
        throw new NotFoundException(
          'One or more subjects were not found for this school.',
        );
      }
    }

    const classSubjects = await this.prisma.$transaction(async (tx) => {
      const existingAssignments = await tx.classSubject.findMany({
        where: {
          schoolId,
          classId: academicClass.id,
          sessionId,
        },
      });

      const incomingSubjectIds = new Set(uniqueSubjectIds);
      const assignmentIdsToDelete = existingAssignments
        .filter((assignment) => !incomingSubjectIds.has(assignment.subjectId))
        .map((assignment) => assignment.id);

      if (assignmentIdsToDelete.length > 0) {
        await tx.classSubject.deleteMany({
          where: {
            id: {
              in: assignmentIdsToDelete,
            },
          },
        });
      }

      for (const subject of dto.subjects) {
        await tx.classSubject.upsert({
          where: {
            schoolId_sessionId_classId_subjectId: {
              schoolId,
              sessionId,
              classId: academicClass.id,
              subjectId: subject.subjectId,
            },
          },
          update: {
            isMandatory: subject.isMandatory ?? true,
            periodsPerWeek: subject.periodsPerWeek ?? null,
          },
          create: {
            schoolId,
            sessionId,
            classId: academicClass.id,
            subjectId: subject.subjectId,
            isMandatory: subject.isMandatory ?? true,
            periodsPerWeek: subject.periodsPerWeek ?? null,
          },
        });
      }

      return tx.classSubject.findMany({
        where: {
          schoolId,
          classId: academicClass.id,
          sessionId,
        },
        include: {
          subject: true,
          academicSession: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true,
              isActive: true,
            },
          },
        },
      });
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateClassCache(schoolId);
    await this.invalidateSubjectCache(schoolId);
    await this.auditService.write({
      action: 'classes.assign-subjects',
      entity: 'class',
      entityId: academicClass.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        className: academicClass.className,
        sessionId,
        subjectIds: uniqueSubjectIds,
      },
    });

    return {
      success: true,
      message: 'Class subjects updated successfully.',
      data: {
        id: academicClass.id,
        className: academicClass.className,
        sessionId,
        subjects: this.serializeClassSubjects(classSubjects),
      },
    };
  }

  private async resolveAcademicSessionId(
    schoolId: string,
    sessionId?: string | null,
  ) {
    if (sessionId) {
      const session = await this.prisma.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
          isActive: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Academic session not found for this school.');
      }

      return session.id;
    }

    const currentSession = await this.prisma.academicSession.findFirst({
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
        'No active current academic session found for this school.',
      );
    }

    return currentSession.id;
  }

  private async findClassOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolId?: string | null,
  ) {
    const scopeSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? schoolId ?? null
        : this.resolveWriteSchoolScope(currentUser, schoolId);

    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        id,
        ...(scopeSchoolId ? { schoolId: scopeSchoolId } : {}),
        isActive: true,
      },
      include: classDetailsInclude,
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found.');
    }

    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      academicClass.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return academicClass;
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

  private async ensureUniqueClass(
    schoolId: string,
    className?: string,
    classCode?: string,
    excludeId?: string,
  ) {
    if (className) {
      const existingByName = await this.prisma.academicClass.findFirst({
        where: {
          schoolId,
          className: {
            equals: className,
            mode: 'insensitive',
          },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByName) {
        throw new ConflictException('Class name already exists in this school.');
      }
    }

    if (classCode) {
      const existingByCode = await this.prisma.academicClass.findFirst({
        where: {
          schoolId,
          classCode: {
            equals: classCode,
            mode: 'insensitive',
          },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByCode) {
        throw new ConflictException('Class code already exists in this school.');
      }
    }
  }

  private async ensureUniqueSectionName(
    schoolId: string,
    classId: string,
    sectionName: string,
    excludeId?: string,
  ) {
    const existingSection = await this.prisma.section.findFirst({
      where: {
        schoolId,
        classId,
        sectionName: {
          equals: sectionName,
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existingSection) {
      throw new ConflictException('Section name already exists for this class.');
    }
  }

  private async generateClassCode(schoolId: string) {
    const totalClasses = await this.prisma.academicClass.count({
      where: {
        schoolId,
      },
    });

    let nextIndex = totalClasses + 1;

    while (true) {
      const candidate = `CLASS-${String(nextIndex).padStart(3, '0')}`;
      const existingClass = await this.prisma.academicClass.findFirst({
        where: {
          schoolId,
          classCode: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existingClass) {
        return candidate;
      }

      nextIndex += 1;
    }
  }

  private buildClassCacheKey(
    schoolScope: string,
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return `academics:classes:${schoolScope}:${JSON.stringify(params)}`;
  }

  private async invalidateClassCache(schoolId: string) {
    await this.redisService.deleteByPattern(`academics:classes:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:classes:all:*');
  }

  private async invalidateSectionCache(schoolId: string) {
    await this.redisService.deleteByPattern(`academics:sections:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:sections:all:*');
  }

  private async invalidateSubjectCache(schoolId: string) {
    await this.redisService.deleteByPattern(`academics:subjects:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:subjects:all:*');
  }

  private serializeClass(academicClass: AcademicClassWithDetails) {
    const sections = academicClass.sections
      .filter((section) => section.isActive)
      .map((section) => ({
        id: section.id,
        name: section.sectionName,
        roomNo: section.roomNo,
        capacity: section.capacity,
        status: section.isActive ? 'ACTIVE' : 'INACTIVE',
      }));

    return {
      id: academicClass.id,
      classCode: academicClass.classCode,
      name: academicClass.className,
      className: academicClass.className,
      gradeLevel: academicClass.gradeLevel,
      sortOrder: academicClass.sortOrder,
      schoolId: academicClass.schoolId,
      status: academicClass.isActive ? 'ACTIVE' : 'INACTIVE',
      isActive: academicClass.isActive,
      sections,
      subjects: this.serializeClassSubjects(academicClass.classSubjects),
      createdAt: academicClass.createdAt,
      updatedAt: academicClass.updatedAt,
    };
  }

  private serializeClassSubjects(
    classSubjects: Array<
      Prisma.ClassSubjectGetPayload<{
        include: {
          subject: true;
          academicSession: {
            select: {
              id: true;
              sessionName: true;
              isCurrent: true;
              isActive?: true;
            };
          };
        };
      }>
    >,
  ) {
    const sortedAssignments = [...classSubjects].sort((left, right) => {
      if (left.academicSession.isCurrent === right.academicSession.isCurrent) {
        return left.subject.subjectName.localeCompare(right.subject.subjectName);
      }

      return left.academicSession.isCurrent ? -1 : 1;
    });

    const subjects = new Map<
      string,
      {
        id: string;
        subjectCode: string;
        name: string;
        subjectType: string;
        isOptional: boolean;
        isMandatory: boolean;
        periodsPerWeek: number | null;
        sessionId: string;
        sessionName: string;
      }
    >();

    for (const assignment of sortedAssignments) {
      if (!assignment.subject.isActive || subjects.has(assignment.subjectId)) {
        continue;
      }

      subjects.set(assignment.subjectId, {
        id: assignment.subject.id,
        subjectCode: assignment.subject.subjectCode,
        name: assignment.subject.subjectName,
        subjectType: assignment.subject.subjectType,
        isOptional: assignment.subject.isOptional,
        isMandatory: assignment.isMandatory,
        periodsPerWeek: assignment.periodsPerWeek,
        sessionId: assignment.academicSession.id,
        sessionName: assignment.academicSession.sessionName,
      });
    }

    return [...subjects.values()];
  }
}
