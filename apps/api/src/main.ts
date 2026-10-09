import 'reflect-metadata';
import { getAppInfo } from '@gold/shared';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/** CORS_ORIGIN may list several origins, comma-separated (e.g. production + localhost). */
function corsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Render's proxy: trust its X-Forwarded-* headers (real client IP and https).
  app.set('trust proxy', 1);
  app.enableCors({ origin: corsOrigins() });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(
    `${getAppInfo().displayName} API listening on port ${port}, CORS: ${corsOrigins().join(', ')}`,
    'Bootstrap',
  );
}
void bootstrap();
