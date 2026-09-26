// Tamper-evident, hash-linked incident ledger.
// Every entry commits to the previous entry's hash, so editing, deleting or
// reordering any record breaks verification from that point on.
// Pure ES module: runs in the browser and in Node >= 20 (WebCrypto).

export const GENESIS_HASH = '0'.repeat(64);

const encoder = new TextEncoder();

export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic JSON: object keys sorted recursively, so the same data always
// hashes to the same value regardless of property insertion order.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

function hashInput({ index, timestamp, type, payload, prevHash }) {
  return canonicalize({ index, timestamp, type, payload, prevHash });
}

export async function createEntry(chain, type, payload = {}, timestamp = new Date().toISOString()) {
  const prev = chain[chain.length - 1];
  const body = {
    index: chain.length,
    timestamp,
    type,
    payload,
    prevHash: prev ? prev.hash : GENESIS_HASH,
  };
  return { ...body, hash: await sha256Hex(hashInput(body)) };
}

export async function verifyChain(chain) {
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1].hash;
    if (entry.index !== i) return { ok: false, brokenAt: i, reason: 'index out of sequence' };
    if (entry.prevHash !== expectedPrev) return { ok: false, brokenAt: i, reason: 'link to previous entry broken' };
    if ((await sha256Hex(hashInput(entry))) !== entry.hash) {
      return { ok: false, brokenAt: i, reason: 'contents modified after recording' };
    }
  }
  return { ok: true, length: chain.length, head: chain.length ? chain[chain.length - 1].hash : GENESIS_HASH };
}
