/** WP-029: external frame identity, duplicate/stale receipts, and Canvas authority. */
import assert from 'node:assert/strict';
globalThis.window = {};
const { RIVE_EDITOR_ORIGIN, acceptsRiveEditorMessage, validateRiveFrameReceipt, riveRasterContextReason, ensureRiveEditorConnection } = await import('../ui/rive-editor-entry.js');
const source = {};
const message = { source, origin: RIVE_EDITOR_ORIGIN, data: { type: 'tegaki:rive-editor:frame', version: 1, sessionId: 'session' } };
assert.equal(acceptsRiveEditorMessage(message, source, 'session'), true);
for (const rejected of [{ ...message, origin: 'http://localhost:18729' }, { ...message, source: {} },
    { ...message, data: { ...message.data, sessionId: 'other' } }, { ...message, data: { ...message.data, version: 2 } }]) {
    assert.equal(acceptsRiveEditorMessage(rejected, source, 'session'), false);
}
const png = new ArrayBuffer(33);
new Uint8Array(png).set([137, 80, 78, 71, 13, 10, 26, 10]);
new Uint8Array(png).set([73, 72, 68, 82], 12);
new DataView(png).setUint32(16, 32); new DataView(png).setUint32(20, 16);
const pending = { requestId: 'one', buildId: 'build', documentId: 'doc', progress: 0.5 };
const state = { status: 'ready', buildId: 'build', documentId: 'doc', progress: 0.5 };
const frame = { ...pending, png, width: 32, height: 16 };
assert.equal(validateRiveFrameReceipt(frame, pending, state), '');
assert.equal(validateRiveFrameReceipt(frame, { ...pending, consumed: true }, state), 'unexpected-request');
assert.equal(validateRiveFrameReceipt(frame, pending, { ...state, progress: 1 }), 'stale-frame');
assert.equal(validateRiveFrameReceipt(frame, pending, { ...state, buildId: 'next' }), 'stale-frame');
for (const status of ['loading', 'building', 'error']) {
    assert.equal(validateRiveFrameReceipt(frame, pending, { ...state, status }), 'stale-frame');
}
assert.equal(validateRiveFrameReceipt({ ...frame, width: 64 }, pending, state), 'png-size-mismatch');
assert.equal(validateRiveFrameReceipt({ ...frame, png: new ArrayBuffer(8 * 1024 * 1024 + 1) }, pending, state), 'invalid-png-envelope');
const container = {}, history = { record() {}, isApplying: false };
const layers = [{ layerData: { id: 'original' } }];
const layerSystem = { currentFrameContainer: container, config: { canvas: { width: 400, height: 300 } },
    createRasterLayerFromSnapshot() {}, getActiveLayer: () => layers[0], getLayers: () => layers,
    getLayerMoveCommitState: () => ({ active: false }) };
const context = { frame: container, width: 400, height: 300 };
assert.equal(riveRasterContextReason(layerSystem, history, context), '');
assert.ok(riveRasterContextReason(layerSystem, { ...history, isApplying: true }, context));
assert.ok(riveRasterContextReason(layerSystem, history, context, { drawing: true }));
assert.ok(riveRasterContextReason(layerSystem, history, context, { selectionTransform: true }));
assert.ok(riveRasterContextReason({ ...layerSystem, currentFrameContainer: {} }, history, context));
assert.ok(riveRasterContextReason({ ...layerSystem, config: { canvas: { width: 300, height: 400 } } }, history, context));
layers.push({ layerData: { isAnimationWorkingLayer: true } });
assert.ok(riveRasterContextReason(layerSystem, history, context));
const connectionSchema = 'tegaki.rive-editor.connection.v1';
const calls = [];
const connection = await ensureRiveEditorConnection({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.endsWith('/status')
        ? { schema: connectionSchema, phase: 'idle', nonce: 'dev-startup-token' }
        : { schema: connectionSchema, phase: 'ready', editorOrigin: RIVE_EDITOR_ORIGIN });
} });
assert.equal(connection.editorOrigin, RIVE_EDITOR_ORIGIN);
assert.deepEqual(Object.keys(connection).sort(), ['editorOrigin', 'phase', 'reason']); // No bootstrap credential in AI state.
assert.equal(calls.length, 2);
assert.equal(calls[1].options.method, 'POST');
assert.equal(calls[1].options.headers['x-tegaki-rive-nonce'], 'dev-startup-token');
assert.ok(calls.every(call => call.url.startsWith('/__tegaki/rive-editor/')));
for (const value of [null, { schema: connectionSchema, phase: 'idle' }, { schema: connectionSchema, phase: 'error', reason: 'missing-sdk' }]) {
    let count = 0;
    await assert.rejects(ensureRiveEditorConnection({ fetchImpl: async () => { count += 1; return Response.json(value); } }));
    assert.equal(count, 1); // Refusal must not fall through into a startup request.
}
await assert.rejects(ensureRiveEditorConnection({ fetchImpl: async url => Response.json(url.endsWith('/status')
    ? { schema: connectionSchema, phase: 'idle', nonce: 'token' }
    : { schema: connectionSchema, phase: 'ready', editorOrigin: 'http://localhost:18729' }) }), /editor-identity-mismatch/);
await assert.rejects(ensureRiveEditorConnection({ fetchImpl: async () => new Response('<html>preview</html>') }), /bridge-unavailable/);
console.log('Rive host: receipt/Canvas/History guards and lazy bootstrap identity/credential boundaries PASS');
