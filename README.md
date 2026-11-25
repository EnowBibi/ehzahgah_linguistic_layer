# ehzahgah_linguistic_layer

Reusable linguistic layer for digital financial services in Cameroonian national languages.
Middleware for the SAFINUM Innovate Challenge 2026 final. It receives a user request from the
sandbox gateway, understands it in the user's language, calls the simulated banking API, and
answers in that language.

Preselection work (the browser extension) lives in the repository `ehzahgah-finance-extension`
and is not part of this codebase.

## How a request flows

```
Gateway POST /middleware
  -> gateway        validate the request, run the response guard
  -> orchestrator   build the turn context (trace id, phone, channel, language, deadline)
  -> understanding  text -> intent + amount + beneficiary (rules from locales/<lang>/lexicon.json)
  -> dialogue       conversation state per phone number, decide the next step
  -> operations     the only layer that calls the bank (through bank/)
  -> generation     message id + slots -> text in the user's language (locales/<lang>/messages.json)
  -> channels       fit the channel: USSD length and GSM-7 alphabet
```

See `docs/ARCHITECTURE.md` for the rules each layer follows.

## Requirements

Node.js 20.19 or later, or 22.12 or later. NestJS 12 ships ESM only and relies on `require(esm)`.

## Quick start (Windows PowerShell)

```powershell
npm install
Copy-Item .env.example .env        # then edit .env and add your TEAM_KEY
npm run build
npm start
```

The service listens on port 3000. `GET /health` returns `{"status":"ok"}`.

### Try it without the sandbox

Open three terminals in the project folder.

```powershell
npm run mock:bank       # terminal 1: a stand-in for the banking API on port 4000
npm start               # terminal 2: this service on port 3000
npm run simulate        # terminal 3: replays a conversation and prints every reply
```

`npm run simulate` ends with the number of bank calls that carried no trace id. It must be 0.

### Tests

```powershell
npm test
```

Unit tests run every sandbox scenario against an in-memory bank (`test/helpers/fake-bank.ts`).
They use a small shim for `@nestjs/common` (`test/shims`) because Jest's CommonJS mode cannot load
Nest 12 before Node 24.9. The Nest wiring is covered by `npm run simulate`.

## Connect to the sandbox

1. Expose the service on a public URL. A tunnel works: `ngrok http 3000` or `cloudflared tunnel --url http://localhost:3000`.
2. Declare the URL for each channel (replace the key and the URL):

```powershell
curl.exe -s -X POST "https://safinum.cm/api/v1/sandbox/endpoint" `
  -H "X-Team-Key: sbx_your_key" -H "Content-Type: application/json" `
  -d '{\"channel\":\"ussd\",\"url\":\"https://YOUR-TUNNEL/middleware\"}'
```

Repeat for `mobile` and `web`. Declare the final URL before the evaluation starts. The
configuration locks during evaluation.

## Languages

One folder per language in `locales/`. The folder name is the ISO 639-3 code the sandbox sends.

| Code | Language | State |
|---|---|---|
| `hau` | Hausa | Draft for testing. Not validated by a linguist |
| `etu` | Ejagham | Structure only. A speaker must write the texts. Empty texts fall back to French, then English |
| `fr`, `en` | French, English | Reference and fallback |

Adding a language is a new folder. No code changes. See `locales/README.md`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `TEAM_KEY` | empty | Sandbox team key. Never commit it |
| `BANK_API_BASE` | sandbox URL | Used when a request carries no `bank_api.base_url` |
| `SAFETY_MARGIN_MS` | 400 | Time kept in reserve inside each channel timeout |
| `DEFAULT_LANGUAGE` | fr | Used when no language is known |
| `USSD_NON_GSM` | transliterate | `transliterate` converts letters outside GSM-7 (`ɛ ɔ ŋ ɗ ƙ`). `keep` leaves them and accepts the 70-character limit |
| `LOCALES_DIR` | `./locales` | Location of the language folders |

## Status of this scaffold

Implemented and tested: balance, fees, history, transfer with confirmation on a later turn,
correction, cancellation, clarification (missing amount or beneficiary, several matching
beneficiaries), error explanations, term explanations, language switching, USSD menu, GSM-7 fitting.

Not implemented: airtime purchase and bill payment (the intent is returned and a "not available"
message is sent), SMS, ATM and IVR channels, number words in national languages.

Items marked `TODO(verify)` in the code depend on facts the documentation excerpt does not show.
They are listed in `docs/ARCHITECTURE.md`.
