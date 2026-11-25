export interface Beneficiary {
  phone: string;
  name: string;
}

/** An error reported by the banking API, or a transport failure (code TIMEOUT or NETWORK). */
export class BankError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 0,
    public readonly candidates: Beneficiary[] = [],
  ) {
    super(`bank error ${code}`);
  }
}
