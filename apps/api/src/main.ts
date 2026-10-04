import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config: ConfigService<Env, true> = app.get(ConfigService);

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
