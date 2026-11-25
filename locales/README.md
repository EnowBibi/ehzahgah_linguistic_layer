# Locales

One folder per language. The folder name is the ISO 639-3 code the sandbox sends in `language`
(`hau` Hausa, `etu` Ejagham, `fr`, `en`). A new language is a new folder. No code changes.

| File | Holds | Used by |
|---|---|---|
| `lexicon.json` | What users may type: intent phrases, yes and no words, beneficiary marker words, term words, language names | `understanding` |
| `messages.json` | What the system says. One text per message id. `{slot}` values are filled by the code | `generation` |
| `errors.json` | One text per banking error code. Users never see raw codes | `generation` |
| `terms.json` | One or two sentences explaining a financial term | `generation` |
| `meta.json` | Name, status, notes | humans |

## Rules for writers
1. Write whole sentences in natural language. Do not translate word by word.
2. Keep every `{slot}` exactly as written. You may move it. Never translate it.
3. Amounts, names and numbers are inserted by the code and stay unchanged.
4. Messages with money or security meaning must be exact: `transfer.review`, `transfer.done`,
   `error.INSUFFICIENT_FUNDS`, `error.LIMIT_EXCEEDED`, `confirm.reprompt`.
5. USSD replies are limited to 182 septets. Short sentences matter. Letters such as the open e,
   the open o, the eng and the hooked d, k and b are not in the GSM-7 alphabet. See docs/ARCHITECTURE.md.
6. An empty text falls back to French, then English. Fallbacks are logged (`fallback=` in the turn log).

## Status

| Language | Code | State |
|---|---|---|
| Hausa | `hau` | Draft written for testing. Not validated |
| Ejagham | `etu` | Structure only. Waiting for a speaker to write the texts |
| French | `fr` | Reference and fallback |
| English | `en` | Reference and fallback |
