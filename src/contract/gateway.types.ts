import { Intent, TransactionStatus } from './intents';

export type ChannelName = 'ussd' | 'mobile' | 'web' | 'sms' | 'atm' | 'ivr';

export interface GatewayRequest {
  trace_id: string;
  team_id: string;
  channel: ChannelName;
  session_id: string;
  phone: string;
  language: string | null;
  input: { type: string; text?: string; ussd_text?: string; [key: string]: unknown };
  constraints: {
    max_chars?: number;
    charset?: 'gsm7' | 'utf8' | string;
    mode?: string;
    timeout_ms?: number;
  };
  bank_api: { base_url: string };
}

export interface GatewayResponse {
  response: { text: string; end_session: boolean; options: string[] };
  interpretation: {
    intent: Intent;
    parameters: Record<string, unknown>;
    language: string | null;
  };
  transaction: { id: string | null; status: TransactionStatus };
}
