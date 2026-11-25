export interface Lexicon {
  intents: Record<string, string[]>;
  confirm: string[];
  cancel: string[];
  markers: { beneficiary: string[] };
  terms: Record<string, string[]>;
  languages: Record<string, string>;
  /** Words like "my" or "mon": a question about "my balance" asks for the balance, not for a definition. */
  possessive?: string[];
}

export interface LanguagePack {
  code: string;
  lexicon: Lexicon;
  messages: Record<string, string>;
  errors: Record<string, string>;
  terms: Record<string, string>;
  meta: { name?: string; status?: string; [key: string]: unknown };
}

export const emptyLexicon = (): Lexicon => ({
  intents: {},
  confirm: [],
  cancel: [],
  markers: { beneficiary: [] },
  terms: {},
  languages: {},
  possessive: [],
});
