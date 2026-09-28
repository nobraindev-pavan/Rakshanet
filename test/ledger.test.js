import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENESIS_HASH, canonicalize, createEntry, sha256Hex, verifyChain } from '../lib/ledger.js';

async function buildChain(n) {
  const chain = [];
  for (let i = 0; i < n; i++) {
    chain.push(await createEntry(chain, 'SOS', { lat: 12.97 + i, lng: 77.59, note: `n${i}` }, `2026-09-26T10:0${i}:00.000Z`));
  }
  return chain;
}

test('sha256Hex matches a known vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('canonicalize is independent of key order', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }), canonicalize({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }));
});

test('first entry links to genesis, later entries link to their predecessor', async () => {
  const chain = await buildChain(3);
  assert.equal(chain[0].prevHash, GENESIS_HASH);
  assert.equal(chain[1].prevHash, chain[0].hash);
  assert.equal(chain[2].prevHash, chain[1].hash);
});

test('an untouched chain verifies', async () => {
  const chain = await buildChain(4);
  assert.deepEqual(await verifyChain(chain), { ok: true, length: 4, head: chain[3].hash });
  assert.deepEqual(await verifyChain([]), { ok: true, length: 0, head: GENESIS_HASH });
});

test('editing a payload is detected at that entry', async () => {
  const chain = await buildChain(4);
  chain[2] = { ...chain[2], payload: { ...chain[2].payload, note: 'edited' } };
  const result = await verifyChain(chain);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
});

test('deleting an entry is detected', async () => {
  const chain = await buildChain(4);
  chain.splice(1, 1);
  assert.equal((await verifyChain(chain)).brokenAt, 1);
});

test('re-hashing a forged entry still breaks the next link', async () => {
  const chain = await buildChain(3);
  const forged = { ...chain[1], payload: { lat: 0, lng: 0 } };
  forged.hash = (await createEntry(chain.slice(0, 1), forged.type, forged.payload, forged.timestamp)).hash;
  chain[1] = forged;
  const result = await verifyChain(chain);
  assert.equal(result.brokenAt, 2);
  assert.equal(result.reason, 'link to previous entry broken');
});
