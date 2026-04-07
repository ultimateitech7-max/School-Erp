import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface ListPushOptions {
  maxLength?: number;
  ttlSeconds?: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured. Continuing without Redis cache.',
      );
      return;
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 10_000,
      retryStrategy: () => null,
    });

    client.on('connect', () => {
      if (this.client === client) {
        this.logger.log('Connected to Redis.');
      }
    });

    client.on('error', (error) => {
      if (this.client === client) {
        this.disableRedis(
          `Redis connection error: ${error.message}. Continuing without cache.`,
        );
      }
    });

    client.on('close', () => {
      if (this.client === client) {
        this.disableRedis(
          'Redis connection closed. Continuing without cache.',
          false,
        );
      }
    });

    this.client = client;
  }

  async onModuleInit() {
    const client = this.client;

    if (!client) {
      return;
    }

    try {
      await client.connect();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis connection error';

      this.disableRedis(
        `Redis connection failed: ${message}. Continuing without cache.`,
      );
    }
  }

  async onModuleDestroy() {
    const client = this.client;
    this.client = null;

    if (client && client.status !== 'end') {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  }

  getClient() {
    return this.client;
  }

  buildStudentListKey(schoolId: string, suffix: string) {
    return `school:${schoolId}:students:${suffix}`;
  }

  buildReportCardKey(schoolId: string, studentId: string, examId: string) {
    return `school:${schoolId}:report-card:${studentId}:${examId}`;
  }

  async get(key: string): Promise<string | null> {
    const client = this.client;

    if (!client) {
      return null;
    }

    try {
      return await client.get(key);
    } catch (error) {
      this.handleOperationFailure('get', key, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.client;

    if (!client) {
      return;
    }

    try {
      if (ttlSeconds) {
        await client.set(key, value, 'EX', ttlSeconds);
        return;
      }

      await client.set(key, value);
    } catch (error) {
      this.handleOperationFailure('set', key, error);
    }
  }

  async del(key: string): Promise<void> {
    const client = this.client;

    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      this.handleOperationFailure('del', key, error);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      await this.del(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getJson<T>(key);

    if (cached !== null) {
      return cached;
    }

    const freshValue = await factory();
    await this.setJson(key, freshValue, ttlSeconds);
    return freshValue;
  }

  async delete(key: string) {
    await this.del(key);
  }

  async deleteByPattern(pattern: string) {
    const client = this.client;

    if (!client) {
      return;
    }

    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.handleOperationFailure('scan', pattern, error);
    }
  }

  async pushToList(
    key: string,
    payload: unknown,
    options: ListPushOptions = {},
  ) {
    const client = this.client;

    if (!client) {
      return;
    }

    const pipeline = client.pipeline();
    const maxLength = options.maxLength ?? 2_000;
    const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 24 * 30;

    try {
      pipeline.lpush(key, JSON.stringify(payload));
      pipeline.ltrim(key, 0, maxLength - 1);
      pipeline.expire(key, ttlSeconds);
      await pipeline.exec();
    } catch (error) {
      this.handleOperationFailure('lpush', key, error);
    }
  }

  private handleOperationFailure(
    operation: string,
    key: string,
    error: unknown,
  ) {
    const message =
      error instanceof Error ? error.message : 'Unknown Redis operation error';

    this.disableRedis(
      `Redis ${operation} failed for key "${key}": ${message}. Continuing without cache.`,
    );
  }

  private disableRedis(message: string, disconnect = true) {
    const client = this.client;

    this.logger.warn(message);
    this.client = null;

    if (disconnect && client && client.status !== 'end') {
      client.disconnect();
    }
  }
}
