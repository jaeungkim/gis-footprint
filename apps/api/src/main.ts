import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config: ConfigService<Env, true> = app.get(ConfigService);

  // Express 기본 100kb면 MAX_AOI_POINTS(5,000점, 약 200kB) 안쪽 AOI도 413이 난다.
  app.useBodyParser('json', { limit: '1mb' });

  app.useSecurityHeaders(
    config.get('NODE_ENV', { infer: true }) === 'production'
      ? {}
      : {
          contentSecurityPolicy: {
            directives: { upgradeInsecureRequests: null },
          },
        },
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const docConfig = new DocumentBuilder().setTitle('Footprint API').build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, docConfig),
  );

  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
