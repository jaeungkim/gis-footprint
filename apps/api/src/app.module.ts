import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { CatalogModule } from './catalog/catalog.module.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { envSchema } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StacModule } from './stac/stac.module.js';

@Module({
  imports: [
    // Loads apps/api/.env (if present) and validates it with the zod schema.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    HealthModule,
    CatalogModule,
    StacModule,
  ],
  // 전역 파이프와 필터를 모듈에 둬서 main.ts와 e2e 테스트가 같은 설정을 쓴다.
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
