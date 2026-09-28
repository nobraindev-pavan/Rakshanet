// Exercises the Gemini path against a local mock of the Gemini API.
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
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const reply = (text, finishReason = 'STOP') => ({
  candidates: [{ content: { role: 'model', parts: text === null ? [] : [{ text }] }, finishReason }],
  modelVersion: 'gemini-test',
});

test('Gemini is chosen when only GEMINI_API_KEY is set', async () => {
  const { aiProvider } = await import('../lib/assistant.js');
  assert.equal(aiProvider(), 'gemini');
});

test('analyze sends a JSON-schema request to Gemini and parses the answer', async () => {
  const { analyze } = await import('../lib/assistant.js');
  requests = [];
  nextReply = reply('```json\n' + JSON.stringify({ risk: 'high', category: 'upi_collect_fraud', summary: 'UPI refund trick.', red_flags: ['Asks for UPI PIN to receive'], actions: ['Decline the request.'] }) + '\n```');
  const r = await analyze({ text: 'Enter UPI PIN to receive refund from help.desk@ybl', channel: 'sms' });

  assert.equal(r.source, 'ai');
  assert.equal(r.provider, 'gemini');
  assert.equal(r.category, 'upi_collect_fraud');
  assert.deepEqual(r.indicators.upiIds, ['help.desk@ybl']);
  const { url, body } = requests[0];
  assert.match(url, /models\/gemini-flash-latest:generateContent/);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.responseJsonSchema.properties.risk);
  assert.match(JSON.stringify(body.systemInstruction), /cyber-fraud analyst/);
  assert.match(JSON.stringify(body.contents), /<received>/);
});

test('a blocked or truncated Gemini answer falls back to rules / template', async () => {
  const { analyze, draftComplaint } = await import('../lib/assistant.js');
  nextReply = reply(null, 'SAFETY');
  const r = await analyze({ text: 'Share the OTP now or your account will be blocked' });
  assert.equal(r.source, 'rules');
  assert.match(r.note, /SAFETY/);

  nextReply = reply('To, The Cyber', 'MAX_TOKENS');
  const c = await draftComplaint({ name: 'Ravi', category: 'otp_fraud' });
  assert.equal(c.source, 'template');

  nextReply = reply('To,\nThe Cyber Crime Cell');
  const ok = await draftComplaint({ name: 'Ravi', category: 'otp_fraud' });
  assert.equal(ok.source, 'ai');
  assert.equal(ok.provider, 'gemini');
});
