import { test } from 'node:test';
import * as assert from 'node:assert';

test('makeAudioCacheKey is deterministic for same input', async () => {
  const { makeAudioCacheKey } = await import('../audioCache');
  const a = makeAudioCacheKey('kokoro-local', 'af_heart', 1.0, 'Hallo Welt.');
  const b = makeAudioCacheKey('kokoro-local', 'af_heart', 1.0, 'Hallo Welt.');
  assert.strictEqual(a, b, 'same inputs produce same key');
});

test('makeAudioCacheKey differs when engine differs', async () => {
  const { makeAudioCacheKey } = await import('../audioCache');
  const a = makeAudioCacheKey('kokoro-local', 'af_heart', 1, 'x');
  const b = makeAudioCacheKey('web-speech',   'af_heart', 1, 'x');
  assert.notStrictEqual(a, b);
});

test('makeAudioCacheKey differs when voice differs', async () => {
  const { makeAudioCacheKey } = await import('../audioCache');
  const a = makeAudioCacheKey('kokoro-local', 'af_heart',  1, 'x');
  const b = makeAudioCacheKey('kokoro-local', 'bm_daniel', 1, 'x');
  assert.notStrictEqual(a, b);
});

test('makeAudioCacheKey differs when text differs', async () => {
  const { makeAudioCacheKey } = await import('../audioCache');
  const a = makeAudioCacheKey('kokoro-local', 'af_heart', 1, 'Apfel.');
  const b = makeAudioCacheKey('kokoro-local', 'af_heart', 1, 'Birne.');
  assert.notStrictEqual(a, b);
});

test('makeAudioCacheKey buckets speed to 0.25 steps (1.0 and 1.1 share a key)', async () => {
  const { makeAudioCacheKey } = await import('../audioCache');
  const a = makeAudioCacheKey('kokoro-local', 'af_heart', 1.0,  'x');
  const b = makeAudioCacheKey('kokoro-local', 'af_heart', 1.05, 'x');
  const c = makeAudioCacheKey('kokoro-local', 'af_heart', 1.25, 'x');
  assert.strictEqual(a, b, '1.0 and 1.05 share a speed bucket');
  assert.notStrictEqual(a, c, '1.25 is a different bucket');
});

test('getCachedAudio returns null for missing key (graceful no-op when IDB unavailable)', async () => {
  const { getCachedAudio } = await import('../audioCache');
  const result = await getCachedAudio('does-not-exist-key-xyz');
  assert.strictEqual(result, null, 'no entry → null, no throw');
});

test('setCachedAudio does not throw when IndexedDB is unavailable', async () => {
  const { setCachedAudio } = await import('../audioCache');
  // Node hat kein indexedDB → openDB wirft; setCachedAudio fängt das ab
  await setCachedAudio('test-key', new Blob(['x']));
  // kein assert.strictEqual(true, true) nötig — wenn wir hier ankommen, ist
  // "no throw" erfüllt.
});
