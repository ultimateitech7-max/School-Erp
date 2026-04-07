import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

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

  constructor(private readonly redisService: RedisService) {}

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
}
