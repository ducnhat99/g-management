import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseTokenVerifier, TokenVerifier } from './token-verifier';

@Module({
  providers: [
    { provide: TokenVerifier, useFactory: SupabaseTokenVerifier.fromEnv, inject: [ConfigService] },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AuthModule {}
