import type { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthUser {
  /** Supabase Auth user id (the JWT `sub`). */
  id: string;
}

/** Turns a bearer token into a user, or throws. Abstract so tests can verify with local keys. */
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<AuthUser>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies Supabase access tokens: signature, `exp`, `iss` = `${SUPABASE_URL}/auth/v1` and
 * `aud` = "authenticated". Only the algorithms of the configured key type are accepted.
 */
export class SupabaseTokenVerifier extends TokenVerifier {
  constructor(
    private readonly key: JWTVerifyGetKey | Uint8Array,
    private readonly issuer: string,
    private readonly algorithms: string[],
  ) {
    super();
  }

  /** JWKS (asymmetric signing keys) by default; HS256 with SUPABASE_JWT_SECRET for legacy projects. */
  static fromEnv(config: ConfigService): SupabaseTokenVerifier {
    const supabaseUrl = config.get<string>('SUPABASE_URL')?.replace(/\/+$/, '');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required to verify access tokens');
    }
    const issuer = `${supabaseUrl}/auth/v1`;
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      return new SupabaseTokenVerifier(new TextEncoder().encode(secret), issuer, ['HS256']);
    }
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    return new SupabaseTokenVerifier(jwks, issuer, ['ES256', 'RS256']);
  }

  async verify(token: string): Promise<AuthUser> {
    const options = { issuer: this.issuer, audience: 'authenticated', algorithms: this.algorithms };
    const { payload } =
      typeof this.key === 'function'
        ? await jwtVerify(token, this.key, options)
        : await jwtVerify(token, this.key, options);
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
      throw new Error('Token subject is not a user id');
    }
    return { id: payload.sub };
  }
}
