const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../app/session.cjs');
const { DEFAULT_SETTINGS } = require('../app/config.cjs');
const { createGroq } = require('../app/groq.cjs');
function setup(overrides = {}) {
  const commands = []; const deliveries = [];
  const session = createSession({
    store: { read: () => ({ ...DEFAULT_SETTINGS }), getKey: () => 'key' },
    groq: { transcribe: async () => 'halo dunia', cleanup: async () => 'Halo dunia.' },
    captureTarget: async () => ({ handle: '123', pid: '999' }),
    deliver: async (text, target) => { deliveries.push({ text, target }); return { pasted: !!target, copied: true }; },
    emit: () => {}, command: value => commands.push(value), ...overrides,
  });
  const record = async () => { await session.start(); const id = commands.at(-1).id; session.recordingStarted(id); return id; };
  return { session, commands, deliveries, record };
}
test('dictation transcribes, cleans, delivers to captured window and finishes', async () => {
  const { session, deliveries, record } = setup();
  const id = await record(); session.stop();
  await session.audio(id, new ArrayBuffer(2), 'audio/webm');
  assert.equal(session.snapshot().phase, 'done');
  assert.equal(session.snapshot().result.raw, 'halo dunia');
  assert.deepEqual(deliveries, [{ text: 'Halo dunia.', target: { handle: '123', pid: '999' } }]);
});

test('mixed Indonesian-English wording survives transcription, cleanup and paste unchanged', async () => {
  const raw = 'kita follow up besok ya terus update settings nya habis meeting';
  const text = 'Kita follow up besok, ya. Terus update settings-nya habis meeting.';
  const groq = createGroq(async (url, options) => {
    if (url.endsWith('/audio/transcriptions')) return Response.json({ text: raw });
    assert.equal(JSON.parse(options.body).messages[1].content, raw);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });
  });
  const { session, deliveries, record } = setup({ groq, store: { read: () => DEFAULT_SETTINGS, getKey: () => 'key' } });
  await session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  assert.equal(session.snapshot().result.raw, raw);
  assert.equal(deliveries[0].text, text);
  assert.equal(session.snapshot().result.pasted, true);
});
test('AI failure still delivers original Whisper transcript', async () => {
  const { session, deliveries, record } = setup({ groq: { transcribe: async () => 'raw words', cleanup: async () => { throw new Error('Qwen unavailable'); } } });
  await session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  assert.equal(deliveries[0].text, 'raw words');
  assert.match(session.snapshot().warning, /Qwen unavailable/);
  assert.equal(session.snapshot().phase, 'done');
});

test('Whisper is recoverable during polishing and survives cancellation', async () => {
  const { session, deliveries, record } = setup({ groq: {
    transcribe: async () => 'hasil Whisper jangan hilang', cleanup: () => new Promise(() => {}),
  } });
  const request = session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  await new Promise(setImmediate);
  assert.equal(session.snapshot().phase, 'cleaning');
  assert.equal(session.snapshot().result.text, 'hasil Whisper jangan hilang');
  session.cancel(); await request;
  assert.equal(session.snapshot().result.text, 'hasil Whisper jangan hilang');
  assert.equal(deliveries.length, 0);
});

test('empty AI output and failed paste never discard the Whisper result', async () => {
  for (const output of ['', '  ', null, undefined]) {
    const { session, record } = setup({
      groq: { transcribe: async () => 'teks Whisper utuh', cleanup: async () => output },
      deliver: async text => { assert.equal(text, 'teks Whisper utuh'); throw new Error('Clipboard unavailable'); },
    });
    await session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
    const state = session.snapshot();
    assert.equal(state.phase, 'done');
    assert.equal(state.result.text, 'teks Whisper utuh');
    assert.equal(state.result.raw, 'teks Whisper utuh');
    assert.equal(state.result.cleaned, false);
    assert.equal(state.result.pasted, false);
    assert.equal(state.result.copied, false);
    assert.ok(state.warning);
  }
});

test('stalled polishing delivers the original transcript after its deadline', async () => {
  const groq = createGroq(async (url, { signal }) => {
    if (url.endsWith('/audio/transcriptions')) return Response.json({ text: 'teks asli tetap aman' });
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }, { timeouts: { cleanup: 25 } });
  const { session, deliveries, record } = setup({ groq });
  const guard = setTimeout(() => {}, 1000);
  try { await session.audio(await record(), new ArrayBuffer(2), 'audio/webm'); }
  finally { clearTimeout(guard); }
  assert.equal(session.snapshot().phase, 'done');
  assert.equal(deliveries[0].text, 'teks asli tetap aman');
  assert.equal(session.snapshot().result.cleaned, false);
  assert.match(session.snapshot().warning, /Perapian teks.*lama merespons/);
});

test('session deadline delivers Whisper at five seconds even if polishing ignores cancellation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishPolishing, polishingSignal;
  const { session, deliveries, record } = setup({ groq: {
    transcribe: async () => 'teks asli Whisper',
    cleanup: (_raw, _key, signal) => { polishingSignal = signal; return new Promise(resolve => { finishPolishing = resolve; }); },
  } });
  const request = session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  await new Promise(setImmediate);
  assert.equal(session.snapshot().phase, 'cleaning');
  t.mock.timers.tick(4999);
  await new Promise(setImmediate);
  assert.equal(deliveries.length, 0);
  t.mock.timers.tick(1);
  await new Promise(setImmediate);
  assert.equal(session.snapshot().phase, 'done');
  await request;
  assert.equal(polishingSignal.aborted, true);
  assert.equal(deliveries[0].text, 'teks asli Whisper');
  assert.equal(session.snapshot().result.cleaned, false);
  finishPolishing('Hasil polishing terlambat.');
  await new Promise(setImmediate);
  assert.equal(deliveries.length, 1, 'late polishing cannot paste a second time');
  assert.equal(session.snapshot().result.text, 'teks asli Whisper');
});

test('cancelling stalled polishing aborts it without delivering the transcript', async () => {
  let polishingSignal;
  const { session, deliveries, record } = setup({ groq: {
    transcribe: async () => 'cancelled words',
    cleanup: (_raw, _key, signal) => { polishingSignal = signal; return new Promise(() => {}); },
  } });
  const request = session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  await new Promise(setImmediate);
  session.cancel();
  await request;
  assert.equal(polishingSignal.aborted, true);
  assert.equal(session.snapshot().phase, 'idle');
  assert.equal(deliveries.length, 0);
});
test('retry keeps audio but never pastes to the stale target', async () => {
  let attempts = 0;
  const { session, record, deliveries } = setup({ groq: { transcribe: async () => { if (!attempts++) throw new Error('offline'); return 'hi'; }, cleanup: async () => 'Hi.' } });
  await session.audio(await record(), new ArrayBuffer(3), 'audio/webm');
  assert.equal(session.snapshot().canRetry, true);
  await session.retry();
  assert.equal(deliveries[0].target, null);
  assert.equal(session.snapshot().canRetry, false);
});
test('cancelled in-flight responses and stale audio never paste', async () => {
  let resolve;
  const { session, record, deliveries } = setup({ groq: { transcribe: () => new Promise(done => { resolve = done; }), cleanup: async text => text } });
  const id = await record();
  const request = session.audio(id, new ArrayBuffer(2), 'audio/webm');
  session.cancel(); resolve('too late'); await request;
  await session.audio(id, new ArrayBuffer(2), 'audio/webm');
  assert.equal(deliveries.length, 0);
  assert.equal(session.snapshot().phase, 'idle');
});
test('cancelling during target capture prevents microphone start', async () => {
  let finish;
  const { session, commands } = setup({ captureTarget: () => new Promise(resolve => { finish = resolve; }) });
  const start = session.start(); session.cancel(); finish(null); await start;
  assert.equal(commands.some(value => value.type === 'start'), false);
});
test('double start and duplicate audio do not launch duplicate requests', async () => {
  const { session, commands, record, deliveries } = setup();
  const id = await record(); await session.start();
  assert.equal(commands.filter(value => value.type === 'start').length, 1);
  await Promise.all([session.audio(id, new ArrayBuffer(2), 'audio/webm'), session.audio(id, new ArrayBuffer(2), 'audio/webm')]);
  assert.equal(deliveries.length, 1);
});
test('clear removes result and failed pending recording', async () => {
  const { session, record } = setup({ groq: { transcribe: async () => { throw new Error('offline'); } } });
  await session.audio(await record(), new ArrayBuffer(1), 'audio/webm');
  session.clear(); await session.retry();
  assert.equal(session.snapshot().canRetry, false);
  assert.equal(session.snapshot().phase, 'idle');
});
test('missing key never activates microphone', async () => {
  const { session, commands } = setup({ store: { getKey: () => { throw new Error('no key'); } } });
  await session.start(); assert.equal(session.snapshot().phase, 'error'); assert.equal(commands.length, 0);
});
