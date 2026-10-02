/**
 * ============================================================================
 * ファイル名: ui/album-env-tiles.js
 * 責務: アルバムのギャラリーに「環境」タイルを並べる（今の環境を保存するタイル + 保存済みの環境カード）
 * 依存: ui/settings-snapshot-section.js(createSnapshotActions, renderCardCanvas), system/settings-snapshot.js
 * 被依存: ui/album-popup.js
 * 公開API: appendAlbumEnvTiles
 * 保存: 環境は別DB(TegakiSettingsSnapshots)。アルバム本体(作品)の保存・並び替え・選択には関与しない。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { createSnapshotActions, renderCardCanvas } from './settings-snapshot-section.js';
import { summarizeSnapshot } from '../system/settings-snapshot.js';

let sharedActions = null;
function actions() {
    if (!sharedActions) sharedActions = createSnapshotActions();
    return sharedActions;
}

/**
 * @param {HTMLElement} gallery #albumGallery（grid）
 * @param {{ isStale?: () => boolean, onChanged?: () => void }} options
 */
export async function appendAlbumEnvTiles(gallery, options = {}) {
    const { isStale = () => false, onChanged = () => {} } = options;
    const api = actions();
    let items = [];
    try { items = await api.store.list(); } catch (error) { items = []; }
    if (isStale()) return;

    const heading = document.createElement('div');
    heading.className = 'album-env-heading';
    heading.textContent = '環境（QTP・ツール・設定）';
    gallery.appendChild(heading);

    // 今の環境を保存するタイル
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'album-card album-card--env album-card--env-add';
    add.innerHTML = '<div class="thumbnail-container"><span class="album-env-plus">＋</span></div><div class="album-env-caption">今の環境を保存</div>';
    add.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = window.prompt('環境の名前', '');
        if (name === null) return;
        await api.saveCurrent(name);
        onChanged();
    });
    gallery.appendChild(add);

    for (const item of items) {
        const card = document.createElement('div');
        card.className = 'album-card album-card--env';
        card.dataset.envId = item.id;
        const summary = summarizeSnapshot(item.snapshot);
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-container';
        const img = document.createElement('img');
        img.alt = item.snapshot.name;
        img.src = renderCardCanvas(item.snapshot).toDataURL('image/png');
        thumb.appendChild(img);
        const badge = document.createElement('div');
        badge.className = 'album-reference-badge album-env-badge';
        badge.textContent = 'ENV';
        badge.title = `環境 ${summary.keyCount}項目`;
        thumb.appendChild(badge);
        card.appendChild(thumb);

        const bar = document.createElement('div');
        bar.className = 'album-env-actions';
        const mk = (label, title, handler) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.title = title;
            b.addEventListener('click', async (e) => { e.stopPropagation(); await handler(); });
            bar.appendChild(b);
        };
        mk('復元', 'この環境に戻す（今の環境は自動で保存）', () => api.restore(item));
        mk('PNG', '設定を埋め込んだPNGとして保存', () => api.exportPng(item.snapshot));
        mk('削除', '削除', async () => { if (await api.remove(item)) onChanged(); });
        card.appendChild(bar);
        gallery.appendChild(card);
    }
}
