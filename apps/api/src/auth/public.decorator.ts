import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips SupabaseAuthGuard for a route or controller. Every other route requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
