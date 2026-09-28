import { createEntry, verifyChain } from './lib/ledger.js';

const $ = (sel) => document.querySelector(sel);
const HOLD_MS = 1500;
const KEYS = { ledger: 'rn.ledger', guardians: 'rn.guardians', me: 'rn.me', walk: 'rn.walk' };

// ---------- storage (never throws: private mode / blocked storage still works in-memory) ----------
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
  guardians: load(KEYS.guardians, []),
  me: load(KEYS.me, ''),
  walk: load(KEYS.walk, null),
  wallet: null,
};

// ---------- helpers ----------
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const shortHash = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const mapsLink = (p) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const digits = (phone) => phone.replace(/[^\d]/g, '');

function getPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 },
    );
  });
}

// Serialise ledger writes so two quick events can never fork the chain.
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
const VIEWS = ['sos', 'walk', 'ledger', 'guardians', 'map'];
function route() {
  const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'sos';
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== name;
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (name === 'map') openMap();
  window.scrollTo(0, 0);
}

// ---------- SOS ----------
async function triggerSOS(reason) {
  const note = $('#sos-note').value.trim();
  toast('Getting your location…');
  const pos = await getPosition();
  const entry = await record('SOS', { ...(pos || { location: 'unavailable' }), note: note || undefined, reason });
  $('#sos-note').value = '';
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  showAlert(entry, pos, note, reason);
}

function buildMessage(entry, pos, note, reason) {
  return [
    `🚨 RakshaNet SOS${state.me ? ` from ${state.me}` : ''}: I need help.`,
    reason ? `Reason: ${reason}` : null,
    note ? `Note: ${note}` : null,
    pos ? `Location: ${mapsLink(pos)} (±${pos.accuracy} m)` : 'Location: unavailable, please call me.',
    `Time: ${fmtTime(entry.timestamp)}`,
    `Evidence #${entry.index} hash: ${shortHash(entry.hash)}`,
  ].filter(Boolean).join('\n');
}

function showAlert(entry, pos, note, reason) {
  const message = buildMessage(entry, pos, note, reason);
  const text = encodeURIComponent(message);
  $('#alert-message').textContent = message;
  $('#alert-meta').textContent = `Sealed as ledger entry #${entry.index}. Send it now:`;

  const phones = state.guardians.map((g) => g.phone);
  const actions = [
    el('a', { class: 'btn btn-danger', href: 'tel:112' }, 'Call 112'),
    phones.length
      ? el('a', { class: 'btn btn-primary', href: `sms:${phones.join(',')}?&body=${text}` }, 'SMS all guardians')
      : el('a', { class: 'btn btn-primary', href: '#guardians' }, 'Add guardians'),
    ...state.guardians.map((g) => el('a', { class: 'btn btn-outline', href: `https://wa.me/${digits(g.phone)}?text=${text}`, target: '_blank', rel: 'noopener' }, `WhatsApp ${g.name}`)),
  ];
  if (navigator.share) actions.push(el('button', { class: 'btn btn-outline', type: 'button', onclick: () => navigator.share({ title: 'RakshaNet SOS', text: message }).catch(() => {}) }, 'Share…'));
  actions.push(el('button', { class: 'btn btn-outline', type: 'button', onclick: () => copy(message) }, 'Copy message'));
  $('#alert-actions').replaceChildren(...actions);
  $('#toast').hidden = true;
  $('#alert-dialog').showModal();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy failed, select the text manually'); }
}

function setupHoldButton() {
  const btn = $('#sos-btn');
  let raf = 0;
  let start = 0;
  let firing = false;

  const reset = () => {
    cancelAnimationFrame(raf);
    start = 0;
    btn.classList.remove('is-holding');
    btn.style.setProperty('--p', 0);
  };
  const tick = (now) => {
    const p = Math.min(1, (now - start) / HOLD_MS);
    btn.style.setProperty('--p', p);
    if (p < 1) { raf = requestAnimationFrame(tick); return; }
    reset();
    if (firing) return;
    firing = true;
    triggerSOS().finally(() => { firing = false; });
  };
  const begin = (e) => {
    if (start) return;
    e.preventDefault();
    start = performance.now();
    btn.classList.add('is-holding');
    raf = requestAnimationFrame(tick);
  };

  btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture?.(e.pointerId); begin(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, reset);
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') reset(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- Safe Walk ----------
let walkMinutes = 15;
let walkTimer = 0;

function startWalk() {
  const dest = $('#walk-dest').value.trim();
  const now = Date.now();
  state.walk = { dest, startedAt: now, deadline: now + walkMinutes * 60_000 };
  save(KEYS.walk, state.walk);
  record('WALK_START', { dest: dest || undefined, minutes: walkMinutes });
  renderWalk();
}

function endWalk(type, extra) {
  if (!state.walk) return;
  const { dest, startedAt } = state.walk;
  state.walk = null;
  save(KEYS.walk, null);
  renderWalk();
  if (type === 'CHECKIN') {
    record('CHECKIN', { dest: dest || undefined, minutes: Math.round((Date.now() - startedAt) / 60_000) });
    toast('Glad you are safe. Check-in recorded.');
  } else {
    triggerSOS(extra);
  }
}

function renderWalk() {
  clearInterval(walkTimer);
  const active = Boolean(state.walk);
  $('#walk-setup').hidden = active;
  $('#walk-active').hidden = !active;
  if (!active) return;
  $('#walk-dest-label').textContent = state.walk.dest ? `Heading to: ${state.walk.dest}` : 'Safe Walk in progress';
  const update = () => {
    const { startedAt, deadline } = state.walk;
    const left = Math.max(0, deadline - Date.now());
    const s = Math.ceil(left / 1000);
    $('#walk-timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('#walk-timer').classList.toggle('is-urgent', s <= 60);
    $('#walk-progress').style.transform = `scaleX(${left / (deadline - startedAt)})`;
    if (left === 0) endWalk('SOS', 'Missed Safe Walk check-in');
  };
  update();
  if (state.walk) walkTimer = setInterval(update, 1000);
}

function setupWalk() {
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      walkMinutes = Number(chip.dataset.min);
      for (const c of document.querySelectorAll('.chip')) c.classList.toggle('is-active', c === chip);
    });
  }
  $('#walk-start').addEventListener('click', startWalk);
  $('#walk-safe').addEventListener('click', () => endWalk('CHECKIN'));
  $('#walk-panic').addEventListener('click', () => endWalk('SOS', 'Manual SOS during Safe Walk'));
  $('#walk-extend').addEventListener('click', () => {
    state.walk.deadline += 5 * 60_000;
    save(KEYS.walk, state.walk);
    renderWalk();
    toast('Added 5 minutes');
  });
  renderWalk();
}

// ---------- Ledger ----------
const LABELS = { SOS: 'SOS alert', CHECKIN: 'Safe check-in', WALK_START: 'Safe Walk started', ANCHOR: 'Wallet signature' };

function describe(entry) {
  const p = entry.payload;
  switch (entry.type) {
    case 'SOS': return [p.reason, p.note, p.lat !== undefined ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} (±${p.accuracy} m)` : 'Location unavailable'].filter(Boolean).join(' · ');
    case 'WALK_START': return `${p.minutes} min${p.dest ? ` to ${p.dest}` : ''}`;
    case 'CHECKIN': return `Arrived safely${p.dest ? ` at ${p.dest}` : ''} after ${p.minutes} min`;
    case 'ANCHOR': return `Signed by ${p.address.slice(0, 6)}…${p.address.slice(-4)} over head ${shortHash(p.head)}`;
    default: return '';
  }
}

function renderLedger(brokenAt = -1) {
  const list = $('#ledger-list');
  if (!state.ledger.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'No records yet. Send an SOS or start a Safe Walk and it appears here.'));
    return;
  }
  list.replaceChildren(...[...state.ledger].reverse().map((e) => el('li', { class: e.index === brokenAt ? 'is-broken' : '' },
    el('div', { class: 'entry-head' },
      el('span', {}, el('span', { class: `tag tag-${e.type}` }, e.type), ' ', el('strong', {}, `#${e.index} ${LABELS[e.type] || e.type}`)),
      el('span', { class: 'muted small' }, fmtTime(e.timestamp))),
    el('div', { class: 'small' }, describe(e)),
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
  if (result.ok) setStatus('#ledger-status', `✓ Chain intact: ${result.length} records, head ${shortHash(result.head)}`, 'ok');
  else setStatus('#ledger-status', `✗ Broken at #${result.brokenAt}: ${result.reason}`, 'bad');
  renderLedger(result.ok ? -1 : result.brokenAt);
}

async function tamperTest() {
  if (!state.ledger.length) return toast('Record something first');
  // Work on a copy so the real ledger is never touched.
  const copyChain = structuredClone(state.ledger);
  const target = copyChain[Math.floor(copyChain.length / 2)];
  target.timestamp = new Date(Date.parse(target.timestamp) - 3_600_000).toISOString();
  const result = await verifyChain(copyChain);
  setStatus('#ledger-status', `Tamper test: shifted #${target.index}'s time by 1 hour in a copy → ${result.ok ? 'NOT detected' : `detected at #${result.brokenAt} (${result.reason})`}. Your real ledger is unchanged.`, result.ok ? 'bad' : 'ok');
}

function exportLedger() {
  const blob = new Blob([JSON.stringify({ app: 'RakshaNet', exportedAt: new Date().toISOString(), entries: state.ledger }, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `rakshanet-ledger-${Date.now()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Wallet (EIP-1193, e.g. MetaMask / Phantom EVM) ----------
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
  if (!state.ledger.length) return toast('Record something first');
  const check = await verifyChain(state.ledger);
  if (!check.ok) return verify();
  const address = state.wallet || (await connectWallet());
  if (!address) return;
  const message = `RakshaNet evidence anchor\nRecords: ${check.length}\nHead: ${check.head}\nTime: ${new Date().toISOString()}`;
  try {
    const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
    await record('ANCHOR', { address, head: check.head, message, signature });
    setStatus('#ledger-status', '✓ Ledger head signed by your wallet and recorded.', 'ok');
  } catch {
    toast('Signature cancelled');
  }
}

// ---------- Guardians ----------
function renderGuardians() {
  const list = $('#guardian-list');
  list.replaceChildren(...(state.guardians.length ? state.guardians.map((g, i) => el('li', {},
    el('div', {}, el('strong', {}, g.name), el('span', { class: 'muted small' }, g.phone)),
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `Remove ${g.name}`, onclick: () => {
      state.guardians = state.guardians.filter((_, j) => j !== i);
      save(KEYS.guardians, state.guardians);
      renderGuardians();
    } }, 'Remove'),
  )) : [el('li', { class: 'empty' }, 'Add at least one guardian so your SOS reaches someone.')]));
  const n = state.guardians.length;
  $('#guardian-summary').textContent = n ? `Alerts go to ${state.guardians.map((g) => g.name).join(', ')}.` : 'No guardians yet: add them in the Guardians tab.';
}

function setupGuardians() {
  $('#me-name').value = state.me;
  $('#me-name').addEventListener('change', (e) => { state.me = e.target.value.trim(); save(KEYS.me, state.me); });
  $('#guardian-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#g-name').value.trim();
    const phone = $('#g-phone').value.trim();
    if (!name || digits(phone).length < 7) return toast('Enter a name and a valid phone number');
    state.guardians = [...state.guardians, { name, phone }];
    save(KEYS.guardians, state.guardians);
    $('#g-name').value = '';
    $('#g-phone').value = '';
    renderGuardians();
    toast(`${name} added`);
  });
  renderGuardians();
}

// ---------- Map (Leaflet is only downloaded when this tab is opened) ----------
let mapPromise;
function loadLeaflet() {
  const base = 'vendor/leaflet/';
  document.head.append(el('link', { rel: 'stylesheet', href: `${base}leaflet.css` }));
  return new Promise((resolve, reject) => {
    document.head.append(el('script', { src: `${base}leaflet.js`, onload: () => resolve(window.L), onerror: reject }));
  });
}

function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchHelp(pos) {
  const query = `[out:json][timeout:15];(nwr["amenity"~"^(police|hospital)$"](around:3000,${pos.lat},${pos.lng}););out center 60;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }) });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const { elements } = await res.json();
  return elements
    .map((e) => ({ kind: e.tags.amenity, name: e.tags.name || (e.tags.amenity === 'police' ? 'Police station' : 'Hospital'), phone: e.tags.phone || e.tags['contact:phone'], lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon }))
    .filter((p) => p.lat !== undefined)
    .map((p) => ({ ...p, km: distanceKm(pos, p) }))
    .sort((a, b) => a.km - b.km);
}

function openMap() {
  if (mapPromise) { mapPromise.then((m) => m && m.invalidateSize()); return; }
  mapPromise = (async () => {
    setStatus('#map-status', 'Loading map and finding your location…');
    let L;
    try { L = await loadLeaflet(); } catch {
      setStatus('#map-status', 'Map could not load. SOS and the ledger still work offline.', 'bad');
      mapPromise = null;
      return null;
    }
    const pos = await getPosition();
    const center = pos || { lat: 12.9716, lng: 77.5946 };
    const map = L.map('map', { zoomControl: true }).setView([center.lat, center.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    if (pos) L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map).bindPopup('You are here');
    for (const e of state.ledger) {
      if (e.type === 'SOS' && e.payload.lat !== undefined) {
        L.circleMarker([e.payload.lat, e.payload.lng], { radius: 7, color: '#ff3b5c', fillOpacity: 0.8 }).addTo(map).bindPopup(`SOS #${e.index}<br>${fmtTime(e.timestamp)}`);
      }
    }
    if (!pos) setStatus('#map-status', 'Location unavailable, showing Bengaluru. Allow location access for nearby help.', 'bad');
    else setStatus('#map-status', 'Searching for nearby police and hospitals…');
    try {
      const places = await fetchHelp(center);
      for (const p of places) {
        L.circleMarker([p.lat, p.lng], { radius: 7, color: p.kind === 'police' ? '#6d5dfc' : '#22c55e', fillOpacity: 0.9 }).addTo(map).bindPopup(p.name);
      }
      $('#help-list').replaceChildren(...places.slice(0, 8).map((p) => el('li', {},
        el('div', {}, el('strong', {}, `${p.kind === 'police' ? '🚓' : '🏥'} ${p.name}`), el('span', { class: 'muted small' }, `${p.km.toFixed(2)} km away`)),
        p.phone
          ? el('a', { class: 'btn btn-outline btn-sm', href: `tel:${p.phone.split(';')[0]}` }, 'Call')
          : el('a', { class: 'btn btn-outline btn-sm', href: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener' }, 'Directions'),
      )));
      if (pos) setStatus('#map-status', places.length ? `${places.length} places of help within 3 km.` : 'No police or hospitals mapped within 3 km. Call 112.', places.length ? 'ok' : 'bad');
    } catch {
      setStatus('#map-status', 'Could not load nearby places right now. Call 112 in an emergency.', 'bad');
    }
    return map;
  })();
}

// ---------- connectivity + offline ----------
function renderNet() {
  const online = navigator.onLine;
  const pill = $('#net-status');
  pill.textContent = online ? 'Online' : 'Offline';
  pill.classList.toggle('is-offline', !online);
}

// ---------- boot ----------
setupHoldButton();
setupWalk();
setupGuardians();
renderLedger();
renderNet();
route();

window.addEventListener('hashchange', route);
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);
$('#alert-close').addEventListener('click', () => $('#alert-dialog').close());
$('#ledger-verify').addEventListener('click', verify);
$('#ledger-tamper').addEventListener('click', tamperTest);
$('#ledger-export').addEventListener('click', exportLedger);
$('#ledger-anchor').addEventListener('click', anchor);
$('#wallet-btn').addEventListener('click', connectWallet);
window.ethereum?.request({ method: 'eth_accounts' }).then(([a]) => setWallet(a)).catch(() => {});
window.ethereum?.on?.('accountsChanged', ([a]) => setWallet(a));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
