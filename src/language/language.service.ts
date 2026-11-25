import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { emptyLexicon, LanguagePack, Lexicon } from './language.types';

/** Languages tried, in order, when a message is missing in the requested language. */
const FALLBACK_CHAIN = ['fr', 'en'];

@Injectable()
export class LanguageService implements OnModuleInit {
  private readonly log = new Logger('LanguageService');
  private readonly packs = new Map<string, LanguagePack>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onModuleInit() {
    this.load(process.env.LOCALES_DIR ?? join(process.cwd(), 'locales'));
  }

  load(dir: string) {
    if (!existsSync(dir)) throw new Error(`locales directory not found: ${dir}`);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const read = <T>(file: string, fallback: T): T => {
        const path = join(dir, entry.name, file);
        return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
      };
      this.packs.set(entry.name, {
        code: entry.name,
        lexicon: { ...emptyLexicon(), ...read<Partial<Lexicon>>('lexicon.json', {}) },
        messages: read('messages.json', {}),
        errors: read('errors.json', {}),
        terms: read('terms.json', {}),
        meta: read('meta.json', {}),
      });
    }
    this.log.log(`loaded languages: ${[...this.packs.keys()].join(', ')}`);
  }

  codes(): string[] {
    return [...this.packs.keys()];
  }

  has(code: string | null | undefined): boolean {
    return !!code && this.packs.has(code);
  }

  /** Picks a supported language. Unknown or null codes fall back to the default. */
  resolve(code: string | null | undefined): string {
    if (this.has(code)) return code as string;
    return this.has(this.config.defaultLanguage) ? this.config.defaultLanguage : 'en';
  }

  chain(code: string): string[] {
    return [code, ...FALLBACK_CHAIN].filter((c, i, a) => this.has(c) && a.indexOf(c) === i);
  }

  /** First non-empty value found along the fallback chain. */
  private lookup(code: string, pick: (p: LanguagePack) => string | undefined): { value: string; from: string } | null {
    for (const c of this.chain(code)) {
      const v = pick(this.packs.get(c)!);
      if (typeof v === 'string' && v.trim() !== '') return { value: v, from: c };
    }
    return null;
  }

  message(code: string, id: string) {
    return this.lookup(code, (p) => p.messages[id]);
  }

  error(code: string, errorCode: string) {
    return this.lookup(code, (p) => p.errors[errorCode]) ?? this.lookup(code, (p) => p.errors['DEFAULT']);
  }

  term(code: string, key: string) {
    return this.lookup(code, (p) => p.terms[key]);
  }

  /**
   * Understanding merges the lexicons along the fallback chain, so a user who mixes in a French or
   * English word is still understood in any language.
   */
  lexicon(code: string): Lexicon {
    const merged = emptyLexicon();
    for (const c of this.chain(code).reverse()) {
      const l = this.packs.get(c)!.lexicon;
      for (const [intent, phrases] of Object.entries(l.intents)) {
        merged.intents[intent] = [...(merged.intents[intent] ?? []), ...phrases];
      }
      for (const [term, words] of Object.entries(l.terms)) {
        merged.terms[term] = [...(merged.terms[term] ?? []), ...words];
      }
      merged.confirm.push(...l.confirm);
      merged.cancel.push(...l.cancel);
      merged.markers.beneficiary.push(...(l.markers?.beneficiary ?? []));
      Object.assign(merged.languages, l.languages);
      merged.possessive!.push(...(l.possessive ?? []));
    }
    return merged;
  }
}
