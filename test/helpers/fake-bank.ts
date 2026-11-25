import { BankError, Beneficiary } from '../../src/bank/bank.errors';
import { Account, BankPort, BankTransaction, Fees, HistoryItem } from '../../src/bank/bank.port';
import { TurnContext } from '../../src/common/turn-context';

export interface Call {
  op: string;
  traceId: string;
  args?: unknown;
}

const PEOPLE: Beneficiary[] = [
  { phone: '237677000002', name: 'Jean-Paul Mbarga' },
  { phone: '237677000003', name: 'Jean Mballa' },
  { phone: '237677000004', name: 'Marie Essomba' },
];

/** In-memory bank for tests. Records every call with the trace id it received. */
export class FakeBank extends BankPort {
  calls: Call[] = [];
  balance = 100000;
  failCreateWith: string | null = null;
  private seq = 1;

  private rec(ctx: TurnContext, op: string, args?: unknown) {
    this.calls.push({ op, traceId: ctx.traceId, args });
  }
  private feeFor = (a: number) => (a <= 5000 ? 50 : a <= 25000 ? 150 : a <= 100000 ? 400 : Math.round(a * 0.01));

  async getAccount(ctx: TurnContext): Promise<Account> {
    this.rec(ctx, 'getAccount');
    return { balance: this.balance, currency: 'XAF' };
  }
  async getTransactions(ctx: TurnContext): Promise<HistoryItem[]> {
    this.rec(ctx, 'getTransactions');
    return [{ date: '2026-11-05', description: 'Merchant payment', amount: 12500, direction: 'out' }];
  }
  async findBeneficiaries(ctx: TurnContext, q: { q?: string; phone?: string }): Promise<Beneficiary[]> {
    this.rec(ctx, 'findBeneficiaries', q);
    const list = PEOPLE.filter((p) => (q.phone ? p.phone === q.phone : p.name.toLowerCase().includes((q.q ?? '').toLowerCase())));
    if (list.length === 0) throw new BankError('UNKNOWN_BENEFICIARY', 404);
    return list;
  }
  async getFees(ctx: TurnContext, _type: string, amount: number): Promise<Fees> {
    this.rec(ctx, 'getFees', amount);
    return { fee: this.feeFor(amount), total: amount + this.feeFor(amount) };
  }
  async createTransaction(ctx: TurnContext, body: { to: string; amount: number }): Promise<BankTransaction> {
    this.rec(ctx, 'createTransaction', body);
    if (this.failCreateWith) throw new BankError(this.failCreateWith, 422);
    return { id: `TRX-${String(this.seq++).padStart(4, '0')}`, status: 'pending' };
  }
  async updateTransaction(ctx: TurnContext, id: string, body: object): Promise<BankTransaction> {
    this.rec(ctx, 'updateTransaction', { id, ...body });
    return { id, status: 'pending' };
  }
  async confirmTransaction(ctx: TurnContext, id: string): Promise<BankTransaction> {
    this.rec(ctx, 'confirmTransaction', id);
    return { id, status: 'confirmed' };
  }
  async cancelTransaction(ctx: TurnContext, id: string): Promise<BankTransaction> {
    this.rec(ctx, 'cancelTransaction', id);
    return { id, status: 'cancelled' };
  }
  ops = () => this.calls.map((c) => c.op);
}
