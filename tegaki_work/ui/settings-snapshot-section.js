/**
 * ============================================================================
 * ファイル名: ui/settings-snapshot-section.js
 * 責務: 設定popupの「環境スナップショット」欄。今の環境の保存 / 一覧 / 復元 / PNGで書き出し / PNGから読み込み
 * 依存: system/settings-snapshot.js, system/settings-snapshot-store.js, ui/feedback-toast.js
 * 被依存: ui/settings-popup.js
 * 公開API: mountSettingsSnapshotSection
 * 保存: スナップショットは別DB(TegakiSettingsSnapshots)。復元はlocalStorageのUI設定だけを書き戻して再読み込みする。
 * 実装状態: ✅実装
 * ============================================================================
 */

import {
    applySettingsSnapshot, collectSettingsSnapshot, embedSnapshotInPng, extractSnapshotFromPng,
    sanitizeSettingsSnapshot, summarizeSnapshot
} from '../system/settings-snapshot.js';
import { SettingsSnapshotStore } from '../system/settings-snapshot-store.js';
import { showFeedbackToast } from './feedback-toast.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const formatTime = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** カード画像(Futaba配色)。設定本体はこの画像のPNGチャンクに埋め込む。 */
export function renderCardCanvas(snapshot) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#800000';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = '#800000';
    ctx.font = '700 30px sans-serif';
    ctx.fillText('TEGAKI 環境', 28, 66);
    ctx.fillStyle = '#f0e0d6';
    ctx.fillRect(28, 86, canvas.width - 56, 3);
    ctx.fillStyle = '#800000';
    ctx.font = '700 26px sans-serif';
    ctx.fillText(snapshot.name, 28, 138, canvas.width - 56);
    const summary = summarizeSnapshot(snapshot);
    ctx.fillStyle = '#9c3835';
    ctx.font = '16px sans-serif';
    ctx.fillText(formatTime(snapshot.createdAt), 28, 176);
    ctx.fillText(`設定 ${summary.keyCount} 項目 / ${(summary.bytes / 1024).toFixed(1)} KB`, 28, 204);
    ctx.fillStyle = '#b8706b';
    ctx.font = '13px sans-serif';
    ctx.fillText('このPNGには環境の設定が埋め込まれています。設定 > 環境スナップショット > PNGから読み込み', 28, 248, canvas.width - 56);
    return canvas;
}

function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) return reject(new Error('png-failed'));
            resolve(new Uint8Array(await blob.arrayBuffer()));
        }, 'image/png');
    });
}

/**
 * 設定popupとアルバムのタイルで共有する操作(保存 / 復元 / PNG書き出し / 削除)。
 * @returns {{ store, storage, saveCurrent, restore, exportPng, remove, importFile }}
 */
export function createSnapshotActions({ store = new SettingsSnapshotStore(), storage = window.localStorage } = {}) {
    const current = (name) => collectSettingsSnapshot(storage, { name, createdAt: Date.now() });
    return {
        store,
        storage,
        async saveCurrent(name) {
            const finalName = (name || '').trim() || `環境 ${formatTime(Date.now())}`;
            await store.add(current(finalName));
            showFeedbackToast(`環境「${finalName}」を保存しました`);
            return finalName;
        },
        async restore(item) {
            if (!window.confirm(`「${item.snapshot.name}」の環境に戻します。\n今の環境は「復元前（自動）」として保存され、復元後にページを再読み込みします。`)) return false;
            try {
                await store.add(current('復元前（自動）'));
                const result = applySettingsSnapshot(storage, item.snapshot);
                if (!result.ok) throw new Error(result.reason);
                showFeedbackToast('環境を復元しました。再読み込みします');
                setTimeout(() => window.location.reload(), 600);
                return true;
            } catch (error) {
                showFeedbackToast('環境を復元できませんでした');
                return false;
            }
        },
        async exportPng(snapshot) {
            try {
                const bytes = embedSnapshotInPng(await canvasToPngBytes(renderCardCanvas(snapshot)), snapshot);
                const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `tegaki-env_${snapshot.name.replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_')}_${snapshot.createdAt}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            } catch (error) {
                showFeedbackToast('PNGを書き出せませんでした');
            }
        },
        async remove(item) {
            if (!window.confirm(`「${item.snapshot.name}」を削除しますか？`)) return false;
            await store.remove(item.id);
            return true;
        },
        async importFile(file) {
            let snapshot = null;
            if (file.type === 'application/json' || /\.json$/i.test(file.name)) {
                snapshot = sanitizeSettingsSnapshot(JSON.parse(await file.text()));
            } else {
                snapshot = extractSnapshotFromPng(new Uint8Array(await file.arrayBuffer()));
            }
            if (!snapshot) {
                showFeedbackToast('環境の情報が見つかりませんでした');
                return false;
            }
            snapshot.name = `${snapshot.name}（読込）`.slice(0, 40);
            await store.add({ ...snapshot, createdAt: Date.now() });
            showFeedbackToast('読み込みました。復元はアルバム/設定の一覧から');
            return true;
        }
    };
}

export function mountSettingsSnapshotSection(container, options = {}) {
    if (!container) return null;
    const api = options.actions || createSnapshotActions({ store: options.store, storage: options.storage });
    const store = api.store;
    container.innerHTML = `
        <div class="setting-label">環境スナップショット</div>
        <div class="setting-description">QTP・各ツールの設定を名前を付けて保存し、あとで当時のまま復元します。作品・アルバム・取り込みフォントは含みません。PNGに埋め込んで持ち運べます（アルバムにも環境タイルが並びます）。</div>
        <div class="env-row">
            <input type="text" class="env-name" maxlength="40" placeholder="名前（例: 下書き用）" aria-label="スナップショット名">
            <button type="button" class="pressure-curve-btn" data-env-action="save">今の環境を保存</button>
        </div>
        <div class="env-list" role="list"></div>
        <div class="env-row">
            <button type="button" class="pressure-curve-btn" data-env-action="import">PNG / JSONから読み込み</button>
            <input type="file" class="env-file" accept="image/png,application/json,.json" hidden>
        </div>`;
    const list = container.querySelector('.env-list');
    const nameInput = container.querySelector('.env-name');
    const fileInput = container.querySelector('.env-file');
    // 入力欄のキーがキャンバスのショートカットへ漏れない
    nameInput.addEventListener('keydown', e => e.stopPropagation());
    nameInput.addEventListener('keyup', e => e.stopPropagation());

    const render = async () => {
        let items = [];
        try { items = await store.list(); } catch (error) { items = []; }
        list.innerHTML = items.length ? '' : '<div class="setting-description">保存された環境はまだありません。</div>';
        for (const item of items) {
            const s = summarizeSnapshot(item.snapshot);
            const row = document.createElement('div');
            row.className = 'env-item';
            row.setAttribute('role', 'listitem');
            row.innerHTML = `
                <div class="env-item-main"><span class="env-item-name">${esc(item.snapshot.name)}</span>
                    <span class="env-item-meta">${esc(formatTime(item.snapshot.createdAt))} · ${s.keyCount}項目</span></div>
                <div class="env-item-actions">
                    <button type="button" class="pressure-curve-btn" data-act="restore">復元</button>
                    <button type="button" class="pressure-curve-btn" data-act="png">PNG</button>
                    <button type="button" class="pressure-curve-btn" data-act="delete">削除</button>
                </div>`;
            row.querySelector('[data-act="restore"]').addEventListener('click', () => api.restore(item));
            row.querySelector('[data-act="png"]').addEventListener('click', () => api.exportPng(item.snapshot));
            row.querySelector('[data-act="delete"]').addEventListener('click', async () => { if (await api.remove(item)) render(); });
            list.appendChild(row);
        }
    };

    container.querySelector('[data-env-action="save"]').addEventListener('click', async () => {
        try {
            await api.saveCurrent(nameInput.value);
            nameInput.value = '';
            render();
        } catch (error) {
            showFeedbackToast('環境を保存できませんでした');
        }
    });
    container.querySelector('[data-env-action="import"]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            if (await api.importFile(file)) render();
        } catch (error) {
            showFeedbackToast('読み込めませんでした');
        }
    });

    render();
    return { refresh: render, store };
}
