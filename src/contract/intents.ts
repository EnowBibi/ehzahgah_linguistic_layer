// Allowed intents, exactly as listed in the sandbox documentation (capitals matter).
export const INTENTS = [
  'BALANCE_INQUIRY',
  'TRANSFER',
  'FEE_INQUIRY',
  'TRANSACTION_HISTORY',
  'AIRTIME_PURCHASE',
  'BILL_PAYMENT',
  'CONFIRM',
  'CANCEL',
  'CORRECTION',
  'CLARIFICATION_NEEDED',
  'TERM_EXPLANATION',
  'LANGUAGE_SWITCH',
  'UNKNOWN',
] as const;

export type Intent = (typeof INTENTS)[number];

export const isIntent = (value: unknown): value is Intent =>
  typeof value === 'string' && (INTENTS as readonly string[]).includes(value);

// TODO(verify): the documentation excerpt only shows "none" and "pending".
// Read the full list from the simulator's Diagnostics panel and update this array.
export const TRANSACTION_STATUSES = ['none', 'pending', 'confirmed', 'cancelled', 'failed'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const isTransactionStatus = (value: unknown): value is TransactionStatus =>
  typeof value === 'string' && (TRANSACTION_STATUSES as readonly string[]).includes(value);
