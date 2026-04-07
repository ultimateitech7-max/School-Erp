import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ValidationErrorResponse {
  message?: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, errors } = this.extractErrorPayload(exception);
    const payload = {
      success: false,
      statusCode,
      message,
      errors,
      path: request.originalUrl ?? request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId: request.headers['x-request-id']?.toString() ?? 'unavailable',
    };

    const logLine = `${request.method} ${request.originalUrl ?? request.url} -> ${statusCode}`;
    const stack =
      exception instanceof Error ? exception.stack : JSON.stringify(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, stack);
    } else {
      this.logger.warn(`${logLine} | ${message}`);
    }

    response.status(statusCode).json(payload);
  }

  private extractErrorPayload(exception: unknown) {
    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'string') {
        return { message: errorResponse, errors: undefined };
      }

      const typedResponse = errorResponse as ValidationErrorResponse;
      const errors = Array.isArray(typedResponse.message)
        ? typedResponse.message
        : undefined;

      return {
        message: errors ? 'Validation failed.' : exception.message,
        errors,
      };
    }

    if (exception instanceof Error) {
      return {
        message: exception.message || 'Internal server error.',
        errors: undefined,
      };
    }

    return {
      message: 'Internal server error.',
      errors: undefined,
    };
  }
}
