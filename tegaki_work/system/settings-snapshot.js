/**
 * ============================================================================
 * ファイル名: system/settings-snapshot.js
 * 責務: 「環境」(QTP・各ツールpopup・設定などのUI設定)のスナップショットを集め、検証し、書き戻す。PNG(iTXt)への出し入れ
 * 依存: system/png-text-chunk.js
 * 被依存: system/settings-snapshot-store.js, ui/settings-popup.js, build/verify-settings-snapshot.mjs
 * 公開API: SNAPSHOT_KIND, isSnapshotKey, collectSettingsSnapshot, sanitizeSettingsSnapshot, applySettingsSnapshot,
 *   summarizeSnapshot, embedSnapshotInPng, extractSnapshotFromPng, SNAPSHOT_PNG_KEYWORD
 * 保存: Project・Historyの正本ではない。localStorageのUI設定だけを、許可リストの範囲で複製・復元する。
 *   フォントライブラリ(IndexedDB)・アルバム・緊急復旧はスナップショットに含めない。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { embedPngText, extractPngText } from './png-text-chunk.js';

export const SNAPSHOT_KIND = 'tegaki-settings-snapshot';
export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_PNG_KEYWORD = 'tegaki-settings';

const MAX_VALUE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 768 * 1024;
const MAX_KEYS = 80;
const EXACT_KEYS = new Set(['tegaki_settings', 'quick-access-position', 'tegaki_animation_table_ui_v1']);
const KEY_PATTERN = /^(tegaki-|quick-access-)[A-Za-z0-9_.:-]{1,80}$/;
// 取り込まない: アルバム/緊急復旧(大きく、設定ではない)
const EXCLUDED = /^(tegaki_album|tegaki-album|tegaki-emergency|tegaki_emergency)/;

export function isSnapshotKey(key) {
    if (typeof key !== 'string' || EXCLUDED.test(key)) return false;
    return EXACT_KEYS.has(key) || KEY_PATTERN.test(key);
}

const byteLength = (text) => new TextEncoder().encode(text).length;

/** storage: getItem/setItem/key/length を持つStorage。許可リストのキーだけを集める。 */
export function collectSettingsSnapshot(storage, meta = {}) {
    const entries = {};
    let total = 0;
    for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!isSnapshotKey(key)) continue;
        const value = storage.getItem(key);
        if (typeof value !== 'string') continue;
        const bytes = byteLength(value);
        if (bytes > MAX_VALUE_BYTES || total + bytes > MAX_TOTAL_BYTES || Object.keys(entries).length >= MAX_KEYS) continue;
        entries[key] = value;
        total += bytes;
    }
    return {
        kind: SNAPSHOT_KIND,
        v: SNAPSHOT_VERSION,
        name: String(meta.name || '環境').slice(0, 40),
        createdAt: Number.isFinite(meta.createdAt) ? meta.createdAt : Date.now(),
        entries
    };
}

/** 外から来たデータの検証。不正なら null。許可リスト外のキー・大きすぎる値・文字列でない値は捨てる。 */
export function sanitizeSettingsSnapshot(raw) {
    if (!raw || typeof raw !== 'object' || raw.kind !== SNAPSHOT_KIND || raw.v !== SNAPSHOT_VERSION) return null;
    if (!raw.entries || typeof raw.entries !== 'object') return null;
    const entries = {};
    let total = 0;
    for (const [key, value] of Object.entries(raw.entries)) {
        if (!isSnapshotKey(key) || typeof value !== 'string') continue;
        const bytes = byteLength(value);
        if (bytes > MAX_VALUE_BYTES || total + bytes > MAX_TOTAL_BYTES || Object.keys(entries).length >= MAX_KEYS) continue;
        // 値はJSONのものだけ(壊れた値で起動時に例外にならないように)。JSONでない値は捨てる
        try { JSON.parse(value); } catch (error) { continue; }
        entries[key] = value;
        total += bytes;
    }
    if (!Object.keys(entries).length) return null;
    return {
        kind: SNAPSHOT_KIND,
        v: SNAPSHOT_VERSION,
        name: String(raw.name || '環境').slice(0, 40),
        createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
        entries
    };
}

/** スナップショットを書き戻す。既存の許可キーは、スナップショットに無いものを消して「当時のまま」にする。 */
export function applySettingsSnapshot(storage, snapshot) {
    const clean = sanitizeSettingsSnapshot(snapshot);
    if (!clean) return { ok: false, reason: 'invalid' };
    const existing = [];
    for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (isSnapshotKey(key)) existing.push(key);
    }
    existing.forEach((key) => { if (!(key in clean.entries)) storage.removeItem(key); });
    for (const [key, value] of Object.entries(clean.entries)) storage.setItem(key, value);
    return { ok: true, written: Object.keys(clean.entries).length, removed: existing.filter(k => !(k in clean.entries)).length };
}

export function summarizeSnapshot(snapshot) {
    const keys = Object.keys(snapshot?.entries || {});
    const bytes = keys.reduce((n, k) => n + byteLength(snapshot.entries[k]), 0);
    return { keyCount: keys.length, bytes };
}

export function embedSnapshotInPng(pngBytes, snapshot) {
    return embedPngText(pngBytes, SNAPSHOT_PNG_KEYWORD, JSON.stringify(snapshot));
}

export function extractSnapshotFromPng(pngBytes) {
    const text = extractPngText(pngBytes, SNAPSHOT_PNG_KEYWORD);
    if (!text) return null;
    try {
        return sanitizeSettingsSnapshot(JSON.parse(text));
    } catch (error) {
        return null;
    }
}
