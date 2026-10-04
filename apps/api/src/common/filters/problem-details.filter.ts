import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

// RFC 9457 Problem Details. 필드 오류는 errors 배열에 담는다(spec.md API 규칙).
export interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
  detail?: string;
  errors?: { field?: string; message: string }[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const problem = toProblem(exception);
    if (problem.status >= 500) this.logger.error(exception);
    res.status(problem.status).type('application/problem+json').send(problem);
  }
}

// HttpException만 상세를 낸다. 그 외(GEOS, DB 오류 등)는 SQL이나 스택이 섞일 수 있어 고정 500.
export function toProblem(exception: unknown): Problem {
  if (!(exception instanceof HttpException)) {
    return { type: 'about:blank', title: 'Internal Server Error', status: 500 };
  }
  const status = exception.getStatus();
  const title = STATUS_CODES[status] ?? 'Error';
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return { type: 'about:blank', title, status, detail: body };
  }
  const { message, errors } = body as {
    message?: unknown;
    errors?: Problem['errors'];
  };
  const problem: Problem = { type: 'about:blank', title, status };
  if (typeof message === 'string' && message !== title) {
    problem.detail = message;
  }
  // class-validator ValidationPipe는 message를 문자열 배열로 준다.
  if (Array.isArray(message)) {
    problem.errors = message.map((m) => ({ message: String(m) }));
  }
  if (errors) problem.errors = errors;
  return problem;
}
