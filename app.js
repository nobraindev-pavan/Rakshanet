import { createEntry, sha256Hex, verifyChain } from './lib/ledger.js';
import { CATEGORIES, analyzeText } from './lib/scam-rules.js';
import { buildComplaint, portalSection } from './lib/complaint.js';

const $ = (sel) => document.querySelector(sel);
const KEYS = { ledger: 'rn.ledger', checklist: 'rn.checklist', profile: 'rn.profile' };
const AI_TIMEOUT_MS = 30_000;

// ---------- storage (never throws: private mode / blocked storage falls back to memory) ----------
const memory = {};
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return key in memory ? memory[key] : fallback;
  }
}
function save(key, value) {
  memory[key] = value;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* in-memory only */ }
}

const state = {
  ledger: load(KEYS.ledger, []),
  checklist: load(KEYS.checklist, {}),
  profile: load(KEYS.profile, {}),
  channel: 'sms',
  lastCheck: null,
  wallet: null,
};

// ---------- helpers ----------
let toastTimer;
function toast(text) {
  const node = $('#toast');
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2800);
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortHash = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const excerpt = (s, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy failed, select the text manually'); }
}

function download(name, text, type = 'text/plain') {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function postJSON(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Serialise vault writes so two quick events can never fork the chain.
let ledgerQueue = Promise.resolve();
function record(type, payload) {
  const job = ledgerQueue.then(async () => {
    const entry = await createEntry(state.ledger, type, payload);
    state.ledger = [...state.ledger, entry];
    save(KEYS.ledger, state.ledger);
    renderLedger();
    return entry;
  });
  ledgerQueue = job.catch(() => {});
  return job;
}

// ---------- routing ----------
const VIEWS = ['check', 'help', 'vault', 'report'];
function route() {
  const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'check';
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== name;
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (name === 'report') {
    $('#r-evcount').textContent = state.ledger.filter((e) => e.type !== 'ANCHOR').length;
    prefillFromVault();
  }
  window.scrollTo(0, 0);
}

// ---------- Scam Check ----------
const SAMPLES = [
  ['sms', 'Dear Customer, your SBI YONO account will be BLOCKED today due to pending KYC. Update PAN immediately: http://sbi-kyc-update.xyz/login or call 9876543210'],
  ['call', 'Caller said he is from FedEx. A parcel in my name with 5 passports and drugs was seized by Mumbai customs. He transferred me to a "CBI officer" on Skype video who said I am under digital arrest, must not tell anyone, and must transfer my savings to an RBI "verification account" refund.cbi@ybl.'],
  ['whatsapp', 'Hello! We are hiring for part-time work from home. Earn ₹3000 per day by liking YouTube videos. Join our Telegram task group. First prepaid task needs ₹1,000 deposit, 30% profit guaranteed.'],
  ['sms', 'Hi, are we still on for lunch tomorrow at 1pm? I booked the table at the usual place.'],
];
let sampleIdx = 0;

const PROVIDER_NAMES = { anthropic: 'Claude', gemini: 'Gemini' };
const RISK_TEXT = { high: 'High risk', medium: 'Suspicious', low: 'Low risk' };

function renderResult(r, { pending = false } = {}) {
  $('#result').hidden = false;
  const badge = $('#risk-badge');
  badge.textContent = RISK_TEXT[r.risk];
  badge.className = `risk risk-${r.risk}`;
  $('#result-category').textContent = r.categoryLabel;
  $('#result-source').textContent = r.source === 'ai' ? `AI analysis by ${PROVIDER_NAMES[r.provider] || 'AI'}, with offline link checks` : 'Offline rule check (instant, works without internet)';
  $('#result-summary').textContent = r.summary;
  $('#result-flags').replaceChildren(...(r.redFlags.length ? r.redFlags.map((f) => el('li', {}, f)) : [el('li', { class: 'muted' }, 'No specific warning signs found.')]));
  $('#result-actions').replaceChildren(...r.actions.map((a) => el('li', {}, a)));

  const i = r.indicators || {};
  const tags = [
    ...(i.phones || []).map((v) => ['Phone', v]),
    ...(i.upiIds || []).map((v) => ['UPI', v]),
    ...(i.urls || []).map((v) => ['Link', v]),
    ...(i.emails || []).map((v) => ['Email', v]),
    ...(i.amounts || []).map((v) => ['Amount', v]),
  ];
  $('#result-indicators-wrap').hidden = !tags.length;
  $('#result-indicators').replaceChildren(...tags.map(([k, v]) => el('span', { class: 'tag-pill' }, el('b', {}, k), ` ${v}`)));

  const status = $('#ai-status');
  if (pending) { status.textContent = 'Asking the AI for a deeper look…'; status.className = 'status pending'; }
  else if (r.note) { status.textContent = r.note; status.className = 'status'; }
  else { status.textContent = ''; status.className = 'status'; }
}

async function runCheck(e) {
  e?.preventDefault();
  const text = $('#check-text').value.trim();
  if (!text) return toast('Paste a message or link first');
  const channel = state.channel;

  // 1. Instant offline answer.
  const quick = analyzeText(text, channel);
  state.lastCheck = { text, channel, result: quick, saved: false };
  renderResult(quick, { pending: true });
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 2. AI upgrade when the server has it; otherwise keep the offline result.
  let final = quick;
  try {
    const ai = await postJSON('api/analyze', { text, channel });
    if (ai && ai.risk && ai.summary) final = ai;
  } catch {
    final = { ...quick, note: navigator.onLine ? 'AI analysis is not available on this deployment; showing offline rule check.' : 'You are offline; showing offline rule check.' };
  }
  if (state.lastCheck?.text !== text) return; // user started a newer check
  state.lastCheck.result = final;
  renderResult(final);
}

async function saveCheck() {
  const c = state.lastCheck;
  if (!c) return;
  if (c.saved) return toast('Already in your vault');
  const r = c.result;
  await record('CHECK', {
    channel: c.channel,
    text: c.text,
    textHash: await sha256Hex(c.text),
    risk: r.risk,
    category: r.category,
    source: r.source,
    indicators: r.indicators,
  });
  c.saved = true;
  toast('Sealed in your Evidence Vault');
}

function reportFromCheck() {
  const c = state.lastCheck;
  if (!c) return;
  const i = c.result.indicators || {};
  $('#r-category').value = c.result.category === 'not_a_scam' ? 'other' : c.result.category;
  $('#r-suspect').value = [...(i.phones || []), ...(i.upiIds || []), ...(i.urls || []), ...(i.emails || [])].join(', ');
  if (!$('#r-desc').value.trim()) {
    const via = { sms: 'an SMS', whatsapp: 'a WhatsApp message', call: 'a phone call', email: 'an email', social: 'a social media / Telegram message', link: 'a link' }[c.channel];
    $('#r-desc').value = `I received ${via}${c.channel === 'call' ? ' in which the caller said' : ' that said'}:\n"${c.text}"\n\n<Describe what you did next and what happened>`;
  }
  if (!c.saved) saveCheck();
  location.hash = '#report';
}

function setupCheck() {
  for (const chip of document.querySelectorAll('[data-channel]')) {
    chip.addEventListener('click', () => {
      state.channel = chip.dataset.channel;
      for (const c of document.querySelectorAll('[data-channel]')) {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-checked', String(c === chip));
      }
    });
  }
  $('#check-form').addEventListener('submit', runCheck);
  $('#check-sample').addEventListener('click', () => {
    const [channel, text] = SAMPLES[sampleIdx++ % SAMPLES.length];
    document.querySelector(`[data-channel="${channel}"]`).click();
    $('#check-text').value = text;
  });
  $('#result-save').addEventListener('click', saveCheck);
  $('#result-report').addEventListener('click', reportFromCheck);
}

// ---------- Scammed? (emergency checklist) ----------
const STEPS = [
  ['call1930', 'Call 1930, the National Cyber Crime Helpline', 'Keep the amount, time, transaction/UTR ID and the scammer\'s account or UPI ID ready. They can alert banks to freeze the money.', ['Call 1930', 'tel:1930']],
  ['bank', 'Call your bank to block your card, UPI and net banking', 'Use the number on the back of your card or in the official app, never one from a message or search ad. Ask them to raise a fraud dispute.'],
  ['evidence', 'Save the evidence before it disappears', 'Screenshots of chats, the caller\'s number, payment screenshots and UTR IDs. Seal them in the Vault.', ['Open Vault', '#vault']],
  ['portal', 'File a complaint on cybercrime.gov.in', 'Do it within 24 hours and note the acknowledgement number. RakshaNet can draft it for you.', ['Draft complaint', '#report']],
  ['passwords', 'Change passwords and turn on 2-step verification', 'Email first (it resets everything else), then banking, WhatsApp (Settings, then Account, then Two-step verification) and social media.'],
  ['devices', 'Remove remote-access apps and log out unknown devices', 'Uninstall AnyDesk, TeamViewer or any APK a stranger asked you to install. Check WhatsApp "Linked devices" and your Google or Apple account devices.'],
  ['warn', 'Warn your contacts', 'Scammers use hacked accounts to ask friends for money. Share the warning below.'],
  ['chakshu', 'Report the fraud number on Sanchar Saathi (Chakshu)', 'Flag the calling number or SMS header so it can be blocked for others.', ['Open Sanchar Saathi', 'https://sancharsaathi.gov.in']],
  ['sim', 'If your SIM suddenly stopped working, call your operator', 'Sudden loss of network can mean a SIM-swap. Ask the operator to block the SIM and reissue it.'],
];

const WARNING = '⚠️ Please be careful: my account may have been hacked. If you get a message from me asking for money, an OTP, or to click a link, do NOT respond. Call me on my usual number to check. (Sent via RakshaNet)';

function renderChecklist() {
  const done = STEPS.filter(([id]) => state.checklist[id]).length;
  $('#checklist-progress').textContent = `${done}/${STEPS.length} done`;
  $('#checklist').replaceChildren(...STEPS.map(([id, title, detail, link]) => el('li', { class: state.checklist[id] ? 'is-done' : '' },
    el('label', {},
      el('input', { type: 'checkbox', checked: Boolean(state.checklist[id]), onchange: (e) => {
        state.checklist = { ...state.checklist, [id]: e.target.checked };
        save(KEYS.checklist, state.checklist);
        renderChecklist();
      } }),
      el('span', {}, el('strong', {}, title), el('span', { class: 'muted small' }, detail))),
    link ? el('a', { class: 'btn btn-outline btn-sm', href: link[1], ...(link[1].startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, link[0]) : null,
  )));
}

function setupHelp() {
  $('#warn-text').textContent = WARNING;
  $('#warn-copy').addEventListener('click', () => copy(WARNING));
  $('#warn-share').addEventListener('click', () => {
    if (navigator.share) navigator.share({ text: WARNING }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(WARNING)}`, '_blank', 'noopener');
  });
  renderChecklist();
}

// ---------- Evidence Vault ----------
const LABELS = { CHECK: 'Scam message', EVIDENCE: 'Evidence', REPORT: 'Complaint drafted', ANCHOR: 'Wallet signature' };

function describe(entry) {
  const p = entry.payload;
  switch (entry.type) {
    case 'CHECK': return `${RISK_TEXT[p.risk]} · ${CATEGORIES[p.category] || p.category} · via ${p.channel}\n“${excerpt(p.text)}”`;
    case 'EVIDENCE': return [p.label, p.text ? `“${excerpt(p.text)}”` : null, p.file ? `File: ${p.file.name} (${Math.ceil(p.file.size / 1024)} KB), SHA-256 ${shortHash(p.file.hash)}` : null].filter(Boolean).join('\n');
    case 'REPORT': return `${CATEGORIES[p.category] || 'Complaint'}${p.amount ? ` · ₹${Number(p.amount).toLocaleString('en-IN')}` : ''} · drafted by ${p.source === 'ai' ? 'AI' : 'template'} · text hash ${shortHash(p.complaintHash)}`;
    case 'ANCHOR': return `Signed by ${p.address.slice(0, 6)}…${p.address.slice(-4)} over vault head ${shortHash(p.head)}`;
    default: return '';
  }
}

function renderLedger(brokenAt = -1) {
  const list = $('#ledger-list');
  if (!state.ledger.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Nothing sealed yet. Save a scam check or add a screenshot above.'));
    return;
  }
  list.replaceChildren(...[...state.ledger].reverse().map((e) => el('li', { class: e.index === brokenAt ? 'is-broken' : '' },
    el('div', { class: 'entry-head' },
      el('span', {}, el('span', { class: `tag tag-${e.type}` }, e.type), ' ', el('strong', {}, `#${e.index} ${LABELS[e.type] || e.type}`)),
      el('span', { class: 'muted small' }, fmtTime(e.timestamp))),
    el('div', { class: 'small pre' }, describe(e)),
    el('p', { class: 'hash', title: e.hash }, `hash ${e.hash}\nprev ${e.prevHash}`),
  )));
}

function setStatus(target, text, kind) {
  const node = $(target);
  node.textContent = text;
  node.className = `status ${kind || ''}`;
}

async function verify() {
  const result = await verifyChain(state.ledger);
  if (result.ok) setStatus('#ledger-status', `✓ Vault intact: ${result.length} records, head ${shortHash(result.head)}`, 'ok');
  else setStatus('#ledger-status', `✗ Broken at #${result.brokenAt}: ${result.reason}`, 'bad');
  renderLedger(result.ok ? -1 : result.brokenAt);
  return result;
}

async function tamperTest() {
  if (!state.ledger.length) return toast('Seal something first');
  // Work on a copy so the real vault is never touched.
  const copyChain = structuredClone(state.ledger);
  const target = copyChain[Math.floor(copyChain.length / 2)];
  target.timestamp = new Date(Date.parse(target.timestamp) - 3_600_000).toISOString();
  const result = await verifyChain(copyChain);
  setStatus('#ledger-status', `Tamper test: backdated #${target.index} by 1 hour in a copy → ${result.ok ? 'NOT detected' : `caught at #${result.brokenAt} (${result.reason})`}. Your real vault is unchanged.`, result.ok ? 'bad' : 'ok');
}

async function exportPack() {
  const check = await verifyChain(state.ledger);
  download(`rakshanet-evidence-${Date.now()}.json`, JSON.stringify({
    app: 'RakshaNet',
    exportedAt: new Date().toISOString(),
    verification: check,
    howToVerify: 'Each entry hash = SHA-256 of canonical JSON {index,timestamp,type,payload,prevHash} with keys sorted; prevHash links to the previous entry.',
    entries: state.ledger,
  }, null, 2), 'application/json');
}

async function sealEvidence(e) {
  e.preventDefault();
  const label = $('#ev-label').value.trim();
  const text = $('#ev-text').value.trim();
  const file = $('#ev-file').files[0];
  if (!label) return toast('Give the evidence a short label');
  let fileInfo;
  if (file) {
    if (file.size > 25 * 1024 * 1024) return toast('File is over 25 MB');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    fileInfo = { name: file.name, size: file.size, type: file.type || 'unknown', hash, lastModified: new Date(file.lastModified).toISOString() };
  }
  await record('EVIDENCE', { label, text: text || undefined, file: fileInfo });
  $('#evidence-form').reset();
  toast('Evidence sealed. Keep the original file safe; its fingerprint proves it is unchanged.');
}

// ---------- Wallet (EIP-1193, e.g. MetaMask) ----------
function setWallet(address) {
  state.wallet = address || null;
  $('#wallet-btn').textContent = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet';
}

async function connectWallet() {
  if (!window.ethereum) { toast('No browser wallet found. Install MetaMask to sign evidence.'); return null; }
  try {
    const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWallet(address);
    return address;
  } catch {
    toast('Wallet connection cancelled');
    return null;
  }
}

async function anchor() {
  if (!state.ledger.length) return toast('Seal something first');
  const check = await verifyChain(state.ledger);
  if (!check.ok) return verify();
  const address = state.wallet || (await connectWallet());
  if (!address) return;
  const message = `RakshaNet evidence anchor\nRecords: ${check.length}\nHead: ${check.head}\nTime: ${new Date().toISOString()}`;
  try {
    const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
    await record('ANCHOR', { address, head: check.head, message, signature });
    setStatus('#ledger-status', '✓ Vault signed by your wallet and recorded.', 'ok');
  } catch {
    toast('Signature cancelled');
  }
}

// ---------- Report ----------
function incidentFromForm() {
  const suspect = $('#r-suspect').value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const evidence = $('#r-attach').checked
    ? state.ledger.filter((e) => e.type === 'CHECK' || e.type === 'EVIDENCE').map((e) => ({
      index: e.index,
      label: e.type === 'CHECK' ? `Scam ${e.payload.channel} message (${CATEGORIES[e.payload.category] || 'suspicious'})` : e.payload.label,
      hash: e.hash,
      ...(e.type === 'CHECK' ? { text: excerpt(e.payload.text, 600) } : {}),
    }))
    : [];
  const when = $('#r-when').value;
  return {
    name: $('#r-name').value.trim(),
    phone: $('#r-phone').value.trim(),
    email: $('#r-email').value.trim(),
    city: $('#r-city').value.trim(),
    category: $('#r-category').value,
    when: when ? new Date(when).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '',
    amount: $('#r-amount').value.replace(/[^\d.]/g, ''),
    txns: $('#r-txns').value.trim(),
    description: $('#r-desc').value.trim(),
    suspect: {
      phones: suspect.filter((s) => /^\+?[\d\s-]{10,}$/.test(s)),
      upiIds: suspect.filter((s) => /^[\w.-]+@[a-z]+$/i.test(s)),
      emails: suspect.filter((s) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)),
      urls: suspect.filter((s) => !/@/.test(s) && /[a-z]\.[a-z]/i.test(s)),
    },
    evidence,
  };
}

async function draft(e) {
  e.preventDefault();
  const incident = incidentFromForm();
  if (!incident.description) return toast('Describe what happened first');
  state.profile = { name: incident.name, phone: incident.phone, email: incident.email, city: incident.city };
  save(KEYS.profile, state.profile);

  const btn = $('#report-form button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Drafting…';
  let out;
  try {
    out = await postJSON('api/complaint', { incident });
    if (!out?.complaint) throw new Error('empty');
  } catch {
    out = { source: 'template', complaint: buildComplaint(incident), portalSection: portalSection(incident.category, incident.amount), note: 'AI drafting is not available here; used the standard template.' };
  } finally {
    btn.disabled = false;
    btn.textContent = 'Draft complaint';
  }
  $('#complaint-wrap').hidden = false;
  $('#complaint-text').value = out.complaint;
  $('#complaint-meta').textContent = [
    out.source === 'ai' ? `Drafted by ${PROVIDER_NAMES[out.provider] || 'AI'}. Check every detail before you file it.` : (out.note || 'Standard template.'),
    `On cybercrime.gov.in choose: ${out.portalSection}.`,
  ].join(' ');
  await record('REPORT', { category: incident.category, amount: incident.amount || undefined, source: out.source, complaintHash: await sha256Hex(out.complaint) });
  $('#complaint-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Opening Report directly: start from the most recent scam check in the vault.
function prefillFromVault() {
  if ($('#r-suspect').value.trim() || $('#r-category').value !== 'other') return;
  const last = [...state.ledger].reverse().find((e) => e.type === 'CHECK' && e.payload.category !== 'not_a_scam');
  if (!last) return;
  const i = last.payload.indicators || {};
  $('#r-category').value = last.payload.category;
  $('#r-suspect').value = [...(i.phones || []), ...(i.upiIds || []), ...(i.urls || []), ...(i.emails || [])].join(', ');
}

function setupReport() {
  $('#r-category').replaceChildren(...Object.entries(CATEGORIES).filter(([k]) => k !== 'not_a_scam').map(([k, v]) => el('option', { value: k }, v)));
  $('#r-category').value = 'other';
  for (const [k, id] of [['name', 'r-name'], ['phone', 'r-phone'], ['email', 'r-email'], ['city', 'r-city']]) {
    if (state.profile[k]) $(`#${id}`).value = state.profile[k];
  }
  $('#report-form').addEventListener('submit', draft);
  $('#complaint-copy').addEventListener('click', () => copy($('#complaint-text').value));
  $('#complaint-download').addEventListener('click', () => download(`cybercrime-complaint-${Date.now()}.txt`, $('#complaint-text').value));
}

// ---------- boot ----------
setupCheck();
setupHelp();
setupReport();
renderLedger();
route();

window.addEventListener('hashchange', route);
$('#evidence-form').addEventListener('submit', sealEvidence);
$('#ledger-verify').addEventListener('click', verify);
$('#ledger-tamper').addEventListener('click', tamperTest);
$('#ledger-export').addEventListener('click', exportPack);
$('#ledger-anchor').addEventListener('click', anchor);
$('#wallet-btn').addEventListener('click', connectWallet);
window.ethereum?.request({ method: 'eth_accounts' }).then(([a]) => setWallet(a)).catch(() => {});
window.ethereum?.on?.('accountsChanged', ([a]) => setWallet(a));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
