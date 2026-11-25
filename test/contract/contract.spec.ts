import { responseProblems, safeFallback } from '../../src/contract/response.guard';
import { INTENTS } from '../../src/contract/intents';
import { fitSeptets, nonGsm7Chars, septetLength, transliterate } from '../../src/channels/gsm7';

describe('response contract', () => {
  it('accepts the minimum valid response from the documentation', () => {
    const ok = {
      response: { text: 'Hello', end_session: false, options: [] },
      interpretation: { intent: 'UNKNOWN', parameters: {}, language: 'fr' },
      transaction: { id: null, status: 'none' },
    };
    expect(responseProblems(ok)).toEqual([]);
  });

  it('names the faulty field', () => {
    const bad = {
      response: { text: 'x', end_session: false, options: [] },
      interpretation: { intent: 'transfer', parameters: {}, language: 'fr' }, // wrong case
      transaction: { id: null, status: 'none' },
    };
    expect(responseProblems(bad)).toEqual(['interpretation.intent']);
  });

  it('lists the 13 documented intents', () => expect(INTENTS).toHaveLength(13));
  it('builds a valid fallback', () => expect(responseProblems(safeFallback('x', null))).toEqual([]));
});

describe('GSM-7', () => {
  it('counts the euro sign as two septets', () => expect(septetLength('5€')).toBe(3));
  it('flags national-language letters', () => expect(nonGsm7Chars('ɛ ɔ ŋ ə a')).toEqual(['ɛ', 'ɔ', 'ŋ', 'ə']));
  it('transliterates them into GSM-7', () => expect(nonGsm7Chars(transliterate('Kuɗin ƙarshe ɛ'))).toEqual([]));
  it('drops whole trailing lines first', () => {
    const r = fitSeptets('one\ntwo\nthree', 8);
    expect(r).toEqual({ text: 'one\ntwo', truncated: true });
  });
});
