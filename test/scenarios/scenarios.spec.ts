import { septetLength, nonGsm7Chars } from '../../src/channels/gsm7';
import { build } from '../helpers/harness';

describe('sandbox scenarios', () => {
  it('1 balance inquiry, in English, French and Hausa', async () => {
    const { ask, bank } = build();
    const en = await ask('what is my balance', { language: 'en' });
    expect(en.interpretation.intent).toBe('BALANCE_INQUIRY');
    expect(en.response.text).toBe('Your balance is 100,000 FCFA.');
    const fr = await ask('mon solde', { language: 'fr' });
    expect(fr.response.text).toBe('Votre solde est de 100,000 FCFA.');
    const hau = await ask('ragowar kuɗi', { language: 'hau' });
    expect(hau.interpretation.intent).toBe('BALANCE_INQUIRY');
    expect(hau.response.text).toContain('100,000 FCFA');
    expect(bank.calls.every((c) => c.traceId.startsWith('t'))).toBe(true); // trace id on every bank call
  });

  it('Ejagham has no text yet: falls back to French, and the pipeline still works', async () => {
    const { ask } = build();
    const r = await ask('', { language: 'etu', channel: 'ussd', session: 'new' }); // first dial shows the menu
    expect(r.interpretation.language).toBe('etu');
    expect(r.response.text).toContain('Solde');
  });

  it('2 transfer: prepare on one turn, confirm on the next turn with another trace id', async () => {
    const { ask, bank } = build();
    const t1 = await ask('send 5000 to Jean-Paul Mbarga', { trace: 'A' });
    expect(t1.interpretation.intent).toBe('TRANSFER');
    expect(t1.transaction.status).toBe('pending');
    expect(t1.response.text).toContain('5,000 FCFA');
    expect(t1.response.text).toContain('Jean-Paul Mbarga');
    expect(bank.ops()).not.toContain('confirmTransaction');
    const t2 = await ask('1', { trace: 'B' });
    expect(t2.interpretation.intent).toBe('CONFIRM');
    expect(t2.transaction.status).toBe('confirmed');
    const confirm = bank.calls.find((c) => c.op === 'confirmTransaction')!;
    const create = bank.calls.find((c) => c.op === 'createTransaction')!;
    expect(confirm.traceId).toBe('B');
    expect(create.traceId).toBe('A');
  });

  it('never confirms in the turn that created the transaction', async () => {
    const { ask, bank } = build();
    await ask('send 5000 to Jean-Paul Mbarga', { trace: 'SAME' });
    const r = await ask('1', { trace: 'SAME' });
    expect(bank.ops()).not.toContain('confirmTransaction');
    expect(r.transaction.status).not.toBe('confirmed');
  });

  it('5 correction before confirmation', async () => {
    const { ask, bank } = build();
    await ask('send 5000 to Jean-Paul Mbarga');
    const r = await ask('no, 6000');
    expect(r.interpretation.intent).toBe('CORRECTION');
    expect(r.interpretation.parameters.amount).toBe(6000);
    expect(bank.calls.find((c) => c.op === 'updateTransaction')!.args).toMatchObject({ amount: 6000 });
    expect(r.transaction.status).toBe('pending');
  });

  it('6 ambiguous request asks for clarification and calls no transfer endpoint', async () => {
    const { ask, bank } = build();
    const r = await ask('send money');
    expect(r.interpretation.intent).toBe('CLARIFICATION_NEEDED');
    expect(bank.ops()).not.toContain('createTransaction');
    const r2 = await ask('3000');
    expect(r2.interpretation.intent).toBe('CLARIFICATION_NEEDED'); // still needs a beneficiary
    expect(r2.response.text).toMatch(/Who should receive/);
  });

  it('asks instead of guessing when several beneficiaries match', async () => {
    const { ask, bank } = build();
    const r = await ask('send 5000 to Jean');
    expect(r.interpretation.intent).toBe('CLARIFICATION_NEEDED');
    expect(bank.ops()).not.toContain('createTransaction');
    const pick = await ask('2');
    expect(pick.transaction.status).toBe('pending');
    expect(pick.response.text).toContain('Jean Mballa');
  });

  it('7 insufficient balance is explained in the user language', async () => {
    const { ask, bank } = build();
    bank.failCreateWith = 'INSUFFICIENT_FUNDS';
    const r = await ask('tura 90000 zuwa Marie Essomba', { language: 'hau' });
    expect(r.interpretation.intent).toBe('TRANSFER');
    expect(r.response.text).toContain('Kuɗin da ke asusunku bai isa');
    expect(r.transaction.status).toBe('none');
  });

  it('3 fee inquiry', async () => {
    const { ask } = build();
    const r = await ask('how much does it cost to send 25000');
    expect(r.interpretation.intent).toBe('FEE_INQUIRY');
    expect(r.response.text).toContain('150 FCFA');
    expect(r.response.text).toContain('25,150 FCFA');
  });

  it('4 transaction history', async () => {
    const { ask } = build();
    const r = await ask('recent transactions');
    expect(r.interpretation.intent).toBe('TRANSACTION_HISTORY');
    expect(r.response.text).toContain('Merchant payment');
  });

  it('8 language switching keeps working on the next turn', async () => {
    const { ask } = build();
    const sw = await ask('switch to hausa');
    expect(sw.interpretation.intent).toBe('LANGUAGE_SWITCH');
    expect(sw.interpretation.language).toBe('hau');
    expect(sw.response.text).toContain('Hausa');
    const next = await ask('ragowar kuɗi', { language: null });
    expect(next.interpretation.language).toBe('hau');
    expect(next.response.text).toContain('Ragowar kuɗin ku');
  });

  it('9 multichannel: start on USSD, finish on the web with the same number', async () => {
    const { ask, bank } = build();
    await ask('', { channel: 'ussd', session: 'u1' }); // menu
    await ask('send 5000 to Jean-Paul Mbarga', { channel: 'ussd', session: 'u1', trace: 'U1' });
    const done = await ask('1', { channel: 'web', session: 'w1', trace: 'W1' });
    expect(done.transaction.status).toBe('confirmed');
    expect(bank.calls.find((c) => c.op === 'confirmTransaction')!.traceId).toBe('W1');
  });

  it('does not mistake words of a question for a beneficiary name', async () => {
    const { ask } = build();
    const term = await ask('what is a fee');
    expect(term.interpretation.parameters).toEqual({ term: 'fee' });
    const sw = await ask('switch to hausa');
    expect(sw.interpretation.parameters).toEqual({ language: 'hau' });
  });

  it('10 financial terminology', async () => {
    const { ask } = build();
    const en = await ask('what is a fee');
    expect(en.interpretation.intent).toBe('TERM_EXPLANATION');
    expect(en.interpretation.parameters.term).toBe('fee');
    const hau = await ask('menene kuɗin caji', { language: 'hau' });
    expect(hau.interpretation.intent).toBe('TERM_EXPLANATION');
    expect(hau.response.text).toContain('Kuɗin caji kuɗi ne');
  });
});

describe('USSD limits', () => {
  it('stays within 182 septets and inside GSM-7 even for Hausa', async () => {
    const { ask } = build();
    await ask('', { channel: 'ussd', session: 'u9', language: 'hau' });
    const r = await ask('send 5000 to Jean-Paul Mbarga', { channel: 'ussd', session: 'u9', language: 'hau' });
    expect(septetLength(r.response.text)).toBeLessThanOrEqual(182);
    expect(nonGsm7Chars(r.response.text)).toEqual([]);
  });
});
