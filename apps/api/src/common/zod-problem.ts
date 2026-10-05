import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

// zod 검증 실패를 400 Problem Details(errors 배열)로 바꾼다.
export function parseOrThrow<T>(
  schema: ZodType<T>,
  input: unknown,
  what = '요청',
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new BadRequestException({
    message: `${what} 검증 실패`,
    errors: result.error.issues.map((i) => ({
      field: i.path.map(String).join('.'),
      message: i.message,
    })),
  });
}
