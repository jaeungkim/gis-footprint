import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthDto } from './dto/health.dto.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // DB에 닿지 않으면 500.
  @Get()
  async check(): Promise<HealthDto> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
