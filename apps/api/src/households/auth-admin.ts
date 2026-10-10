import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
// Only the auth library, not @supabase/supabase-js: the full client also starts a Realtime
// (WebSocket) client, which crashes on Node versions without a built-in WebSocket (e.g. Node 20).
import { GoTrueAdminApi } from '@supabase/auth-js';

export class AuthAdminError extends Error {
  override readonly name = 'AuthAdminError';

  constructor(
    readonly code: 'already_registered' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Supabase Auth admin actions (they need the project's secret key, so only the API may run them).
 * Abstract so tests can use a fake instead of sending real emails.
 */
export abstract class AuthAdmin {
  /** Sends Supabase's invite email; the link ends at `redirectTo`. Returns the new auth user id. */
  abstract inviteUserByEmail(email: string, redirectTo: string): Promise<{ userId: string }>;
  /** Deletes an auth user (cancelled invite or removed member). Missing users are ignored. */
  abstract deleteUser(userId: string): Promise<void>;
}

export class SupabaseAuthAdmin extends AuthAdmin {
  private readonly logger = new Logger(SupabaseAuthAdmin.name);
  private client: GoTrueAdminApi | null = null;

  constructor(
    private readonly supabaseUrl: string | undefined,
    private readonly secretKey: string | undefined,
  ) {
    super();
  }

  static fromEnv(config: ConfigService): SupabaseAuthAdmin {
    return new SupabaseAuthAdmin(
      config.get<string>('SUPABASE_URL'),
      config.get<string>('SUPABASE_SECRET_KEY'),
    );
  }

  async inviteUserByEmail(email: string, redirectTo: string): Promise<{ userId: string }> {
    const { data, error } = await this.call(() =>
      this.admin().inviteUserByEmail(email, { redirectTo }),
    );
    if (error) {
      this.logger.warn(`Invite to ${email} failed: ${error.message}`);
      const registered = /already.*registered|already exists|email_exists/i.test(
        `${error.message} ${error.code ?? ''}`,
      );
      throw new AuthAdminError(registered ? 'already_registered' : 'failed', error.message);
    }
    return { userId: data.user.id };
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.call(() => this.admin().deleteUser(userId));
    if (error && error.status !== 404) {
      throw new AuthAdminError('failed', error.message);
    }
  }

  /**
   * Runs an admin call so that anything it throws (network failure, unexpected library error)
   * becomes an AuthAdminError, which the service turns into a clear 503 instead of a bare 500.
   * Our own "not configured" 503 passes through unchanged.
   */
  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Supabase admin call failed: ${String(error)}`);
      throw new AuthAdminError('failed', error instanceof Error ? error.message : String(error));
    }
  }

  /** Created on first use, so the API still starts (and everything else works) without the key. */
  private admin() {
    if (!this.supabaseUrl || !this.secretKey) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình SUPABASE_SECRET_KEY nên chưa gửi được lời mời.',
      );
    }
    // Same headers supabase-js sends for auth admin calls.
    this.client ??= new GoTrueAdminApi({
      url: `${this.supabaseUrl.replace(/\/+$/, '')}/auth/v1`,
      headers: { Authorization: `Bearer ${this.secretKey}`, apikey: this.secretKey },
    });
    return this.client;
  }
}
