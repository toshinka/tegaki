/**
 * ============================================================================
 * ファイル名: system/font-library.js
 * 責務: 吹き出し/文字用のフォント管理。端末にあるフォント(使えるものだけ)の一覧と、取り込んだフォントファイル
 *       (.ttf/.otf/.woff/.woff2)をIndexedDBへ保存し、フォルダ(分類)で管理する。
 * 依存: IndexedDB / FontFace（なければ取り込み機能だけ無効）
 * 被依存: system/lettering-raster.js, ui/balloon-popup.js
 * 公開API: FontLibrary, fontLibrary, COMMON_JP_FONT_FAMILIES, isFontAvailable, fontFamilyCss, buildFontFaceCss,
 *   sanitizeFontLabel, FONT_FILE_ACCEPT
 * 保存: 取り込んだフォント実体とフォルダはブラウザ内ローカル(IndexedDB)。Project/History/書き出しへは関与しない。
 *   Layerに残るのは確定した画素と、再編集用のフォント参照(family名 or 取り込みフォントid)だけ。
 * ライセンス: フォントファイルはユーザー自身が取り込む。アプリはフォントを同梱・配布しない。
 * 実装状態: ✅実装
 * ============================================================================
 */

export const FONT_FILE_ACCEPT = '.ttf,.otf,.woff,.woff2,.ttc';
const FONT_MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', ttc: 'font/collection' };
const FONT_FORMAT = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2', ttc: 'truetype' };

/** 端末にあれば使える日本語向けの代表的なfamily。実在判定は isFontAvailable で行う。 */
export const COMMON_JP_FONT_FAMILIES = Object.freeze([
    '游ゴシック', 'Yu Gothic', '游明朝', 'Yu Mincho', 'メイリオ', 'Meiryo', 'MS ゴシック', 'MS Pゴシック', 'MS 明朝', 'MS P明朝',
    'BIZ UDゴシック', 'BIZ UDPゴシック', 'BIZ UD明朝', 'BIZ UDP明朝', 'UD デジタル 教科書体 NK-R', 'HGP創英角ポップ体', 'HGS創英角ポップ体',
    'HG丸ゴシックM-PRO', 'HGP教科書体', 'HG正楷書体-PRO', 'ARプペン', 'Noto Sans JP', 'Noto Serif JP', 'IPAexゴシック', 'IPAex明朝',
    'IPAGothic', 'IPAMincho', 'VL Gothic', 'Takao', 'ヒラギノ角ゴ ProN', 'ヒラギノ明朝 ProN', 'ヒラギノ丸ゴ ProN', 'Osaka', 'Kozuka Gothic Pr6N'
]);

export function sanitizeFontLabel(name) {
    const text = String(name ?? '').replace(/\.(ttf|otf|woff2?|ttc)$/i, '').replace(/[\u0000-\u001f<>"'`\\]/g, '').trim();
    return text.slice(0, 60) || 'フォント';
}

/** CSSのfont-familyへ入れる値(引用符つき)。 */
export function fontFamilyCss(family) {
    return `'${String(family).replace(/['\\]/g, '')}'`;
}

let availabilityCanvas = null;
const availabilityCache = new Map();

/** familyが端末で解決されるか。2種のfallbackと幅が全て同じなら未インストールとみなす。 */
export function isFontAvailable(family) {
    if (availabilityCache.has(family)) return availabilityCache.get(family);
    let available = false;
    try {
        availabilityCanvas ||= document.createElement('canvas');
        const ctx = availabilityCanvas.getContext('2d');
        const sample = 'あいうABCWmi漢字1234';
        const measure = (font) => { ctx.font = `32px ${font}`; return ctx.measureText(sample).width; };
        const serif = measure('serif');
        const mono = measure('monospace');
        const target = fontFamilyCss(family);
        available = measure(`${target}, serif`) !== serif || measure(`${target}, monospace`) !== mono;
    } catch (error) {
        available = false;
    }
    availabilityCache.set(family, available);
    return available;
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
}

/** SVG(画像)内へ埋め込む@font-face。SVGを画像として描く時は文書のFontFaceが見えないため必要。 */
export function buildFontFaceCss(family, base64, ext = 'ttf') {
    const e = FONT_FORMAT[ext] ? ext : 'ttf';
    return `@font-face{font-family:${fontFamilyCss(family)};src:url(data:${FONT_MIME[e]};base64,${base64}) format('${FONT_FORMAT[e]}');}`;
}

function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : 'ttf';
}

function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export class FontLibrary {
    constructor(options = {}) {
        this.dbName = options.dbName || 'TegakiFontLibrary';
        this.version = 1;
        this.db = null;
        this._initPromise = null;
        this.available = true;
        this._loaded = new Map();   // fontId → { family, ext, base64 }
        this._listeners = new Set();
    }

    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit() {
        this._listeners.forEach(fn => { try { fn(); } catch (error) { /* listenerの失敗で保存を止めない */ } });
    }

    async init() {
        if (this.db) return true;
        if (this._initPromise) return this._initPromise;
        this._initPromise = new Promise((resolve) => {
            const idb = globalThis.indexedDB;
            if (!idb) { this.available = false; resolve(false); return; }
            const req = idb.open(this.dbName, this.version);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
            };
            req.onsuccess = () => { this.db = req.result; resolve(true); };
            req.onerror = () => { this.available = false; resolve(false); };
            req.onblocked = () => { this.available = false; resolve(false); };
        });
        return this._initPromise;
    }

    async _tx(store, mode, fn) {
        if (!(await this.init())) throw new Error('フォント保存領域を利用できません');
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(store, mode);
            const os = tx.objectStore(store);
            let result;
            try { result = fn(os); } catch (error) { reject(error); return; }
            tx.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }

    // ---------------------------------------------------------------- フォルダ

    async listFolders() {
        const rows = await this._tx('folders', 'readonly', os => os.getAll());
        return (rows || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
    }

    async createFolder(name) {
        const folder = { id: newId('ff'), name: sanitizeFontLabel(name), order: Date.now(), createdAt: Date.now() };
        await this._tx('folders', 'readwrite', os => os.put(folder));
        this._emit();
        return folder;
    }

    async renameFolder(id, name) {
        const rows = await this.listFolders();
        const folder = rows.find(f => f.id === id);
        if (!folder) return false;
        await this._tx('folders', 'readwrite', os => os.put({ ...folder, name: sanitizeFontLabel(name) }));
        this._emit();
        return true;
    }

    /** フォルダを消す。中のフォントは未分類(folderId=null)へ戻す(フォント自体は消さない)。 */
    async deleteFolder(id) {
        const fonts = await this.listFonts();
        for (const font of fonts.filter(f => f.folderId === id)) await this.moveFont(font.id, null, { silent: true });
        await this._tx('folders', 'readwrite', os => os.delete(id));
        this._emit();
    }

    // ---------------------------------------------------------------- フォント

    /** メタデータ一覧(実体のArrayBufferは含めない)。 */
    async listFonts() {
        const rows = await this._tx('fonts', 'readonly', os => os.getAll());
        return (rows || [])
            .map(({ data, ...meta }) => meta)
            .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
    }

    /**
     * フォントファイルを取り込む。ブラウザがデコードできない/壊れたファイルは保存せず失敗を返す。
     * @returns {Promise<{ok:true, font}|{ok:false, reason:string}>}
     */
    async addFontFile(file, folderId = null) {
        if (!file || typeof FontFace === 'undefined') return { ok: false, reason: 'フォントを取り込めない環境です' };
        if (!/\.(ttf|otf|woff2?|ttc)$/i.test(file.name || '')) return { ok: false, reason: 'ttf / otf / woff / woff2 のみ取り込めます' };
        if (file.size > 40 * 1024 * 1024) return { ok: false, reason: 'ファイルが大きすぎます（40MBまで）' };
        const data = await file.arrayBuffer();
        const id = newId('font');
        const family = `TegakiFont_${id}`;
        try {
            const face = new FontFace(family, data.slice(0));
            await face.load();
            document.fonts.add(face);
        } catch (error) {
            return { ok: false, reason: 'フォントとして読み込めませんでした' };
        }
        const font = {
            id,
            label: sanitizeFontLabel(file.name),
            family,
            ext: extOf(file.name),
            size: file.size,
            folderId: folderId || null,
            addedAt: Date.now()
        };
        await this._tx('fonts', 'readwrite', os => os.put({ ...font, data }));
        this._loaded.set(id, { family, ext: font.ext, base64: null, data });
        this._emit();
        return { ok: true, font };
    }

    async renameFont(id, label) {
        const row = await this._tx('fonts', 'readonly', os => os.get(id));
        if (!row) return false;
        await this._tx('fonts', 'readwrite', os => os.put({ ...row, label: sanitizeFontLabel(label) }));
        this._emit();
        return true;
    }

    async moveFont(id, folderId, { silent = false } = {}) {
        const row = await this._tx('fonts', 'readonly', os => os.get(id));
        if (!row) return false;
        await this._tx('fonts', 'readwrite', os => os.put({ ...row, folderId: folderId || null }));
        if (!silent) this._emit();
        return true;
    }

    async deleteFont(id) {
        await this._tx('fonts', 'readwrite', os => os.delete(id));
        this._loaded.delete(id);
        this._emit();
    }

    /** 保存済みフォントを文書のFontFaceとして読み込む(起動時/再編集時に1回)。 */
    async ensureLoaded(id) {
        if (this._loaded.get(id)) return this._loaded.get(id);
        const row = await this._tx('fonts', 'readonly', os => os.get(id));
        if (!row) return null;
        try {
            const face = new FontFace(row.family, row.data.slice(0));
            await face.load();
            document.fonts.add(face);
        } catch (error) {
            return null;
        }
        const entry = { family: row.family, ext: row.ext, base64: null, data: row.data };
        this._loaded.set(id, entry);
        return entry;
    }

    /** SVG埋め込み用の@font-face CSS(base64化は1回だけ)。 */
    async getEmbedCss(id) {
        const entry = await this.ensureLoaded(id);
        if (!entry) return '';
        entry.base64 ||= bufferToBase64(entry.data);
        return buildFontFaceCss(entry.family, entry.base64, entry.ext);
    }

    /** 端末にあるフォントのうち、代表的な日本語familyで実際に使えるもの。 */
    listSystemFonts() {
        return COMMON_JP_FONT_FAMILIES.filter(isFontAvailable);
    }

    /**
     * Local Font Access API(許可が必要・ユーザー操作内で呼ぶ)で端末の全familyを返す。未対応/拒否は空配列。
     */
    async queryAllSystemFamilies() {
        if (typeof window === 'undefined' || typeof window.queryLocalFonts !== 'function') return [];
        try {
            const fonts = await window.queryLocalFonts();
            return [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ja'));
        } catch (error) {
            return [];
        }
    }
}

export const fontLibrary = new FontLibrary();
