// Exercises the Claude integration against a local mock of the Messages API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let server;
let requests = [];
let nextReply;

before(async () => {
  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(nextReply));
  });
  await new Promise((r) => server.listen(0, r));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const message = (text, stop_reason = 'end_turn') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason,
  content: text === null ? [] : [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 },
});

test('analyze sends a structured-output request and merges local indicators', async () => {
  const { analyze } = await import('../lib/assistant.js');
  requests = [];
  nextReply = message(JSON.stringify({ risk: 'high', category: 'kyc_update', summary: 'Fake KYC SMS.', red_flags: ['Look-alike SBI link'], actions: ['Do not click.'] }));
  const r = await analyze({ text: 'Your SBI KYC expires today, update at http://sbi-kyc.xyz', channel: 'sms' });

  assert.equal(r.source, 'ai');
  assert.equal(r.category, 'kyc_update');
  assert.deepEqual(r.indicators.urls, ['http://sbi-kyc.xyz']);
  const { body, headers } = requests[0];
  assert.equal(body.model, 'claude-opus-5');
  assert.equal(body.fallbacks, 'default');
  assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.match(body.messages[0].content, /<received>[\s\S]*sbi-kyc\.xyz[\s\S]*<\/received>/);
});

test('analyze falls back to offline rules on refusal', async () => {
  const { analyze } = await import('../lib/assistant.js');
  nextReply = message(null, 'refusal');
  const r = await analyze({ text: 'Share the OTP now or your account will be blocked', channel: 'sms' });
  assert.equal(r.source, 'rules');
  assert.equal(r.category, 'otp_fraud');
  assert.match(r.note, /unavailable/);
});

test('draftComplaint returns the AI draft, or the template when the call fails', async () => {
  const { draftComplaint } = await import('../lib/assistant.js');
  nextReply = message('To,\nThe Cyber Crime Cell...');
  const ok = await draftComplaint({ name: 'Priya', category: 'upi_collect_fraud', amount: '5000' });
  assert.equal(ok.source, 'ai');
  assert.equal(ok.portalSection, 'Report Other Cyber Crime → Online Financial Fraud');

  nextReply = message('partial', 'max_tokens');
  const fallback = await draftComplaint({ name: 'Priya', category: 'upi_collect_fraud', amount: '5000' });
  assert.equal(fallback.source, 'template');
  assert.match(fallback.complaint, /I, Priya, wish to report/);
});
