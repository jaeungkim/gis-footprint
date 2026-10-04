import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from './env.js';
import { PrismaClient } from './generated/prisma/client.js';

// No onModuleInit $connect: with the pg adapter it connects lazily anyway, so
// the API boots without a database and /api/health reports it.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        // pg has no connect timeout by default; Prisma 6 used 5s.
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  // Closes the pool on shutdown (enableShutdownHooks in main.ts).
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
