import { TurnContext } from '../common/turn-context';
import { Beneficiary } from './bank.errors';

export interface Account {
  balance: number;
  currency: string;
  holder?: string;
}
export interface Fees {
  fee: number;
  total: number;
}
export interface BankTransaction {
  id: string;
  status: string;
}
export interface HistoryItem {
  date: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
}

/** The only door to the banking API. Operations depend on this port, tests replace it. */
export abstract class BankPort {
  abstract getAccount(ctx: TurnContext): Promise<Account>;
  abstract getTransactions(ctx: TurnContext, limit: number): Promise<HistoryItem[]>;
  abstract findBeneficiaries(ctx: TurnContext, query: { q?: string; phone?: string }): Promise<Beneficiary[]>;
  abstract getFees(ctx: TurnContext, type: string, amount: number): Promise<Fees>;
  abstract createTransaction(
    ctx: TurnContext,
    body: { type: string; from: string; to: string; amount: number },
  ): Promise<BankTransaction>;
  abstract updateTransaction(
    ctx: TurnContext,
    id: string,
    body: { amount?: number; to?: string },
  ): Promise<BankTransaction>;
  abstract confirmTransaction(ctx: TurnContext, id: string): Promise<BankTransaction>;
  abstract cancelTransaction(ctx: TurnContext, id: string): Promise<BankTransaction>;
}
