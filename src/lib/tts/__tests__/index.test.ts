import { test } from 'node:test';
import * as assert from 'node:assert';

// Mock minimal Web Speech, damit listEngines() im Node-Testlauf funktioniert.
let listeners: Array<() => void> = [];
(globalThis as unknown as { window: unknown }).window = {
  speechSynthesis: {
    getVoices: () => [
      { name: 'TestDeutsch', lang: 'de-DE' },
      { name: 'TestEnglish', lang: 'en-US' },
    ],
    cancel: () => {},
    speak: () => {},
    pause: () => {},
    resume: () => {},
    addEventListener: (_t: string, l: () => void) => listeners.push(l),
    removeEventListener: () => {},
  },
};

test('listEngines() returns exactly the three registered engines, in order', async () => {
  const { listEngines } = await import('../index');
  const engines = listEngines();
  assert.strictEqual(engines.length, 3);
  assert.strictEqual(engines[0].info.id, 'web-speech',  'web-speech first (default)');
  assert.strictEqual(engines[1].info.id, 'piper-local',  'piper second (German priority)');
  assert.strictEqual(engines[2].info.id, 'kokoro-local', 'kokoro third');
});

test('each engine exposes EngineInfo with required fields', async () => {
  const { listEngines } = await import('../index');
  for (const e of listEngines()) {
    assert.ok(typeof e.info.id === 'string');
    assert.ok(typeof e.info.name === 'string' && e.info.name.length > 0);
    assert.ok(typeof e.info.description === 'string' && e.info.description.length > 0);
    assert.ok(typeof e.info.requiresDownload === 'boolean');
    assert.ok(typeof e.info.requiresNetwork === 'boolean');
    assert.ok(['webgpu-preferred', 'wasm-ok', 'system-tts'].includes(e.info.deviceHint));
  }
});

test('Kokoro engine advertises model download + network requirement', async () => {
  const { listEngines } = await import('../index');
  const kokoro = listEngines().find(e => e.info.id === 'kokoro-local')!;
  assert.strictEqual(kokoro.info.requiresDownload, true, 'Kokoro requires download');
  assert.strictEqual(kokoro.info.requiresNetwork, true, 'Kokoro model is fetched from HF Hub on first use');
  assert.ok(kokoro.info.modelSizeMB && kokoro.info.modelSizeMB > 0, 'model size declared');
});

test('Web Speech engine is ready without any download', async () => {
  const { listEngines } = await import('../index');
  const web = listEngines().find(e => e.info.id === 'web-speech')!;
  assert.strictEqual(web.info.requiresDownload, false);
  assert.strictEqual(web.info.requiresNetwork, false);
  await web.init();
  assert.strictEqual(web.isReady(), true);
});

test('getEngine() is idempotent — same instance returned for repeated calls', async () => {
  const { getEngine, disposeEngine } = await import('../index');
  const a = getEngine('web-speech');
  const b = getEngine('web-speech');
  assert.strictEqual(a, b, 'instance must be reused');
  disposeEngine('web-speech');
  const c = getEngine('web-speech');
  assert.notStrictEqual(a, c, 'after dispose, a new instance is created');
});

test('onEngineStatus delivers notifications to all subscribers', async () => {
  const { getEngine, onEngineStatus, notifyStatus } = await import('../index');
  const engine = getEngine('web-speech');
  const received: string[] = [];
  const unsub = onEngineStatus((id, status) => {
    if (id === engine.info.id) received.push(status.state);
  });
  notifyStatus(engine.info.id, { state: 'ready' });
  notifyStatus(engine.info.id, { state: 'idle' });
  unsub();
  notifyStatus(engine.info.id, { state: 'ready' }); // not received (unsub'd)
  assert.deepStrictEqual(received, ['ready', 'idle']);
});
