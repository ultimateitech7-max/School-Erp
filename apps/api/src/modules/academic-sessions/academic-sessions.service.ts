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
import { AcademicSessionQueryDto } from './dto/academic-session-query.dto';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

const SESSION_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const ACADEMIC_SESSION_STATUSES = ['ACTIVE', 'INACTIVE', 'COMPLETED'] as const;

type AcademicSessionStatus = (typeof ACADEMIC_SESSION_STATUSES)[number];

const academicSessionSelect = Prisma.validator<Prisma.AcademicSessionSelect>()({
  id: true,
  schoolId: true,
  sessionName: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

type AcademicSessionRecord = Prisma.AcademicSessionGetPayload<{
  select: typeof academicSessionSelect;
}>;

@Injectable()
export class AcademicSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateAcademicSessionDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const sessionName = dto.name.trim();
    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');

    this.ensureValidDateRange(startDate, endDate);
    await this.ensureUniqueSessionName(schoolId, sessionName);

    const shouldMakeCurrent = dto.isCurrent ?? false;
    const academicSession = await this.prisma.$transaction(async (tx) => {
      if (shouldMakeCurrent) {
        await tx.academicSession.updateMany({
          where: {
            schoolId,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });
      }

      return tx.academicSession.create({
        data: {
          schoolId,
          sessionName,
          startDate,
          endDate,
          isCurrent: shouldMakeCurrent,
          isActive: dto.isActive ?? true,
        },
        select: academicSessionSelect,
      });
    });

    await this.invalidateAcademicSessionCache(schoolId);
    await this.auditService.write({
      action: 'academic_sessions.create',
      entity: 'academic_session',
      entityId: academicSession.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        sessionName: academicSession.sessionName,
        isCurrent: academicSession.isCurrent,
      },
    });

    return {
      success: true,
      message: 'Academic session created successfully.',
      data: this.serializeAcademicSession(academicSession),
    };
  }

  async findAll(currentUser: JwtUser, query: AcademicSessionQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const isActive = this.normalizeOptionalBoolean(query.isActive);
    const isCurrent = this.normalizeOptionalBoolean(query.isCurrent);
    const shouldBypassCache =
      Boolean(search) || isCurrent !== undefined || Boolean(query.status);
    const cacheKey = this.buildAcademicSessionCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      isActive,
      isCurrent,
      status: query.status,
    });
    const factory = async () => {
      const where = this.buildAcademicSessionWhere({
        schoolId,
        search,
        isActive,
        isCurrent,
        status: query.status,
      });

      const [items, total] = await Promise.all([
        this.prisma.academicSession.findMany({
          where,
          select: academicSessionSelect,
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.academicSession.count({ where }),
      ]);

      return {
        items: items.map((item) => this.serializeAcademicSession(item)),
        meta: {
          page,
          limit,
          total,
        },
      };
    };
    const payload = shouldBypassCache
      ? await factory()
      : await this.redisService.remember(
          cacheKey,
          SESSION_LIST_TTL_SECONDS,
          factory,
        );

    return {
      success: true,
      message: 'Academic sessions fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findCurrent(currentUser: JwtUser, schoolId?: string | null) {
    const resolvedSchoolId = this.resolveRequiredReadSchoolScope(
      currentUser,
      schoolId,
      'schoolId is required to fetch the current academic session for a platform-scoped super admin.',
    );
    const academicSession = await this.getCurrentAcademicSession(
      resolvedSchoolId,
    );

    if (!academicSession) {
      throw new NotFoundException('Current academic session not found.');
    }

    return {
      success: true,
      message: 'Current academic session fetched successfully.',
      data: this.serializeAcademicSession(academicSession),
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const resolvedSchoolId = this.resolveReadSchoolScope(currentUser, schoolId);
    const academicSession = await this.getAcademicSessionByIdScoped(
      id,
      resolvedSchoolId,
    );

    return {
      success: true,
      message: 'Academic session fetched successfully.',
      data: this.serializeAcademicSession(academicSession),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateAcademicSessionDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const existingSession = await this.getAcademicSessionByIdScoped(id, schoolId);
    const sessionName = dto.name?.trim() ?? existingSession.sessionName;
    const startDate = dto.startDate
      ? this.parseDate(dto.startDate, 'startDate')
      : existingSession.startDate;
    let endDate = dto.endDate
      ? this.parseDate(dto.endDate, 'endDate')
      : existingSession.endDate;
    let isActive = existingSession.isActive;
    let shouldUnsetCurrent = false;

    this.ensureValidDateRange(startDate, endDate);

    if (
      sessionName.toLowerCase() !== existingSession.sessionName.toLowerCase()
    ) {
      await this.ensureUniqueSessionName(schoolId, sessionName, id);
    }

    if (dto.status) {
      if (dto.status === 'ACTIVE') {
        isActive = true;
      }

      if (dto.status === 'INACTIVE') {
        isActive = false;
        shouldUnsetCurrent = true;
      }

      if (dto.status === 'COMPLETED') {
        if (existingSession.isCurrent) {
          throw new BadRequestException(
            'Current academic session cannot be marked as completed. Set another session as current first.',
          );
        }

        isActive = false;
        shouldUnsetCurrent = true;

        const today = this.todayDate();

        if (endDate.getTime() > today.getTime()) {
          endDate = today;
        }
      }
    }

    const academicSession = await this.prisma.$transaction(async (tx) => {
      if (existingSession.isCurrent && shouldUnsetCurrent) {
        await tx.academicSession.update({
          where: { id },
          data: {
            isCurrent: false,
          },
        });
      }

      return tx.academicSession.update({
        where: { id },
        data: {
          sessionName,
          startDate,
          endDate,
          isActive,
          ...(shouldUnsetCurrent ? { isCurrent: false } : {}),
        },
        select: academicSessionSelect,
      });
    });

    await this.invalidateAcademicSessionCache(schoolId);
    await this.auditService.write({
      action: 'academic_sessions.update',
      entity: 'academic_session',
      entityId: academicSession.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        sessionName: academicSession.sessionName,
        isCurrent: academicSession.isCurrent,
        isActive: academicSession.isActive,
      },
    });

    return {
      success: true,
      message: 'Academic session updated successfully.',
      data: this.serializeAcademicSession(academicSession),
    };
  }

  async setCurrent(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const resolvedSchoolId = this.resolveWriteSchoolScope(currentUser, schoolId);
    const existingSession = await this.getAcademicSessionByIdScoped(
      id,
      resolvedSchoolId,
    );

    const academicSession = await this.prisma.$transaction(async (tx) => {
      await tx.academicSession.updateMany({
        where: {
          schoolId: resolvedSchoolId,
          isCurrent: true,
          id: {
            not: id,
          },
        },
        data: {
          isCurrent: false,
        },
      });

      return tx.academicSession.update({
        where: {
          id,
        },
        data: {
          isCurrent: true,
          isActive: true,
        },
        select: academicSessionSelect,
      });
    });

    await this.invalidateAcademicSessionCache(resolvedSchoolId);
    await this.auditService.write({
      action: 'academic_sessions.set_current',
      entity: 'academic_session',
      entityId: academicSession.id,
      actorUserId: currentUser.id,
      schoolId: resolvedSchoolId,
      metadata: {
        sessionName: academicSession.sessionName,
        previousState: {
          isCurrent: existingSession.isCurrent,
        },
      },
    });

    return {
      success: true,
      message: 'Current academic session updated successfully.',
      data: this.serializeAcademicSession(academicSession),
    };
  }

  async getCurrentAcademicSession(schoolId: string) {
    return this.prisma.academicSession.findFirst({
      where: {
        schoolId,
        isCurrent: true,
      },
      select: academicSessionSelect,
      orderBy: [
        {
          updatedAt: 'desc',
        },
      ],
    });
  }

  async getAcademicSessionByIdScoped(id: string, schoolId?: string | null) {
    return this.findAcademicSessionOrThrow(id, schoolId);
  }

  async validateAcademicSessionAccess(id: string, schoolId?: string | null) {
    return this.findAcademicSessionOrThrow(id, schoolId);
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for super admin academic session creation.',
        );
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('A school-scoped authenticated user is required.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'You can only manage academic sessions for your own school.',
      );
    }

    return currentUser.schoolId;
  }

  private resolveReadSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('A school-scoped authenticated user is required.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'You can only access academic sessions from your own school.',
      );
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

  private parseDate(value: string, field: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date.`);
    }

    return new Date(date.toISOString().slice(0, 10));
  }

  private ensureValidDateRange(startDate: Date, endDate: Date) {
    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate.');
    }
  }

  private todayDate() {
    return this.parseDate(new Date().toISOString().slice(0, 10), 'today');
  }

  private async findAcademicSessionOrThrow(id: string, schoolId?: string | null) {
    const academicSession = await this.prisma.academicSession.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      select: academicSessionSelect,
    });

    if (!academicSession) {
      throw new NotFoundException('Academic session not found.');
    }

    return academicSession;
  }

  private async ensureUniqueSessionName(
    schoolId: string,
    sessionName: string,
    excludeId?: string,
  ) {
    const existingSession = await this.prisma.academicSession.findFirst({
      where: {
        schoolId,
        sessionName: {
          equals: sessionName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingSession) {
      throw new ConflictException(
        'Academic session name already exists for this school.',
      );
    }
  }

  private buildAcademicSessionWhere({
    schoolId,
    search,
    isActive,
    isCurrent,
    status,
  }: {
    schoolId: string | null;
    search: string;
    isActive?: boolean;
    isCurrent?: boolean;
    status?: AcademicSessionStatus;
  }): Prisma.AcademicSessionWhereInput {
    const today = this.todayDate();
    const where: Prisma.AcademicSessionWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(search
        ? {
            sessionName: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(isCurrent !== undefined ? { isCurrent } : {}),
    };

    if (status) {
      if (!ACADEMIC_SESSION_STATUSES.includes(status)) {
        throw new BadRequestException('Invalid academic session status filter.');
      }

      if (status === 'ACTIVE') {
        where.isActive = true;
      }

      if (status === 'INACTIVE') {
        where.isActive = false;
        where.endDate = {
          gt: today,
        };
      }

      if (status === 'COMPLETED') {
        where.isActive = false;
        where.endDate = {
          lte: today,
        };
      }
    }

    return where;
  }

  private serializeAcademicSession(session: AcademicSessionRecord) {
    const today = this.todayDate();
    const status =
      !session.isActive && session.endDate.getTime() <= today.getTime()
        ? 'COMPLETED'
        : session.isActive
          ? 'ACTIVE'
          : 'INACTIVE';

    return {
      id: session.id,
      name: session.sessionName,
      startDate: session.startDate,
      endDate: session.endDate,
      isCurrent: session.isCurrent,
      isActive: session.isActive,
      status,
      schoolId: session.schoolId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private buildAcademicSessionCacheKey(
    scope: string,
    query: Record<string, string | number | boolean | undefined>,
  ) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }

    return `school:${scope}:academic-sessions:${searchParams.toString() || 'default'}`;
  }

  private normalizeOptionalBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }
    }

    return undefined;
  }

  private async invalidateAcademicSessionCache(schoolId: string) {
    await Promise.all([
      this.redisService.deleteByPattern(
        `school:${schoolId}:academic-sessions:*`,
      ),
      this.redisService.deleteByPattern('school:all:academic-sessions:*'),
    ]);
  }
}
