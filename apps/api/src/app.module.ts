import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envSchema } from './env.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { StacModule } from './modules/stac/stac.module.js';
import { PrismaModule } from './prisma.module.js';

@Module({
  imports: [
    // Loads apps/api/.env (if present) and validates it with the zod schema.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    CatalogModule,
    StacModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
