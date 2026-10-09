import 'reflect-metadata';
import { getAppInfo } from '@gold/shared';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`${getAppInfo().displayName} API listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
