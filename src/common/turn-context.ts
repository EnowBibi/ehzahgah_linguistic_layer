import { GatewayRequest } from '../contract/gateway.types';

/** Everything one turn needs. Passed explicitly down the pipeline. Never stored globally. */
export interface TurnContext {
  traceId: string;
  teamId: string;
  channel: GatewayRequest['channel'];
  sessionId: string;
  phone: string; // normalised: 237XXXXXXXXX
  language: string; // effective language for this turn
  text: string; // user text for this turn
  inputType: string;
  constraints: GatewayRequest['constraints'];
  bankBaseUrl: string;
  startedAt: number;
  deadlineAt: number;
}

export class TurnTimeoutError extends Error {
  constructor() {
    super('turn budget exhausted');
  }
}
