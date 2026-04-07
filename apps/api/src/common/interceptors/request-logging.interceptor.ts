import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { id?: string; schoolId?: string | null };
    }>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();

    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              requestId,
              method: request.method,
              path: request.originalUrl ?? request.url,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
              ipAddress: request.ip,
              userId: request.user?.id ?? null,
              schoolId: request.user?.schoolId ?? null,
            }),
          );
        },
        error: (error: unknown) => {
          this.logger.error(
            JSON.stringify({
              requestId,
              method: request.method,
              path: request.originalUrl ?? request.url,
              durationMs: Date.now() - startedAt,
              ipAddress: request.ip,
              userId: request.user?.id ?? null,
              schoolId: request.user?.schoolId ?? null,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        },
      }),
    );
  }
}
