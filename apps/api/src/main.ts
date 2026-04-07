import { LogLevel, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: resolveLogLevels(process.env.LOG_LEVEL),
  });
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const apiPrefix = normalizePrefix(
    configService.get<string>('API_PREFIX', 'api/v1'),
  );
  const isProduction =
    configService.get<string>('NODE_ENV', 'development') === 'production';
  const host = configService.get<string>('HOST', '0.0.0.0');
  const port = Number(configService.get<string>('PORT', '4000'));
  const corsConfig = buildCorsConfig(
    configService.get<string>('CORS_ORIGINS'),
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('FRONTEND_URLS'),
  );
  const trustProxy = parseTrustProxy(configService.get<string>('TRUST_PROXY'));
  const httpAdapter = app.getHttpAdapter().getInstance();

  if (typeof httpAdapter.disable === 'function') {
    httpAdapter.disable('x-powered-by');
  }

  if (trustProxy !== false && typeof httpAdapter.set === 'function') {
    httpAdapter.set('trust proxy', trustProxy);
  }

  app.setGlobalPrefix(apiPrefix);
  app.enableShutdownHooks();
  app.enableCors({
    origin: corsConfig.origin,
    credentials: corsConfig.credentials,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: isProduction,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await prismaService.enableShutdownHooks(app);
  await app.listen(port, host);
  logger.log(`API listening on ${await app.getUrl()}/${apiPrefix}`);
}

void bootstrap();

function resolveLogLevels(value?: string): LogLevel[] {
  const defaultLevels: LogLevel[] =
    process.env.NODE_ENV === 'production'
      ? ['log', 'error', 'warn']
      : ['log', 'error', 'warn', 'debug', 'verbose'];

  if (!value) {
    return defaultLevels;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as LogLevel[];
}

function normalizePrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, '') || 'api/v1';
}

function buildCorsConfig(
  corsOrigins?: string,
  frontendUrl?: string,
  frontendUrls?: string,
) {
  const allowedOrigins = new Set<string>();

  for (const source of [corsOrigins, frontendUrls]) {
    for (const value of (source ?? '').split(',')) {
      const normalized = value.trim();

      if (normalized) {
        allowedOrigins.add(normalized);
      }
    }
  }

  if (frontendUrl?.trim()) {
    allowedOrigins.add(frontendUrl.trim());
  }

  if (allowedOrigins.size === 0 && process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://localhost:3001');
    allowedOrigins.add('http://127.0.0.1:3001');
  }

  return {
    credentials: true,
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
  };
}

function parseTrustProxy(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'false') {
    return false;
  }

  if (normalized === 'true') {
    return true;
  }

  if (Number.isInteger(Number(normalized))) {
    return Number(normalized);
  }

  return value;
}
