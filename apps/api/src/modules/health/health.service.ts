import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async check() {
    const startedAt = process.uptime();
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const appName = this.configService.get<string>('APP_NAME', 'School ERP API');
    const version = process.env.npm_package_version ?? '1.0.0';

    const payload = {
      success: true as const,
      message: database.status === 'ok'
        ? 'Health check completed successfully.'
        : 'Health check failed.',
      data: {
        status: database.status === 'ok' ? 'ok' : 'error',
        appName,
        environment,
        version,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(startedAt),
        services: {
          database,
          redis,
        },
      },
    };

    if (database.status !== 'ok') {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok' as const,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message:
          error instanceof Error ? error.message : 'Database health check failed.',
      };
    }
  }

  private async checkRedis() {
    const client = this.redisService.getClient();

    if (!client) {
      return {
        status: 'disabled' as const,
        message: 'Redis is not configured.',
      };
    }

    try {
      const response = await client.ping();

      return {
        status: response === 'PONG' ? 'ok' as const : 'degraded' as const,
        message: response,
      };
    } catch (error) {
      return {
        status: 'degraded' as const,
        message:
          error instanceof Error ? error.message : 'Redis health check failed.',
      };
    }
  }
}
