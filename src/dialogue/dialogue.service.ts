import { Injectable } from '@nestjs/common';
import { TurnContext } from '../common/turn-context';
import { Intent } from '../contract/intents';
import { LanguageService } from '../language/language.service';
import { Interpretation } from '../understanding/understanding.service';
import { Decision, DialogueState, StateEffect } from './dialogue.types';

const MENU: Record<string, { intent: Intent; op?: 'balance' | 'fees' | 'history' }> = {
  '1': { intent: 'BALANCE_INQUIRY' },
  '2': { intent: 'TRANSFER' },
  '3': { intent: 'FEE_INQUIRY' },
  '4': { intent: 'TRANSACTION_HISTORY' },
};

/** Conversation state per phone number (so a journey can continue on another channel) and the next-step decision. */
@Injectable()
export class DialogueService {
  private readonly states = new Map<string, DialogueState>();

  constructor(private readonly languages: LanguageService) {}

  get(phone: string): DialogueState {
    let s = this.states.get(phone);
    if (!s) {
      s = { draft: {} };
      this.states.set(phone, s);
    }
    return s;
  }

  reset() {
    this.states.clear();
  }

  apply(phone: string, effects: StateEffect[] = []) {
    const s = this.get(phone);
    for (const e of effects) {
      if (e.type === 'pending_set') s.pending = e.pending;
      else if (e.type === 'pending_clear') {
        s.pending = undefined;
        s.awaiting = undefined;
        s.purpose = undefined;
        s.candidates = undefined;
        s.draft = {};
      } else if (e.type === 'awaiting') {
        s.awaiting = e.value;
        s.purpose = e.purpose ?? s.purpose;
        s.candidates = e.candidates;
      } else if (e.type === 'draft_clear') s.draft = {};
    }
  }

  setLanguage(phone: string, language: string) {
    this.get(phone).language = language;
  }

  private params(i: Interpretation): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    if (i.amount !== undefined) p.amount = i.amount;
    if (i.phone) p.phone = i.phone;
    if (i.name) p.name = i.name;
    if (i.term) p.term = i.term;
    if (i.language) p.language = i.language;
    return p;
  }

  decide(ctx: TurnContext, interp: Interpretation): Decision {
    const s = this.get(ctx.phone);
    const text = ctx.text.trim();
    let intent: Intent | null = interp.intent;
    const reply = (i: Intent, messageId: string, extra: Partial<Extract<Decision, { kind: 'reply' }>> = {}): Decision => ({
      kind: 'reply',
      intent: i,
      messageId,
      params: this.params(interp),
      ...extra,
    });

    // USSD: first dial shows the main menu
    if (ctx.channel === 'ussd' && text === '' && s.menuSession !== ctx.sessionId) {
      s.menuSession = ctx.sessionId;
      s.menuOpen = true;
      s.awaiting = undefined;
      return reply('UNKNOWN', 'menu.main');
    }

    // Waiting for the user to confirm a pending transfer
    if (s.awaiting === 'confirmation' && s.pending) {
      const word = interp.confirmWord ?? (text === '1' ? 'CONFIRM' : text === '2' ? 'CANCEL' : undefined);
      if (word === 'CONFIRM') return { kind: 'execute', op: 'transfer_confirm', intent: 'CONFIRM', params: {} };
      if (word === 'CANCEL') return { kind: 'execute', op: 'transfer_cancel', intent: 'CANCEL', params: {} };
      if (interp.amount !== undefined || interp.phone || interp.name) {
        return { kind: 'execute', op: 'transfer_update', intent: 'CORRECTION', params: this.params(interp) };
      }
      return reply('CLARIFICATION_NEEDED', 'confirm.reprompt');
    }

    // Waiting for a missing amount
    if (s.awaiting === 'amount') {
      if (interp.confirmWord === 'CANCEL') {
        this.apply(ctx.phone, [{ type: 'pending_clear' }]);
        return reply('CANCEL', 'transfer.cancelled');
      }
      const amount = interp.amount ?? (/^\d[\d\s.,]*$/.test(text) ? parseInt(text.replace(/\D/g, ''), 10) : undefined);
      if (amount) {
        s.draft.amount = amount;
        s.awaiting = undefined;
        return s.purpose === 'fee'
          ? { kind: 'execute', op: 'fees', intent: 'FEE_INQUIRY', params: { amount } }
          : this.continueTransfer(ctx, interp, reply);
      }
      return reply('CLARIFICATION_NEEDED', 'clarify.amount');
    }

    // Waiting for a beneficiary (a name, a number, or a choice among candidates)
    if (s.awaiting === 'candidates' && s.candidates) {
      const pick = /^\d$/.test(text) ? s.candidates[parseInt(text, 10) - 1] : undefined;
      if (pick) {
        s.draft.phone = pick.phone;
        s.draft.name = pick.name;
        s.awaiting = undefined;
        s.candidates = undefined;
        return this.continueTransfer(ctx, interp, reply);
      }
    }
    if (s.awaiting === 'beneficiary' || s.awaiting === 'candidates') {
      if (interp.confirmWord === 'CANCEL') {
        this.apply(ctx.phone, [{ type: 'pending_clear' }]);
        return reply('CANCEL', 'transfer.cancelled');
      }
      if (interp.phone) s.draft.phone = interp.phone;
      else if (interp.name) s.draft.name = interp.name;
      else if (/^[\p{L}][\p{L}'\- ]{1,40}$/u.test(text) && !interp.intent) s.draft.name = text;
      if (s.draft.phone || s.draft.name) {
        s.awaiting = undefined;
        s.candidates = undefined;
        return this.continueTransfer(ctx, interp, reply);
      }
      return reply('CLARIFICATION_NEEDED', 'clarify.beneficiary');
    }

    // USSD menu choice
    if (ctx.channel === 'ussd' && s.menuOpen && MENU[text]) {
      s.menuOpen = false;
      intent = MENU[text].intent;
    }

    switch (intent) {
      case 'BALANCE_INQUIRY':
        return { kind: 'execute', op: 'balance', intent, params: {} };
      case 'TRANSACTION_HISTORY':
        return { kind: 'execute', op: 'history', intent, params: {} };
      case 'FEE_INQUIRY':
        if (interp.amount) return { kind: 'execute', op: 'fees', intent, params: { amount: interp.amount } };
        s.awaiting = 'amount';
        s.purpose = 'fee';
        return reply('CLARIFICATION_NEEDED', 'clarify.amount');
      case 'TRANSFER':
        s.purpose = 'transfer';
        if (interp.amount !== undefined) s.draft.amount = interp.amount;
        if (interp.phone) s.draft.phone = interp.phone;
        if (interp.name) s.draft.name = interp.name;
        return this.continueTransfer(ctx, interp, reply);
      case 'AIRTIME_PURCHASE':
      case 'BILL_PAYMENT':
        return reply(intent, 'feature.unavailable');
      case 'TERM_EXPLANATION':
        return interp.term ? reply(intent, `term.${interp.term}`) : reply('CLARIFICATION_NEEDED', 'clarify.generic');
      case 'LANGUAGE_SWITCH': {
        const target = interp.language;
        if (target && this.languages.has(target)) return reply(intent, 'language.switched', { language: target });
        return reply(intent, 'language.unsupported');
      }
      default:
        break;
    }
    if (interp.confirmWord) return reply(interp.confirmWord, 'nothing.pending');
    return reply('UNKNOWN', 'clarify.generic');
  }

  /** Transfer flow: ask for what is missing, otherwise prepare the transfer. */
  private continueTransfer(
    ctx: TurnContext,
    interp: Interpretation,
    reply: (i: Intent, id: string, extra?: any) => Decision,
  ): Decision {
    const s = this.get(ctx.phone);
    if (!s.draft.amount) {
      s.awaiting = 'amount';
      s.purpose = 'transfer';
      return reply('CLARIFICATION_NEEDED', 'clarify.amount');
    }
    if (!s.draft.phone && !s.draft.name) {
      s.awaiting = 'beneficiary';
      s.purpose = 'transfer';
      return reply('CLARIFICATION_NEEDED', 'clarify.beneficiary');
    }
    return {
      kind: 'execute',
      op: 'transfer_prepare',
      intent: 'TRANSFER',
      params: { amount: s.draft.amount, phone: s.draft.phone, name: s.draft.name },
    };
  }
}
