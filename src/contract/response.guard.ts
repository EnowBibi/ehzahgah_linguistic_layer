import { GatewayResponse } from './gateway.types';
import { isIntent, isTransactionStatus } from './intents';

/** Returns the names of invalid fields. An empty array means the response is valid. */
export function responseProblems(r: unknown): string[] {
  const problems: string[] = [];
  const x = r as Partial<GatewayResponse> | null;
  if (!x || typeof x !== 'object') return ['body'];
  if (!x.response || typeof x.response.text !== 'string' || x.response.text.length === 0) problems.push('response.text');
  if (x.response && typeof x.response.end_session !== 'boolean') problems.push('response.end_session');
  if (x.response && !Array.isArray(x.response.options)) problems.push('response.options');
  if (!x.interpretation || !isIntent(x.interpretation.intent)) problems.push('interpretation.intent');
  if (x.interpretation && (typeof x.interpretation.parameters !== 'object' || x.interpretation.parameters === null)) {
    problems.push('interpretation.parameters');
  }
  if (!x.transaction || !isTransactionStatus(x.transaction.status)) problems.push('transaction.status');
  return problems;
}

/** A valid reply used when anything goes wrong. It never claims a transaction happened. */
export function safeFallback(text: string, language: string | null): GatewayResponse {
  return {
    response: { text, end_session: false, options: [] },
    interpretation: { intent: 'UNKNOWN', parameters: {}, language },
    transaction: { id: null, status: 'none' },
  };
}
