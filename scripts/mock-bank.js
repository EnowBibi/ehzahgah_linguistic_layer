// Local stand-in for the SAFINUM banking API, for development without the sandbox.
// Response shapes are GUESSES based on the integration documentation. Verify against the real API.
const http = require('http');
const PORT = process.env.MOCK_BANK_PORT || 4000;

const accounts = {
  '237677000001': { holder: 'Amina Ngo Bell', balance: 100000 },
  '237677000002': { holder: 'Jean-Paul Mbarga', balance: 50000 },
  '237677000003': { holder: 'Jean Mballa', balance: 20000 },
  '237677000004': { holder: 'Marie Essomba', balance: 75000 },
};
const history = {
  '237677000001': [
    { date: '2026-11-05', description: 'Merchant payment', amount: -12500 },
    { date: '2026-11-04', description: 'Salary received', amount: 180000 },
    { date: '2026-11-02', description: 'Transfer received', amount: 50000 },
  ],
};
const txs = new Map();
let seq = 1;
const journal = [];

const feeFor = (a) => (a <= 5000 ? 50 : a <= 25000 ? 150 : a <= 100000 ? 400 : Math.round(a * 0.01));
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const fail = (res, status, code) => send(res, status, { error: { code } });

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/^\/api\/v1\//, '');
    const trace = req.headers['x-trace-id'] || null;
    journal.push({ method: req.method, path, trace });
    console.log(`${req.method} /${path}${url.search} trace=${trace}`);
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      let m;
      if (path === '_journal') return send(res, 200, journal);
      if ((m = path.match(/^accounts\/(\d+)\/transactions$/))) return send(res, 200, { transactions: history[m[1]] || [] });
      if ((m = path.match(/^accounts\/(\d+)$/))) {
        const a = accounts[m[1]];
        return a ? send(res, 200, { phone: m[1], holder: a.holder, balance: a.balance, currency: 'XAF' }) : fail(res, 404, 'UNKNOWN_ACCOUNT');
      }
      if (path === 'beneficiaries') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const phone = url.searchParams.get('phone');
        const list = Object.entries(accounts)
          .filter(([p, a]) => (phone ? p === phone : a.holder.toLowerCase().includes(q)))
          .map(([p, a]) => ({ phone: p, name: a.holder }));
        return list.length ? send(res, 200, { beneficiaries: list }) : fail(res, 404, 'UNKNOWN_BENEFICIARY');
      }
      if (path === 'fees') {
        const amount = Number(url.searchParams.get('amount'));
        if (!Number.isInteger(amount) || amount <= 0) return fail(res, 422, 'INVALID_AMOUNT');
        return send(res, 200, { fee: feeFor(amount), total: amount + feeFor(amount) });
      }
      if (path === 'transactions' && req.method === 'POST') {
        const { from, to, amount } = body;
        if (!Number.isInteger(amount) || amount <= 0) return fail(res, 422, 'INVALID_AMOUNT');
        if (amount > 500000) return fail(res, 422, 'LIMIT_EXCEEDED');
        if (!accounts[to]) return fail(res, 404, 'UNKNOWN_BENEFICIARY');
        if (!accounts[from]) return fail(res, 404, 'UNKNOWN_ACCOUNT');
        if (accounts[from].balance < amount + feeFor(amount)) return fail(res, 422, 'INSUFFICIENT_FUNDS');
        const id = `TRX-${String(seq++).padStart(4, '0')}`;
        txs.set(id, { id, from, to, amount, status: 'pending' });
        return send(res, 201, { id, status: 'pending', amount, fee: feeFor(amount), total: amount + feeFor(amount) });
      }
      if ((m = path.match(/^transactions\/([\w-]+)\/(update|confirm|cancel)$/))) {
        const t = txs.get(m[1]);
        if (!t) return fail(res, 404, 'TX_NOT_FOUND');
        if (t.status !== 'pending') return fail(res, 409, 'TX_NOT_PENDING');
        if (m[2] === 'update') {
          if (body.amount !== undefined) t.amount = body.amount;
          if (body.to) t.to = body.to;
          return send(res, 200, { id: t.id, status: 'pending' });
        }
        if (m[2] === 'cancel') {
          t.status = 'cancelled';
          return send(res, 200, { id: t.id, status: 'cancelled' });
        }
        const fee = feeFor(t.amount);
        if (accounts[t.from].balance < t.amount + fee) return fail(res, 422, 'INSUFFICIENT_FUNDS');
        accounts[t.from].balance -= t.amount + fee;
        accounts[t.to].balance += t.amount;
        t.status = 'confirmed';
        return send(res, 200, { id: t.id, status: 'confirmed' });
      }
      fail(res, 404, 'INVALID_REQUEST');
    });
  })
  .listen(PORT, () => console.log(`mock bank on http://localhost:${PORT}/api/v1`));
