import {
  INestApplication,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = PrismaService.resolveDatasourceUrl();

    super({
      ...(datasourceUrl
        ? {
            datasources: {
              db: {
                url: datasourceUrl,
              },
            },
          }
        : {}),
      log:
        process.env.NODE_ENV === 'development'
          ? ['info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma.');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      this.logger.warn(
        `Prisma startup connection deferred: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  schoolWhere<T extends Record<string, unknown>>(schoolId: string, where?: T) {
    return {
      ...(where ?? {}),
      schoolId,
    };
  }

  private static resolveDatasourceUrl() {
    const rawUrl = process.env.DATABASE_URL;

    if (!rawUrl) {
      return undefined;
    }

    try {
      const url = new URL(rawUrl);

      if (
        url.hostname.includes('pooler.supabase.com') &&
        !url.searchParams.has('connection_limit')
      ) {
        url.searchParams.set('connection_limit', '5');
      }

      if (
        url.hostname.includes('pooler.supabase.com') &&
        !url.searchParams.has('pool_timeout')
      ) {
        url.searchParams.set('pool_timeout', '30');
      }

      if (
        url.hostname.includes('pooler.supabase.com') &&
        !url.searchParams.has('connect_timeout')
      ) {
        url.searchParams.set('connect_timeout', '30');
      }

      return url.toString();
    } catch {
      return rawUrl;
    }
  }
}
