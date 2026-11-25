import { Inject, Injectable, Logger } from '@nestjs/common';
import { BankError } from '../bank/bank.errors';
import { ChannelService } from '../channels/channel.service';
import { normalisePhone } from '../common/phone';
import { TurnContext } from '../common/turn-context';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { GatewayRequest, GatewayResponse } from '../contract/gateway.types';
import { Intent, TransactionStatus } from '../contract/intents';
import { responseProblems, safeFallback } from '../contract/response.guard';
import { DialogueService } from '../dialogue/dialogue.service';
import { StateEffect } from '../dialogue/dialogue.types';
import { GenerationService } from '../generation/generation.service';
import { LanguageService } from '../language/language.service';
import { OperationResult, OperationsService } from '../operations/operations.service';
import { UnderstandingService } from '../understanding/understanding.service';

/** Runs one turn: understand, decide, execute, generate, fit to the channel, validate. */
@Injectable()
export class OrchestratorService {
  private readonly log = new Logger('Turn');

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly languages: LanguageService,
    private readonly understanding: UnderstandingService,
    private readonly dialogue: DialogueService,
    private readonly operations: OperationsService,
    private readonly generation: GenerationService,
    private readonly channels: ChannelService,
  ) {}

  private buildContext(req: GatewayRequest): TurnContext {
    const phone = normalisePhone(req.phone);
    const state = this.dialogue.get(phone);
    // TODO(verify in the simulator): which language wins after a LANGUAGE_SWITCH turn.
    const language = this.languages.resolve(req.language ?? state.language);
    const startedAt = Date.now();
    const timeout = req.constraints?.timeout_ms ?? 3000;
    return {
      traceId: req.trace_id,
      teamId: req.team_id,
      channel: req.channel,
      sessionId: req.session_id,
      phone,
      language,
      text: String(req.input?.text ?? ''),
      inputType: String(req.input?.type ?? ''),
      constraints: req.constraints ?? {},
      bankBaseUrl: req.bank_api?.base_url ?? this.config.bankApiBase,
      startedAt,
      deadlineAt: startedAt + timeout - this.config.safetyMarginMs,
    };
  }

  async handle(req: GatewayRequest): Promise<GatewayResponse> {
    if (!req || !req.trace_id || !req.phone || !req.channel) {
      return safeFallback('Invalid request.', null);
    }
    const ctx = this.buildContext(req);
    const interp = this.understanding.interpret(ctx.text, ctx.language);
    const decision = this.dialogue.decide(ctx, interp);

    let intent: Intent;
    let messageId: string;
    let slots: Record<string, unknown> = {};
    let params: Record<string, unknown> = {};
    let transaction: { id: string | null; status: TransactionStatus } = { id: null, status: 'none' };
    let effects: StateEffect[] = [];
    let language = ctx.language;

    if (decision.kind === 'reply') {
      ({ intent, messageId } = decision);
      slots = decision.slots ?? {};
      params = decision.params ?? {};
      const state = this.dialogue.get(ctx.phone);
      if (state.pending) transaction = { id: state.pending.id, status: 'pending' };
      if (decision.language) {
        language = decision.language;
        this.dialogue.setLanguage(ctx.phone, language);
      }
    } else {
      intent = decision.intent;
      params = decision.params;
      const pending = this.dialogue.get(ctx.phone).pending;
      let result: OperationResult;
      try {
        result = await this.operations.run(ctx, decision, pending);
      } catch (e) {
        const code = e instanceof BankError ? e.code : 'DEFAULT';
        this.log.warn(`trace=${ctx.traceId} op=${decision.op} failed: ${e instanceof Error ? e.message : e}`);
        const failedAfterCreate = decision.op === 'transfer_confirm' && pending;
        result = {
          intent,
          messageId: `error.${code}`,
          slots: {},
          params,
          transaction: failedAfterCreate ? { id: pending.id, status: 'failed' } : { id: null, status: 'none' },
          effects: [{ type: 'pending_clear' }],
        };
      }
      ({ intent, messageId, slots, params, transaction, effects } = result);
    }

    this.dialogue.apply(ctx.phone, effects);

    const rendered = this.generation.render(language, messageId, slots);
    const fitted = this.channels.fit(ctx, rendered.text);

    const out: GatewayResponse = {
      response: { text: fitted.text, end_session: false, options: [] },
      interpretation: { intent, parameters: this.publicParams(params), language },
      transaction,
    };
    const problems = responseProblems(out);
    if (problems.length > 0) {
      this.log.error(`trace=${ctx.traceId} invalid response fields: ${problems.join(', ')}`);
      return safeFallback('Service temporarily unavailable. Please try again.', language);
    }
    this.log.log(
      `trace=${ctx.traceId} ch=${ctx.channel} lang=${language} intent=${intent} msg=${messageId} ` +
        `tx=${transaction.status} ms=${Date.now() - ctx.startedAt}` +
        `${rendered.fellBack ? ` fallback=${rendered.language}` : ''}` +
        `${fitted.anomalies.length ? ` anomalies=${fitted.anomalies.join('|')}` : ''}`,
    );
    return out;
  }

  /** Parameters shown to the jury: amount, currency, beneficiary, term, language. */
  private publicParams(p: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (p.amount !== undefined) {
      out.amount = p.amount;
      out.currency = 'XAF';
    }
    const beneficiary = p.beneficiary ?? p.name ?? p.phone;
    if (beneficiary) out.beneficiary = beneficiary;
    if (p.term) out.term = p.term;
    if (p.language) out.language = p.language;
    return out;
  }
}
