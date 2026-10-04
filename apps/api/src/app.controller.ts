import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { HealthDto } from './health.dto.js';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Explicit return type lets the swagger plugin emit the response schema.
  @Get()
  health(): Promise<HealthDto> {
    return this.appService.health();
  }
}
