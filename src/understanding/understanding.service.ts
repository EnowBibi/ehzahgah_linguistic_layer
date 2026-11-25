import { Injectable } from '@nestjs/common';
import { findPhone } from '../common/phone';
import { Intent } from '../contract/intents';
import { LanguageService } from '../language/language.service';

export interface Interpretation {
  intent: Intent | null;
  amount?: number;
  phone?: string;
  name?: string;
  term?: string;
  language?: string; // requested language for LANGUAGE_SWITCH
  confirmWord?: 'CONFIRM' | 'CANCEL';
}

const normalise = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}\s'+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** True when `phrase` appears in `text` as whole words. */
const hasPhrase = (text: string, phrase: string) => {
  const p = normalise(phrase);
  return p !== '' && ` ${text} `.includes(` ${p} `);
};

const ORDER: Intent[] = [
  'TRANSFER',
  'FEE_INQUIRY',
  'BALANCE_INQUIRY',
  'TRANSACTION_HISTORY',
  'AIRTIME_PURCHASE',
  'BILL_PAYMENT',
];

/** Rule-based: user text -> intent and parameters. No bank calls. */
@Injectable()
export class UnderstandingService {
  constructor(private readonly languages: LanguageService) {}

  interpret(text: string, language: string): Interpretation {
    const raw = (text ?? '').trim();
    if (!raw) return { intent: null };
    const lex = this.languages.lexicon(language);
    const out: Interpretation = { intent: null };

    // 1. phone number, then amount from what remains
    let rest = raw;
    const found = findPhone(raw);
    if (found) {
      out.phone = found.phone;
      rest = found.rest;
    }
    const num = rest.match(/\d[\d\s.,]*/);
    if (num) {
      const amount = parseInt(num[0].replace(/[\s.,]/g, ''), 10);
      if (Number.isFinite(amount) && amount > 0) out.amount = amount;
    }

    // 2. beneficiary name after a marker word ("to", "à", "zuwa", ...)
    if (!out.phone) {
      const tokens = rest.split(/\s+/);
      const lower = tokens.map(normalise);
      const markers = lex.markers.beneficiary.map(normalise);
      const at = lower.findIndex((t) => markers.includes(t));
      if (at >= 0) {
        const name: string[] = [];
        for (const t of tokens.slice(at + 1)) {
          if (!/^[\p{L}][\p{L}'-]*$/u.test(t) || name.length === 3) break;
          name.push(t);
        }
        if (name.length) out.name = name.join(' ');
      }
    }

    const norm = normalise(rest);

    // 3. reply words
    if (lex.confirm.some((w) => norm === normalise(w))) out.confirmWord = 'CONFIRM';
    else if (lex.cancel.some((w) => norm === normalise(w))) out.confirmWord = 'CANCEL';

    // 4. language switch
    for (const [name, code] of Object.entries(lex.languages)) {
      if (hasPhrase(norm, name)) {
        out.language = code;
        break;
      }
    }
    const switching = (lex.intents['LANGUAGE_SWITCH'] ?? []).some((p) => hasPhrase(norm, p));
    if (switching && out.language) return { intent: 'LANGUAGE_SWITCH', language: out.language };

    // 5. term explanation
    for (const [term, words] of Object.entries(lex.terms)) {
      if (words.some((w) => hasPhrase(norm, w))) {
        out.term = term;
        break;
      }
    }
    const possessive = (lex.possessive ?? []).some((w) => hasPhrase(norm, w));
    if (out.term && !possessive && (lex.intents['TERM_EXPLANATION'] ?? []).some((p) => hasPhrase(norm, p))) {
      return { intent: 'TERM_EXPLANATION', term: out.term };
    }

    // 6. intent by longest phrase match
    let best: { intent: Intent; score: number } | null = null;
    for (const intent of ORDER) {
      let score = 0;
      for (const p of lex.intents[intent] ?? []) {
        if (hasPhrase(norm, p)) score = Math.max(score, normalise(p).split(' ').length * 10 + normalise(p).length);
      }
      if (score > 0 && (!best || score > best.score)) best = { intent, score };
    }
    out.intent = best ? best.intent : null;
    return out;
  }
}
