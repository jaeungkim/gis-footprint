import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // STAC 응답의 href 앞에 붙는 절대 URL. Host 헤더는 조작할 수 있어서 안 믿는다.
  STAC_PUBLIC_URL: z
    .url()
    .default('http://localhost:3001')
    .transform((u) => u.replace(/\/+$/, '')),
});

export type Env = z.infer<typeof envSchema>;
