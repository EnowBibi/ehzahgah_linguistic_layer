import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { TurnContext } from '../common/turn-context';
import { Beneficiary, BankError } from './bank.errors';
import { Account, BankPort, BankTransaction, Fees, HistoryItem } from './bank.port';

const MAX_CALL_MS = 2500;

// TODO(verify): every response shape below is read defensively because the documentation
// excerpt lists the endpoints but not their JSON bodies. Check them in the simulator and tighten.
const unwrap = (j: any) => (j && typeof j === 'object' && j.data && typeof j.data === 'object' ? j.data : j);
const asArray = (j: any, ...keys: string[]): any[] => {
  if (Array.isArray(j)) return j;
  for (const k of keys) if (Array.isArray(j?.[k])) return j[k];
  return [];
};
const toBeneficiary = (b: any): Beneficiary => ({
  phone: String(b?.phone ?? b?.number ?? ''),
  name: String(b?.name ?? b?.full_name ?? b?.holder ?? ''),
});

@Injectable()
export class BankClient extends BankPort {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  /** Every call carries the team key and the trace id of the CURRENT turn. */
  private async call(ctx: TurnContext, method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const remaining = ctx.deadlineAt - Date.now();
    if (remaining <= 50) throw new BankError('TIMEOUT');
    const base = (ctx.bankBaseUrl || this.config.bankApiBase).replace(/\/$/, '');
    let res: Response;
    try {
      res = await fetch(`${base}/${path}`, {
        method,
        headers: {
          'X-Team-Key': this.config.teamKey,
          'X-Trace-Id': ctx.traceId,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(Math.min(remaining, MAX_CALL_MS)),
      });
    } catch (e: any) {
      throw new BankError(e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const code = json?.error?.code ?? json?.code ?? (typeof json?.error === 'string' ? json.error : 'INVALID_REQUEST');
      const candidates = asArray(json?.candidates ?? json?.error?.candidates ?? [], 'candidates').map(toBeneficiary);
      throw new BankError(String(code), res.status, candidates);
    }
    return json;
  }

  async getAccount(ctx: TurnContext): Promise<Account> {
    const j = unwrap(await this.call(ctx, 'GET', `accounts/${ctx.phone}`));
    return { balance: Number(j?.balance ?? j?.account?.balance), currency: String(j?.currency ?? 'XAF'), holder: j?.holder };
  }

  async getTransactions(ctx: TurnContext, limit: number): Promise<HistoryItem[]> {
    const j = unwrap(await this.call(ctx, 'GET', `accounts/${ctx.phone}/transactions?limit=${limit}`));
    return asArray(j, 'transactions', 'data', 'items').map((it) => {
      const amount = Number(it.amount);
      return {
        date: String(it.date ?? it.created_at ?? '').slice(0, 10),
        description: String(it.description ?? it.label ?? it.type ?? ''),
        amount: Math.abs(amount),
        direction: it.direction === 'in' || it.direction === 'out' ? it.direction : amount < 0 ? 'out' : 'in',
      } as HistoryItem;
    });
  }

  async findBeneficiaries(ctx: TurnContext, query: { q?: string; phone?: string }): Promise<Beneficiary[]> {
    const qs = new URLSearchParams();
    if (query.q) qs.set('q', query.q);
    if (query.phone) qs.set('phone', query.phone);
    const j = unwrap(await this.call(ctx, 'GET', `beneficiaries?${qs.toString()}`));
    return asArray(j, 'beneficiaries', 'results', 'data').map(toBeneficiary);
  }

  async getFees(ctx: TurnContext, type: string, amount: number): Promise<Fees> {
    const j = unwrap(await this.call(ctx, 'GET', `fees?type=${type}&amount=${amount}`));
    const fee = Number(j?.fee ?? j?.fees);
    return { fee, total: Number(j?.total ?? amount + fee) };
  }

  private tx(j: any): BankTransaction {
    const t = unwrap(j);
    return { id: String(t?.id ?? t?.transaction_id ?? ''), status: String(t?.status ?? 'pending') };
  }

  async createTransaction(ctx: TurnContext, body: { type: string; from: string; to: string; amount: number }) {
    return this.tx(await this.call(ctx, 'POST', 'transactions', body));
  }
  async updateTransaction(ctx: TurnContext, id: string, body: { amount?: number; to?: string }) {
    return this.tx(await this.call(ctx, 'POST', `transactions/${id}/update`, body));
  }
  async confirmTransaction(ctx: TurnContext, id: string) {
    return this.tx(await this.call(ctx, 'POST', `transactions/${id}/confirm`, {}));
  }
  async cancelTransaction(ctx: TurnContext, id: string) {
    return this.tx(await this.call(ctx, 'POST', `transactions/${id}/cancel`, {}));
  }
}
