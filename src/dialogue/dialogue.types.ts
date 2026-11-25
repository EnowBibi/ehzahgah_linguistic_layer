import { Beneficiary } from '../bank/bank.errors';
import { Intent } from '../contract/intents';

export interface Pending {
  id: string;
  amount: number;
  toPhone: string;
  toName: string;
  fee: number;
  total: number;
  createdTraceId: string;
}

export interface DialogueState {
  language?: string;
  awaiting?: 'amount' | 'beneficiary' | 'confirmation' | 'candidates';
  purpose?: 'transfer' | 'fee';
  draft: { amount?: number; phone?: string; name?: string };
  pending?: Pending;
  candidates?: Beneficiary[];
  menuSession?: string;
  menuOpen?: boolean;
}

export type OpName =
  | 'balance'
  | 'fees'
  | 'history'
  | 'transfer_prepare'
  | 'transfer_confirm'
  | 'transfer_cancel'
  | 'transfer_update';

export type Decision =
  | {
      kind: 'reply';
      intent: Intent;
      messageId: string;
      slots?: Record<string, unknown>;
      params?: Record<string, unknown>;
      language?: string;
    }
  | { kind: 'execute'; op: OpName; intent: Intent; params: Record<string, unknown> };

/** State changes requested by operations. Applied by the orchestrator after the operation. */
export type StateEffect =
  | { type: 'pending_set'; pending: Pending }
  | { type: 'pending_clear' }
  | { type: 'awaiting'; value: DialogueState['awaiting']; purpose?: DialogueState['purpose']; candidates?: Beneficiary[] }
  | { type: 'draft_clear' };
