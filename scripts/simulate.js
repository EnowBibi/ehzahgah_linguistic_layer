// Replays a conversation against the running middleware. Start the mock bank and the middleware first:
//   npm run mock:bank      (terminal 1)
//   npm run build && npm start   (terminal 2)
//   npm run simulate       (terminal 3)
const MIDDLEWARE = process.env.MIDDLEWARE_URL || 'http://localhost:3000/middleware';
const BANK = process.env.MOCK_BANK_URL || 'http://localhost:4000/api/v1';
const PHONE = '237677000001';
let n = 0;

async function turn(label, text, { language = 'en', channel = 'web', session = 's1' } = {}) {
  const body = {
    trace_id: `trace-${++n}`,
    team_id: 'demo',
    channel,
    session_id: session,
    phone: PHONE,
    language,
    input: { type: channel === 'ussd' ? 'menu' : 'text', text },
    constraints:
      channel === 'ussd'
        ? { max_chars: 182, charset: 'gsm7', mode: 'menu', timeout_ms: 3000 }
        : { charset: 'utf8', mode: 'ui_translation', timeout_ms: 10000 },
    bank_api: { base_url: BANK },
  };
  const r = await (await fetch(MIDDLEWARE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  console.log(`\n[${label}] (${language}/${channel}) user: "${text}"`);
  console.log(`  intent=${r.interpretation.intent} params=${JSON.stringify(r.interpretation.parameters)} tx=${r.transaction.status}${r.transaction.id ? ' ' + r.transaction.id : ''}`);
  console.log('  reply: ' + r.response.text.replace(/\n/g, '\n         '));
}

(async () => {
  await turn('balance', 'what is my balance');
  await turn('balance hausa', 'ragowar kuɗi', { language: 'hau' });
  await turn('fees', 'how much does it cost to send 25000');
  await turn('transfer', 'send 5000 to Jean-Paul Mbarga');
  await turn('correction', 'no, 6000');
  await turn('confirm (next turn)', '1');
  await turn('ambiguous', 'send money');
  await turn('amount only', '3000');
  await turn('homonyms', 'to Jean');
  await turn('pick one', '2');
  await turn('cancel', '2');
  await turn('insufficient', 'send 450000 to Marie Essomba');
  await turn('term', 'what is a fee');
  await turn('term hausa', 'menene kuɗin caji', { language: 'hau' });
  await turn('switch language', 'switch to hausa');
  await turn('after switch', 'ragowar kuɗi', { language: null });
  await turn('ussd first dial', '', { channel: 'ussd', session: 'u1', language: 'hau' });
  await turn('ussd balance', '1', { channel: 'ussd', session: 'u1', language: 'hau' });
  const journal = await (await fetch(BANK.replace('/api/v1', '') + '/api/v1/_journal')).json();
  const calls = journal.filter((j) => j.path !== '_journal');
  console.log(`\nbank calls: ${calls.length}, without a trace id: ${calls.filter((j) => !j.trace).length}`);
})();
