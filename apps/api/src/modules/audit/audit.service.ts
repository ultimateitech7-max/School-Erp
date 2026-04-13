import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

export interface AuditLogEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  actorUserId?: string | null;
  schoolId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async write(entry: AuditLogEntry) {
    const payload = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(JSON.stringify(payload));

    try {
      await this.redisService.pushToList(
        `audit:${entry.schoolId ?? 'platform'}`,
        payload,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown audit write failure';

      this.logger.error(`Failed to persist audit event: ${message}`);
    }
  }

  async findLogs(currentUser: JwtUser, query: AuditLogQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId ?? null);
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const search = query.search?.trim().toLowerCase() ?? '';
    const records = await this.redisService.getListJson<
      AuditLogEntry & { timestamp: string }
    >(`audit:${schoolId ?? 'platform'}`, 0, 499);
    const actorIds = Array.from(
      new Set(records.map((item) => item.actorUserId).filter(Boolean) as string[]),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: {
              in: actorIds,
            },
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: {
              select: {
                roleType: true,
              },
            },
          },
        })
      : [];
    const actorsById = new Map(actors.map((item) => [item.id, item]));

    const filtered = records
      .map((record, index) => {
        const actor = record.actorUserId ? actorsById.get(record.actorUserId) : null;

        return {
          id: `${record.timestamp}-${record.entity}-${record.entityId ?? index}`,
          timestamp: record.timestamp,
          action: record.action,
          entity: record.entity,
          entityId: record.entityId ?? null,
          schoolId: record.schoolId ?? null,
          metadata: record.metadata ?? {},
          actor: actor
            ? {
              id: actor.id,
              name: actor.fullName,
              email: actor.email,
              role: actor.role.roleType,
            }
          : null,
        };
      })
      .filter((record) => {
        if (query.actorUserId && record.actor?.id !== query.actorUserId) {
          return false;
        }

        if (query.actorRole && record.actor?.role !== query.actorRole) {
          return false;
        }

        if (!search) {
          return true;
        }

        const metadataText = JSON.stringify(record.metadata).toLowerCase();
        const actorText = `${record.actor?.name ?? ''} ${record.actor?.email ?? ''}`.toLowerCase();

        return (
          record.action.toLowerCase().includes(search) ||
          record.entity.toLowerCase().includes(search) ||
          actorText.includes(search) ||
          metadataText.includes(search)
        );
      });

    const total = filtered.length;
    const items = filtered.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      message: 'Activity logs fetched successfully.',
      data: items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride ?? null);
    const users = await this.prisma.user.findMany({
      where:
        schoolId === null
          ? {
              role: {
                roleType: RoleType.SUPER_ADMIN,
              },
            }
          : {
              schoolId,
            },
      orderBy: [{ fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        email: true,
        role: {
          select: {
            roleType: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Activity log options fetched successfully.',
      data: {
        users: users.map((item) => ({
          id: item.id,
          name: item.fullName,
          email: item.email,
          role: item.role.roleType,
        })),
      },
    };
  }

  private resolveSchoolScope(currentUser: JwtUser, schoolIdOverride?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolIdOverride ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolIdOverride && schoolIdOverride !== currentUser.schoolId) {
      throw new NotFoundException('Activity log not found.');
    }

    return currentUser.schoolId;
  }
}
