import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './supabase-auth.guard';

/** The signed-in user's id, set by SupabaseAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new Error('@CurrentUser() used on a route without SupabaseAuthGuard');
  }
  return request.user.id;
});
