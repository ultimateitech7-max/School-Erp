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
import { CreateSectionDto } from './dto/create-section.dto';
import { SectionQueryDto } from './dto/section-query.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

const SECTION_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const sectionDetailsInclude = Prisma.validator<Prisma.SectionInclude>()({
  academicClass: {
    select: {
      id: true,
      classCode: true,
      className: true,
      gradeLevel: true,
      isActive: true,
    },
  },
});

type SectionWithClass = Prisma.SectionGetPayload<{
  include: typeof sectionDetailsInclude;
}>;

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateSectionDto) {
    const academicClass = await this.findClassOrThrow(
      currentUser,
      dto.classId,
      dto.schoolId ?? null,
    );
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
      include: sectionDetailsInclude,
    });

    await this.invalidateCaches(section.schoolId);
    await this.auditService.write({
      action: 'sections.create',
      entity: 'section',
      entityId: section.id,
      actorUserId: currentUser.id,
      schoolId: section.schoolId,
      metadata: {
        sectionName: section.sectionName,
        className: section.academicClass.className,
      },
    });

    return {
      success: true,
      message: 'Section created successfully.',
      data: this.serializeSection(section),
    };
  }

  async findAll(currentUser: JwtUser, query: SectionQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildSectionCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      classId: query.classId,
      isActive: query.isActive,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      SECTION_LIST_TTL_SECONDS,
      async () => {
        if (query.classId) {
          await this.findClassOrThrow(currentUser, query.classId, schoolId);
        }

        const where: Prisma.SectionWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.isActive !== undefined
            ? { isActive: query.isActive }
            : { isActive: true }),
          ...(search
            ? {
                OR: [
                  {
                    sectionName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    roomNo: {
                      contains: search,
                      mode: 'insensitive',
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
                ],
              }
            : {}),
        };

        const [sections, total] = await Promise.all([
          this.prisma.section.findMany({
            where,
            include: sectionDetailsInclude,
            orderBy: [
              {
                academicClass: {
                  sortOrder: 'asc',
                },
              },
              {
                sectionName: 'asc',
              },
            ],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.section.count({ where }),
        ]);

        return {
          items: sections.map((section) => this.serializeSection(section)),
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
      message: 'Sections fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const section = await this.findSectionOrThrow(currentUser, id, schoolId);

    return {
      success: true,
      message: 'Section fetched successfully.',
      data: this.serializeSection(section),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateSectionDto) {
    const section = await this.findSectionOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const sectionName = dto.sectionName?.trim() ?? section.sectionName;
    let targetClassId = section.academicClass.id;

    if (dto.classId) {
      const targetClass = await this.findClassOrThrow(
        currentUser,
        dto.classId,
        section.schoolId,
      );

      if (targetClass.schoolId !== section.schoolId) {
        throw new ForbiddenException('Section cannot be moved to another school.');
      }

      targetClassId = targetClass.id;
    }

    await this.ensureUniqueSectionName(
      section.schoolId,
      targetClassId,
      sectionName,
      section.id,
    );

    const updatedSection = await this.prisma.section.update({
      where: { id: section.id },
      data: {
        classId: targetClassId,
        sectionName,
        ...(dto.roomNo !== undefined ? { roomNo: dto.roomNo ?? null } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: sectionDetailsInclude,
    });

    await this.invalidateCaches(updatedSection.schoolId);
    await this.auditService.write({
      action: 'sections.update',
      entity: 'section',
      entityId: updatedSection.id,
      actorUserId: currentUser.id,
      schoolId: updatedSection.schoolId,
      metadata: {
        sectionName: updatedSection.sectionName,
      },
    });

    return {
      success: true,
      message: 'Section updated successfully.',
      data: this.serializeSection(updatedSection),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const section = await this.findSectionOrThrow(currentUser, id, schoolId);

    await this.prisma.section.update({
      where: { id: section.id },
      data: {
        isActive: false,
      },
    });

    await this.invalidateCaches(section.schoolId);
    await this.auditService.write({
      action: 'sections.delete',
      entity: 'section',
      entityId: section.id,
      actorUserId: currentUser.id,
      schoolId: section.schoolId,
      metadata: {
        sectionName: section.sectionName,
      },
    });

    return {
      success: true,
      message: 'Section deleted successfully.',
      data: {
        id: section.id,
        deleted: true,
      },
    };
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
      select: {
        id: true,
        schoolId: true,
        classCode: true,
        className: true,
        gradeLevel: true,
        isActive: true,
      },
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found.');
    }

    return academicClass;
  }

  private async findSectionOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolId?: string | null,
  ) {
    const scopeSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? schoolId ?? null
        : this.resolveWriteSchoolScope(currentUser, schoolId);

    const section = await this.prisma.section.findFirst({
      where: {
        id,
        ...(scopeSchoolId ? { schoolId: scopeSchoolId } : {}),
        isActive: true,
      },
      include: sectionDetailsInclude,
    });

    if (!section) {
      throw new NotFoundException('Section not found.');
    }

    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      section.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return section;
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

  private buildSectionCacheKey(
    schoolScope: string,
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return `academics:sections:${schoolScope}:${JSON.stringify(params)}`;
  }

  private async invalidateCaches(schoolId: string) {
    await this.redisService.deleteByPattern(`academics:sections:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:sections:all:*');
    await this.redisService.deleteByPattern(`academics:classes:${schoolId}:*`);
    await this.redisService.deleteByPattern('academics:classes:all:*');
  }

  private serializeSection(section: SectionWithClass) {
    return {
      id: section.id,
      name: section.sectionName,
      sectionName: section.sectionName,
      roomNo: section.roomNo,
      capacity: section.capacity,
      schoolId: section.schoolId,
      status: section.isActive ? 'ACTIVE' : 'INACTIVE',
      isActive: section.isActive,
      class: {
        id: section.academicClass.id,
        classCode: section.academicClass.classCode,
        className: section.academicClass.className,
        gradeLevel: section.academicClass.gradeLevel,
      },
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
