import { Injectable } from '@nestjs/common';
import { BankError, Beneficiary } from '../bank/bank.errors';
import { BankPort } from '../bank/bank.port';
import { TurnContext } from '../common/turn-context';
import { Intent, TransactionStatus } from '../contract/intents';
import { Decision, Pending, StateEffect } from '../dialogue/dialogue.types';

export interface OperationResult {
  intent: Intent;
  messageId: string;
  slots: Record<string, unknown>;
  params: Record<string, unknown>;
  transaction: { id: string | null; status: TransactionStatus };
  effects: StateEffect[];
}

type Execute = Extract<Decision, { kind: 'execute' }>;

/** The only layer that calls the bank. It never formats text. */
@Injectable()
export class OperationsService {
  constructor(private readonly bank: BankPort) {}

  async run(ctx: TurnContext, d: Execute, pending: Pending | undefined): Promise<OperationResult> {
    switch (d.op) {
      case 'balance':
        return this.balance(ctx, d);
      case 'fees':
        return this.fees(ctx, d);
      case 'history':
        return this.history(ctx, d);
      case 'transfer_prepare':
        return this.prepare(ctx, d);
      case 'transfer_update':
        return this.update(ctx, d, pending);
      case 'transfer_confirm':
        return this.confirm(ctx, d, pending);
      case 'transfer_cancel':
        return this.cancel(ctx, d, pending);
    }
  }

  private base(d: Execute): Pick<OperationResult, 'intent' | 'params' | 'effects'> {
    return { intent: d.intent, params: { ...d.params }, effects: [] };
  }

  private async balance(ctx: TurnContext, d: Execute): Promise<OperationResult> {
    const account = await this.bank.getAccount(ctx);
    return {
      ...this.base(d),
      messageId: 'balance.result',
      slots: { balance: account.balance },
      transaction: { id: null, status: 'none' },
    };
  }

  private async fees(ctx: TurnContext, d: Execute): Promise<OperationResult> {
    const amount = Number(d.params.amount);
    const f = await this.bank.getFees(ctx, 'transfer', amount);
    return {
      ...this.base(d),
      messageId: 'fees.result',
      slots: { amount, fee: f.fee, total: f.total },
      transaction: { id: null, status: 'none' },
      effects: [{ type: 'pending_clear' }],
    };
  }

  private async history(ctx: TurnContext, d: Execute): Promise<OperationResult> {
    const items = await this.bank.getTransactions(ctx, 5);
    return {
      ...this.base(d),
      messageId: items.length ? 'history.result' : 'history.empty',
      slots: { items },
      transaction: { id: null, status: 'none' },
    };
  }

  /** Looks up the beneficiary. Several matches are never guessed: the caller must ask. */
  private async resolve(ctx: TurnContext, q: { phone?: string; name?: string }): Promise<Beneficiary[]> {
    try {
      const list = await this.bank.findBeneficiaries(ctx, q.phone ? { phone: q.phone } : { q: q.name });
      if (list.length === 0) throw new BankError('UNKNOWN_BENEFICIARY', 404);
      return list;
    } catch (e) {
      if (e instanceof BankError && e.code === 'UNKNOWN_BENEFICIARY' && e.candidates.length > 0) return e.candidates;
      throw e;
    }
  }

  private async prepare(ctx: TurnContext, d: Execute): Promise<OperationResult> {
    const amount = Number(d.params.amount);
    const list = await this.resolve(ctx, { phone: d.params.phone as string, name: d.params.name as string });
    if (list.length > 1) {
      return {
        ...this.base(d),
        intent: 'CLARIFICATION_NEEDED',
        messageId: 'clarify.candidates',
        slots: { candidates: list.map((b, i) => `${i + 1}. ${b.name}`).join('\n') },
        transaction: { id: null, status: 'none' },
        effects: [{ type: 'awaiting', value: 'candidates', purpose: 'transfer', candidates: list }],
      };
    }
    const to = list[0];
    const f = await this.bank.getFees(ctx, 'transfer', amount);
    const tx = await this.bank.createTransaction(ctx, { type: 'transfer', from: ctx.phone, to: to.phone, amount });
    const pending: Pending = {
      id: tx.id,
      amount,
      toPhone: to.phone,
      toName: to.name,
      fee: f.fee,
      total: f.total,
      createdTraceId: ctx.traceId,
    };
    return {
      ...this.base(d),
      params: { amount, beneficiary: to.name || to.phone },
      messageId: 'transfer.review',
      slots: { amount, beneficiary: to.name || to.phone, fee: f.fee, total: f.total },
      transaction: { id: tx.id, status: 'pending' },
      effects: [{ type: 'pending_set', pending }, { type: 'awaiting', value: 'confirmation', purpose: 'transfer' }],
    };
  }

  private async update(ctx: TurnContext, d: Execute, pending?: Pending): Promise<OperationResult> {
    if (!pending) return this.nothingPending(d);
    const body: { amount?: number; to?: string } = {};
    let toName = pending.toName;
    let toPhone = pending.toPhone;
    if (d.params.phone || d.params.name) {
      const list = await this.resolve(ctx, { phone: d.params.phone as string, name: d.params.name as string });
      if (list.length > 1) {
        return {
          ...this.base(d),
          intent: 'CLARIFICATION_NEEDED',
          messageId: 'clarify.candidates',
          slots: { candidates: list.map((b, i) => `${i + 1}. ${b.name}`).join('\n') },
          transaction: { id: pending.id, status: 'pending' },
          effects: [],
        };
      }
      toName = list[0].name;
      toPhone = list[0].phone;
      body.to = toPhone;
    }
    const amount = d.params.amount !== undefined ? Number(d.params.amount) : pending.amount;
    if (d.params.amount !== undefined) body.amount = amount;
    await this.bank.updateTransaction(ctx, pending.id, body);
    const f = await this.bank.getFees(ctx, 'transfer', amount);
    const next: Pending = { ...pending, amount, toName, toPhone, fee: f.fee, total: f.total };
    return {
      ...this.base(d),
      params: { amount, beneficiary: toName || toPhone },
      messageId: 'transfer.review',
      slots: { amount, beneficiary: toName || toPhone, fee: f.fee, total: f.total },
      transaction: { id: pending.id, status: 'pending' },
      effects: [{ type: 'pending_set', pending: next }],
    };
  }

  /** Money moves here and only here. It must happen on a later turn than the one that created the transaction. */
  private async confirm(ctx: TurnContext, d: Execute, pending?: Pending): Promise<OperationResult> {
    if (!pending) return this.nothingPending(d);
    if (pending.createdTraceId === ctx.traceId) {
      throw new Error('guard: refusing to confirm in the same turn that created the transaction');
    }
    await this.bank.confirmTransaction(ctx, pending.id);
    return {
      ...this.base(d),
      params: { amount: pending.amount, beneficiary: pending.toName || pending.toPhone },
      messageId: 'transfer.done',
      slots: { amount: pending.amount, beneficiary: pending.toName || pending.toPhone, id: pending.id },
      transaction: { id: pending.id, status: 'confirmed' },
      effects: [{ type: 'pending_clear' }],
    };
  }

  private async cancel(ctx: TurnContext, d: Execute, pending?: Pending): Promise<OperationResult> {
    if (!pending) return this.nothingPending(d);
    await this.bank.cancelTransaction(ctx, pending.id);
    return {
      ...this.base(d),
      messageId: 'transfer.cancelled',
      slots: {},
      transaction: { id: pending.id, status: 'cancelled' },
      effects: [{ type: 'pending_clear' }],
    };
  }

  private nothingPending(d: Execute): OperationResult {
    return {
      ...this.base(d),
      messageId: 'nothing.pending',
      slots: {},
      transaction: { id: null, status: 'none' },
      effects: [],
    };
  }
}
