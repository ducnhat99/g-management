import { hasRole, type MemberRole } from '@gold/shared';
import {
  createParamDecorator,
  ForbiddenException,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/supabase-auth.guard';
import { HouseholdService, type MemberContext } from './household.service';

const REQUIRED_ROLE_KEY = 'requiredRole';

/** Minimum household role for a route (default: any member, i.e. viewer). */
export const RequireRole = (role: MemberRole) => SetMetadata(REQUIRED_ROLE_KEY, role);

type HouseholdRequest = AuthenticatedRequest & { member?: MemberContext };

const FORBIDDEN: Record<MemberRole, string> = {
  owner: 'Chỉ chủ sở hữu mới làm được việc này.',
  editor: 'Bạn chỉ có quyền xem, không thể thay đổi giao dịch.',
  viewer: 'Bạn không có quyền truy cập.',
};

/**
 * Runs after the global SupabaseAuthGuard: resolves the caller's household (accepting a pending
 * invite on first visit) and checks @RequireRole. Use with @UseGuards(HouseholdGuard).
 */
@Injectable()
export class HouseholdGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly households: HouseholdService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HouseholdRequest>();
    if (!request.user) {
      throw new Error('HouseholdGuard needs SupabaseAuthGuard to run first');
    }
    request.member = await this.households.resolve(request.user);

    const required =
      this.reflector.getAllAndOverride<MemberRole>(REQUIRED_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'viewer';
    if (!hasRole(request.member.role, required)) {
      throw new ForbiddenException(FORBIDDEN[required]);
    }
    return true;
  }
}

/** The caller's household membership, set by HouseholdGuard. */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberContext => {
    const member = ctx.switchToHttp().getRequest<HouseholdRequest>().member;
    if (!member) {
      throw new Error('@CurrentMember() used on a route without HouseholdGuard');
    }
    return member;
  },
);
