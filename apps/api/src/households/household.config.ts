import type { ConfigService } from '@nestjs/config';

/** Settings for invites. Built from env in HouseholdModule; tests construct it directly. */
export class HouseholdConfig {
  constructor(
    /** Where Supabase's invite link lands: the web app's /auth/confirm route. */
    readonly inviteRedirectUrl: string,
  ) {}

  /** WEB_APP_URL, else the first CORS_ORIGIN, else localhost. */
  static fromEnv(config: ConfigService): HouseholdConfig {
    const webUrl =
      config.get<string>('WEB_APP_URL') ||
      config.get<string>('CORS_ORIGIN')?.split(',')[0]?.trim() ||
      'http://localhost:3000';
    return new HouseholdConfig(`${webUrl.replace(/\/+$/, '')}/auth/confirm`);
  }
}
