import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { systemResponses } from '../contracts/system.responses';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = systemResponses.EN.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Map common error messages to appropriate status codes
      if (message === systemResponses.EN.USER_EMAIL_EXISTS) {
        status = HttpStatus.CONFLICT;
      } else if (message === systemResponses.EN.AUTHENTICATION_FAILED) {
        status = HttpStatus.UNAUTHORIZED;
      } else if (message === systemResponses.EN.USER_NOT_FOUND) {
        status = HttpStatus.NOT_FOUND;
      } else if (message === systemResponses.EN.INVALID_OTP) {
        status = HttpStatus.BAD_REQUEST;
      }
    }

    // Log the error (you might want to use a proper logging service in production)
    console.error('Exception:', {
      status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    });

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    });
  }
} 