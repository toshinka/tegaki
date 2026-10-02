/**
 * ============================================================================
 * ファイル名: system/settings-snapshot-store.js
 * 責務: 環境スナップショットのIndexedDB保存（アルバム本体とは別DB。アルバムの契約には触れない）
 * 依存: system/settings-snapshot.js
 * 被依存: ui/settings-popup.js
 * 公開API: SettingsSnapshotStore
 * 実装状態: ✅実装
 * ============================================================================
 */

import { sanitizeSettingsSnapshot } from './settings-snapshot.js';

const DB_NAME = 'TegakiSettingsSnapshots';
const STORE = 'snapshots';
export const MAX_SNAPSHOTS = 30;

export class SettingsSnapshotStore {
    constructor() {
        this.db = null;
    }

    async init() {
        if (this.db) return;
        this.db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('settings snapshot store init failed'));
        });
    }

    async list() {
        await this.init();
        const all = await new Promise((resolve, reject) => {
            const req = this.db.transaction(STORE).objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
        return all
            .map(item => ({ id: item.id, snapshot: sanitizeSettingsSnapshot(item.snapshot) }))
            .filter(item => item.snapshot)
            .sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt);
    }

    /** 保存。上限を超えたら古いものから捨てる。 */
    async add(snapshot) {
        const clean = sanitizeSettingsSnapshot(snapshot);
        if (!clean) throw new Error('invalid snapshot');
        await this.init();
        const id = `env-${clean.createdAt.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ id, createdAt: clean.createdAt, snapshot: clean });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        const all = await this.list();
        for (const old of all.slice(MAX_SNAPSHOTS)) await this.remove(old.id);
        return id;
    }

    async remove(id) {
        await this.init();
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }
}
