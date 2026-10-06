import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        connectionTimeoutMillis: 5_000,
        // adapter-pg는 Date 파라미터를 시간대 없이 보내고 timestamptz를 UTC로 읽는다.
        // 세션 시간대가 UTC가 아니면(Asia/Seoul 서버 등) 시각 조건이 그만큼 밀린다.
        options: '-c TimeZone=UTC',
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
