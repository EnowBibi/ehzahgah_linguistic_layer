export interface AppConfig {
  port: number;
  teamKey: string;
  bankApiBase: string;
  safetyMarginMs: number;
  defaultLanguage: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    teamKey: env.TEAM_KEY ?? '',
    bankApiBase: env.BANK_API_BASE ?? 'https://safinum.cm/api/v1',
    safetyMarginMs: Number(env.SAFETY_MARGIN_MS ?? 400),
    defaultLanguage: env.DEFAULT_LANGUAGE ?? 'fr',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
