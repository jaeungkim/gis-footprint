import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// Nest 문서(pipes)의 ZodValidationPipe. 실패는 400 Problem Details의 errors 배열로 바꾼다.
// 내장 StandardSchemaValidationPipe + @Body({ schema })는 swagger가 스키마로 문서를 다시 만들어서
// 손으로 적은 검색 문서(ApiBody, ApiQuery)를 덮는다. 그래서 파이프로 건다.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      message: '요청 검증 실패',
      errors: result.error.issues.map((i) => ({
        field: i.path.map(String).join('.'),
        message: i.message,
      })),
    });
  }
}
