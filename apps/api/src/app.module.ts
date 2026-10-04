import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envSchema } from './env.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { StacModule } from './modules/stac/stac.module.js';
import { PrismaModule } from './prisma.module.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Module({
  imports: [
    // Loads apps/api/.env (if present) and validates it with the zod schema.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    CatalogModule,
    StacModule,
  ],
  controllers: [AppController],
  // 전역 파이프와 필터를 모듈에 둬서 main.ts와 e2e 테스트가 같은 설정을 쓴다.
  providers: [
    AppService,
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
