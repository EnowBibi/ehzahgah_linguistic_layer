# Architecture

## Layers and what each one may do

| Layer | Does | Must not |
|---|---|---|
| `contract` | Types, the 13 intents, transaction statuses, the response guard | Contain logic that depends on other layers |
| `gateway` | Receives the POST and returns the reply | Know about banking or languages |
| `orchestrator` | Runs one turn in order. Owns the time budget | Hold business rules |
| `understanding` | User text to intent, amount, beneficiary, term, language | Call the bank |
| `dialogue` | State per phone number. Decides execute or reply | Format text |
| `operations` | One action per bank flow. The only caller of `bank` | Handle text or HTTP |
| `bank` | HTTP client with team key and trace id on every call | Decide anything |
| `generation` | Message id and slots to text | Call the bank |
| `channels` | Length and alphabet rules per channel | Change meaning |

Dependencies point one way: gateway, orchestrator, then understanding, dialogue, operations and
generation, then bank. Only `operations` imports `bank`. `contract` imports nothing.

## Rules taken from the sandbox documentation

1. **Trace id.** Every bank call carries the `X-Trace-Id` of the current turn. `bank.client.ts`
   attaches it. A bank call without it hides the work from the jury.
2. **Confirmation on its own turn.** `operations.confirm` refuses to run when the current trace id
   equals the trace id that created the pending transaction.
3. **Intent names.** The 13 intents are written in capitals. The response guard rejects anything else
   and replaces it with a valid `UNKNOWN` reply.
4. **Time budget.** The deadline is `timeout_ms` minus `SAFETY_MARGIN_MS`. Each bank call has its own
   timeout capped by the time left.
5. **No guessing.** Several matching beneficiaries lead to `CLARIFICATION_NEEDED`. A missing amount or
   beneficiary does too.
6. **Errors are translated.** Bank error codes map to `errors.json` messages and never reach the user raw.
7. **State by phone number.** A journey started on one channel can finish on another.

## Language data

Understanding reads `lexicon.json` merged along the fallback chain (language, French, English). A user
who mixes in a French or English word is understood in any language. Generation reads `messages.json`,
`errors.json` and `terms.json` with the same chain. An empty text falls back and the turn log records
`fallback=`.

## USSD alphabet

The GSM-7 alphabet lacks letters used by national languages (`ɛ ɔ ŋ ə ɗ ƙ ɓ`). Two options exist.
Transliteration keeps the 182-septet limit and may change spelling. Keeping the letters drops the limit
to 70 characters. The default is transliteration. Review the effect per language with a speaker
before the demonstration.

## Open questions for the organisers

| Question | Where it matters |
|---|---|
| Full list of `transaction.status` values | `contract/intents.ts` |
| JSON shape of each banking API response | `bank/bank.client.ts` (read defensively today) |
| Whether Ejagham (`etu`) and the other national languages will be sent in `language` | `locales/` folder names |
| Which language wins after a `LANGUAGE_SWITCH` turn, the gateway's or ours | `orchestrator.buildContext` |
| What the gateway sends in `ui_translation` mode for `mobile` and `web` | `orchestrator`, `channels` |
| Whether declaring AIRTIME_PURCHASE or BILL_PAYMENT without a bank call is flagged | `dialogue` |
