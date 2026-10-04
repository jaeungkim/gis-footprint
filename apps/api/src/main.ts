import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config: ConfigService<Env, true> = app.get(ConfigService);

  // Helmet defaults, built into Nest 12.1. Must come before SwaggerModule.setup
  // or the docs routes are served without the headers. Outside production, drop
  // upgrade-insecure-requests so Swagger UI also loads over plain HTTP via a LAN IP.
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableShutdownHooks();

  // UI at /api/docs, JSON at /api/docs-json (the web app generates its types from it).
  const docConfig = new DocumentBuilder().setTitle('API').build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, docConfig),
  );

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
