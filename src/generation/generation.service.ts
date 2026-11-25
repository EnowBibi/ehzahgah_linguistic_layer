import { Injectable } from '@nestjs/common';
import { LanguageService } from '../language/language.service';

const AMOUNT_KEYS = new Set(['amount', 'fee', 'total', 'balance']);

export interface Rendered {
  text: string;
  language: string; // language actually used for the text
  fellBack: boolean; // true when the requested language had no text for this message
}

const fmtMoney = (n: number) => `${n.toLocaleString('en-US')} FCFA`;

/** Message id + slots -> text in the user's language. Never calls the bank. */
@Injectable()
export class GenerationService {
  constructor(private readonly languages: LanguageService) {}

  private fill(template: string, slots: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (whole, key) => {
      const v = slots[key];
      if (v === undefined || v === null) return whole;
      return typeof v === 'number' && AMOUNT_KEYS.has(key) ? fmtMoney(v) : String(v);
    });
  }

  render(language: string, messageId: string, slots: Record<string, unknown> = {}): Rendered {
    let found: { value: string; from: string } | null = null;

    if (messageId.startsWith('term.')) found = this.languages.term(language, messageId.slice(5));
    else if (messageId.startsWith('error.')) found = this.languages.error(language, messageId.slice(6));
    else if (messageId === 'history.result') {
      const header = this.languages.message(language, 'history.header');
      const line = this.languages.message(language, 'history.line');
      if (header && line) {
        const items = (slots.items as any[]) ?? [];
        const body = items
          .map((it) =>
            this.fill(line.value, {
              date: it.date,
              description: it.description,
              amount: it.amount,
              sign: it.direction === 'in' ? '+' : '-',
            }),
          )
          .join('\n');
        return { text: `${header.value}\n${body}`, language: header.from, fellBack: header.from !== language };
      }
    } else found = this.languages.message(language, messageId);

    if (!found) {
      const generic = this.languages.message(language, 'clarify.generic');
      return { text: generic ? generic.value : 'Service unavailable.', language: generic?.from ?? 'en', fellBack: true };
    }
    return { text: this.fill(found.value, slots), language: found.from, fellBack: found.from !== language };
  }
}
