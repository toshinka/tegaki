import assert from 'node:assert/strict';
import { crc32, embedPngText, extractPngText } from '../system/png-text-chunk.js';
import {
    SNAPSHOT_KIND, applySettingsSnapshot, collectSettingsSnapshot, embedSnapshotInPng, extractSnapshotFromPng,
    isSnapshotKey, sanitizeSettingsSnapshot, summarizeSnapshot
} from '../system/settings-snapshot.js';

// ---- 最小の1x1 PNG(正しいCRC)
const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length); const v = new DataView(out.buffer);
    v.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
};
const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, 1); new DataView(ihdr.buffer).setUint32(4, 1); ihdr.set([8, 6, 0, 0, 0], 8);
const idat = new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const png = concat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0)));

// crc32の既知値
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
// 埋め込み: 日本語/改行/絵文字も往復、IENDは最後、元の画素チャンクは変わらない
const text = JSON.stringify({ a: 'ふたば\n☆', b: [1, 2, 3] });
const embedded = embedPngText(png, 'tegaki-settings', text);
assert.equal(extractPngText(embedded, 'tegaki-settings'), text);
assert.equal(extractPngText(embedded, 'other'), null);
assert.equal(extractPngText(png, 'tegaki-settings'), null);
assert.deepEqual([...embedded.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(String.fromCharCode(...embedded.subarray(embedded.length - 8, embedded.length - 4)), 'IEND');
assert.ok(embedded.length > png.length);
// 置き換え: 同じkeywordは1つだけ
const twice = embedPngText(embedded, 'tegaki-settings', '{"x":1}');
assert.equal(extractPngText(twice, 'tegaki-settings'), '{"x":1}');
assert.equal((String.fromCharCode(...twice).match(/tegaki-settings/g) || []).length, 1);
// 壊れた入力
assert.throws(() => embedPngText(new Uint8Array([1, 2, 3]), 'k', 'v'));
assert.equal(extractPngText(new Uint8Array([1, 2, 3]), 'k'), null);

// ---- スナップショット
const store = new Map([
    ['tegaki_settings', '{"pressureCurve":"linear"}'],
    ['quick-access-position', '{"x":10,"y":20}'],
    ['tegaki-tone-v1', '{"params":{}}'],
    ['tegaki-qa-tool-slots-v1', '{"order":{},"last":{}}'],
    ['tegaki_album', '[{"huge":true}]'],           // 除外
    ['tegaki-emergency-recovery', '{}'],            // 除外
    ['unrelated-key', '{"secret":1}']               // 許可リスト外
]);
const storage = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
};
for (const k of ['tegaki_settings', 'quick-access-position', 'tegaki-tone-v1', 'tegaki_animation_table_ui_v1', 'tegaki-qa-tool-slots-v1']) assert.equal(isSnapshotKey(k), true, k);
for (const k of ['tegaki_album', 'tegaki-album-x', 'tegaki-emergency-recovery', 'unrelated-key', '', null, 'tegaki-' + 'x'.repeat(200)]) assert.equal(isSnapshotKey(k), false, String(k));

const snap = collectSettingsSnapshot(storage, { name: '制作用', createdAt: 1700000000000 });
assert.equal(snap.kind, SNAPSHOT_KIND);
assert.deepEqual(Object.keys(snap.entries).sort(), ['quick-access-position', 'tegaki-qa-tool-slots-v1', 'tegaki-tone-v1', 'tegaki_settings']);
assert.equal(summarizeSnapshot(snap).keyCount, 4);

// PNG往復
const card = embedSnapshotInPng(png, snap);
assert.deepEqual(extractSnapshotFromPng(card), snap);
assert.equal(extractSnapshotFromPng(png), null);

// 検証: 許可リスト外/非JSON/文字列でない値は捨てる。全部捨てたらnull
const dirty = { ...snap, entries: { ...snap.entries, 'unrelated-key': '{}', 'tegaki-bad': 'not json', 'tegaki-num': 5 } };
assert.deepEqual(Object.keys(sanitizeSettingsSnapshot(dirty).entries).sort(), Object.keys(snap.entries).sort());
assert.equal(sanitizeSettingsSnapshot({ ...snap, entries: { 'unrelated-key': '{}' } }), null);
assert.equal(sanitizeSettingsSnapshot({ ...snap, v: 99 }), null);
assert.equal(sanitizeSettingsSnapshot(null), null);
assert.equal(sanitizeSettingsSnapshot({ ...snap, entries: { 'tegaki-big': JSON.stringify('x'.repeat(300 * 1024)) } }), null, 'oversized value dropped');

// 復元: 当時のまま(スナップショットに無い許可キーは消え、許可外は触らない)
store.set('tegaki-focus-lines-v1', '{"params":{}}');
store.set('quick-access-position', '{"x":999,"y":999}');
const result = applySettingsSnapshot(storage, snap);
assert.equal(result.ok, true);
assert.equal(store.get('quick-access-position'), '{"x":10,"y":20}');
assert.equal(store.has('tegaki-focus-lines-v1'), false, 'keys absent from the snapshot are removed');
assert.equal(store.get('tegaki_album'), '[{"huge":true}]', 'album untouched');
assert.equal(store.get('unrelated-key'), '{"secret":1}', 'unrelated keys untouched');
assert.deepEqual(applySettingsSnapshot(storage, { kind: 'x' }), { ok: false, reason: 'invalid' });
console.log('settings snapshot verifier: png iTXt roundtrip / allowlist collect / sanitize / restore-as-was / png embed ok');
