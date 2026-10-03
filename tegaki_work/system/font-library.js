/**
 * ============================================================================
 * ファイル名: system/font-library.js
 * 責務: 吹き出し/文字用のフォント管理。端末にあるフォント(使えるものだけ)の一覧、選定フォントの
 *       catalog、取り込んだフォントファイル(.ttf/.otf/.woff/.woff2)を扱う。
 * 依存: IndexedDB / FontFace / fetch（なければ該当機能だけ無効）
 * 被依存: system/lettering-raster.js, ui/balloon-popup.js
 * 公開API: FontLibrary, fontLibrary, COMMON_JP_FONT_FAMILIES, FONT_SAMPLE_OPTIONS, isFontAvailable,
 *   fontFamilyCss, buildFontFaceCss, sanitizeFontLabel, sanitizeFontPreferences, sortBundledFonts,
 *   FONT_FILE_ACCEPT
 * 保存: 取り込んだフォント実体とフォルダはブラウザ内ローカル(IndexedDB)。Project/History/書き出しへは関与しない。
 *   Layerに残るのは確定した画素と、再編集用のフォント参照(family名 or 取り込みフォントid)だけ。
 * ライセンス: 同梱フォントはcatalogのsource/license情報と親Cardの取得物を正本とする。ユーザー取り込みも維持。
 * 実装状態: ✅実装（WP-021）
 * ============================================================================
 */

export const FONT_FILE_ACCEPT = '.ttf,.otf,.woff,.woff2,.ttc';
export const FONT_LIBRARY_STORAGE_KEY = 'tegaki-font-library-ui-v1';
export const FONT_SAMPLE_OPTIONS = Object.freeze([
    { id: 'mixed', label: 'かな・漢字・英数字', text: 'あいうえお 漫画の吹き出し ABC123' },
    { id: 'kana', label: 'かな中心', text: 'あいうえお かきくけこ さしすせそ' },
    { id: 'headline', label: '見出し・擬音', text: 'ドンッ！ キラキラ ！？' }
]);
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

function cleanText(value, max = 160) {
    return String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

function cleanId(value) {
    const id = String(value ?? '').trim();
    return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(id) ? id : '';
}

function cleanUrl(value) {
    const raw = String(value ?? '').trim();
    if (!/^https?:\/\//i.test(raw)) return '';
    try {
        const url = new URL(raw, 'http://localhost/');
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
        return '';
    }
}

function cleanTags(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(tag => cleanText(tag, 30)).filter(Boolean))].slice(0, 20);
}

/** localStorageへ置くUI設定だけを正規化する。Project/Historyとは別の領域。 */
export function sanitizeFontPreferences(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const favoriteSource = Array.isArray(src.favorites) ? src.favorites : [];
    const favorites = [...new Set(favoriteSource.map(cleanId).filter(Boolean))].slice(0, 200);
    const comments = {};
    if (src.comments && typeof src.comments === 'object' && !Array.isArray(src.comments)) {
        for (const [id, value] of Object.entries(src.comments)) {
            const clean = cleanId(id);
            const comment = cleanText(value, 160);
            if (clean && comment) comments[clean] = comment;
        }
    }
    const sampleId = FONT_SAMPLE_OPTIONS.some(sample => sample.id === src.sampleId) ? src.sampleId : FONT_SAMPLE_OPTIONS[0].id;
    return {
        favorites,
        primaryId: cleanId(src.primaryId) || null,
        comments,
        sampleId
    };
}

/** catalogの並びを保持したまま、お気に入りだけを先頭へ安定移動する。 */
export function sortBundledFonts(fonts, preferences = {}) {
    const favoriteIds = new Set(sanitizeFontPreferences(preferences).favorites);
    return [...(Array.isArray(fonts) ? fonts : [])]
        .map((font, index) => ({ font, index }))
        .sort((a, b) => {
            const favoriteDelta = Number(favoriteIds.has(b.font?.id)) - Number(favoriteIds.has(a.font?.id));
            return favoriteDelta || a.index - b.index;
        })
        .map(item => item.font);
}

function normalizeCatalogRow(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const id = cleanId(raw.id);
    const file = String(raw.file ?? '').trim();
    const family = cleanText(raw.family, 120).replace(/["'\\;{}<>]/g, '');
    if (!id || !file || !family) return null;
    const numericSize = Number(raw.size);
    return {
        id,
        label: sanitizeFontLabel(raw.label || id),
        family,
        file,
        ext: String(raw.ext || extOf(file)).toLowerCase(),
        category: cleanText(raw.category || '選定フォント', 40),
        tags: cleanTags(raw.tags),
        comment: cleanText(raw.comment, 240),
        author: cleanText(raw.author, 120),
        sourceUrl: cleanUrl(raw.sourceUrl),
        licenseUrl: cleanUrl(raw.licenseUrl),
        licenseFile: String(raw.licenseFile ?? '').trim(),
        coverage: cleanText(Array.isArray(raw.coverage) ? raw.coverage.join(' / ') : raw.coverage, 120),
        dakuten: typeof raw.dakuten === 'boolean' ? raw.dakuten : cleanText(raw.dakuten, 120),
        sha256: cleanText(raw.sha256, 128),
        size: Number.isFinite(numericSize) && numericSize >= 0 ? numericSize : 0,
        version: cleanText(raw.version, 80),
        bundled: true,
        catalogIndex: index
    };
}

function normalizeCatalog(raw) {
    const rows = Array.isArray(raw?.fonts)
        ? raw.fonts.map(normalizeCatalogRow).filter(Boolean)
        : [];
    const primaryId = rows.some(row => row.id === raw?.primaryId) ? raw.primaryId : (rows[0]?.id || null);
    return { version: Number(raw?.version) === 1 ? 1 : 1, primaryId, fonts: rows };
}

function emptyCatalog() {
    return { version: 1, primaryId: null, fonts: [] };
}

function baseUrlWithSlash(baseUrl) {
    const text = String(baseUrl || '/');
    return text.endsWith('/') ? text : `${text}/`;
}

function catalogUrlFor(baseUrl) {
    return `${baseUrlWithSlash(baseUrl)}fonts/catalog.json`;
}

function relativeAssetUrl(baseUrl, path) {
    const raw = String(path ?? '').trim();
    if (!raw || raw.startsWith('/') || raw.split('/').includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
    const url = `${baseUrlWithSlash(baseUrl)}fonts/${raw}`;
    try {
        const parsed = new URL(url, 'http://localhost/');
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    } catch (error) {
        return '';
    }
    return url;
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
        this._loaded = new Map();   // fontId → { family, ext, base64, data }
        this._loadPromises = new Map();
        this._catalog = null;
        this._catalogPromise = null;
        this.baseUrl = options.baseUrl || (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
        this.catalogUrl = options.catalogUrl || catalogUrlFor(this.baseUrl);
        this.fetch = options.fetch || globalThis.fetch?.bind(globalThis);
        this.storage = options.storage || (() => {
            try { return globalThis.localStorage; } catch (error) { return null; }
        })();
        this.FontFace = options.FontFace || globalThis.FontFace;
        this.document = options.document || globalThis.document;
        this._listeners = new Set();
    }

    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit() {
        this._listeners.forEach(fn => { try { fn(); } catch (error) { /* listenerの失敗で保存を止めない */ } });
    }

    // ------------------------------------------------------------ 選定catalog / UI設定

    /** catalog.jsonはメタデータだけ一度取得する。各フォントの実体はensureLoadedまで取得しない。 */
    async loadCatalog() {
        if (this._catalog) return this._catalog;
        if (this._catalogPromise) return this._catalogPromise;
        this._catalogPromise = (async () => {
            if (typeof this.fetch !== 'function') {
                this._catalog = emptyCatalog();
                return this._catalog;
            }
            try {
                const response = await this.fetch(this.catalogUrl);
                if (!response || response.ok === false) throw new Error('font catalog fetch failed');
                this._catalog = normalizeCatalog(await response.json());
            } catch (error) {
                // catalogの失敗は空一覧として固定する。個別フォントのload失敗はensureLoadedで再試行する。
                this._catalog = emptyCatalog();
            }
            return this._catalog;
        })();
        return this._catalogPromise;
    }

    async listBundledFonts() {
        const catalog = await this.loadCatalog();
        const preferences = this.getPreferences();
        return sortBundledFonts(catalog.fonts.map(font => ({ ...font })), preferences)
            .map(font => ({
                ...font,
                favorite: preferences.favorites.includes(font.id),
                primary: preferences.primaryId === font.id || (!preferences.primaryId && catalog.primaryId === font.id),
                userComment: preferences.comments[font.id] || ''
            }));
    }

    async getBundledFont(id) {
        const catalog = await this.loadCatalog();
        return catalog.fonts.find(font => font.id === id) || null;
    }

    getBundledAssetUrl(fontOrId, field = 'file') {
        const row = typeof fontOrId === 'object' ? fontOrId : this._catalog?.fonts?.find(font => font.id === fontOrId);
        return row ? relativeAssetUrl(this.baseUrl, row[field]) : '';
    }

    getPreferences() {
        let raw = null;
        try { raw = this.storage?.getItem?.(FONT_LIBRARY_STORAGE_KEY); } catch (error) { raw = null; }
        try { return sanitizeFontPreferences(raw ? JSON.parse(raw) : null); } catch (error) { return sanitizeFontPreferences(null); }
    }

    setPreferences(value, { silent = false } = {}) {
        const preferences = sanitizeFontPreferences(value);
        try { this.storage?.setItem?.(FONT_LIBRARY_STORAGE_KEY, JSON.stringify(preferences)); } catch (error) { /* UI設定が保存できなくても動作は続ける */ }
        if (!silent) this._emit();
        return preferences;
    }

    setFavorite(id, favorite) {
        const preferences = this.getPreferences();
        const favorites = new Set(preferences.favorites);
        if (favorite) favorites.add(String(id)); else favorites.delete(String(id));
        return this.setPreferences({ ...preferences, favorites: [...favorites] });
    }

    setPrimary(id) {
        const preferences = this.getPreferences();
        return this.setPreferences({ ...preferences, primaryId: id || null });
    }

    setUserComment(id, comment, { silent = false } = {}) {
        const preferences = this.getPreferences();
        const comments = { ...preferences.comments };
        const cleanIdValue = cleanId(id);
        const cleanComment = cleanText(comment, 160);
        if (cleanIdValue) {
            if (cleanComment) comments[cleanIdValue] = cleanComment;
            else delete comments[cleanIdValue];
        }
        return this.setPreferences({ ...preferences, comments }, { silent });
    }

    setSample(id) {
        return this.setPreferences({ ...this.getPreferences(), sampleId: id });
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
        if (!file || typeof this.FontFace !== 'function') return { ok: false, reason: 'フォントを取り込めない環境です' };
        if (!/\.(ttf|otf|woff2?|ttc)$/i.test(file.name || '')) return { ok: false, reason: 'ttf / otf / woff / woff2 のみ取り込めます' };
        if (file.size > 40 * 1024 * 1024) return { ok: false, reason: 'ファイルが大きすぎます（40MBまで）' };
        const data = await file.arrayBuffer();
        const id = newId('font');
        const family = `TegakiFont_${id}`;
        try {
            const face = new this.FontFace(family, data.slice(0));
            await face.load();
            this.document?.fonts?.add?.(face);
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
        if (await this.getBundledFont(id)) return false;
        const row = await this._tx('fonts', 'readonly', os => os.get(id));
        if (!row) return false;
        await this._tx('fonts', 'readwrite', os => os.put({ ...row, label: sanitizeFontLabel(label) }));
        this._emit();
        return true;
    }

    async moveFont(id, folderId, { silent = false } = {}) {
        if (await this.getBundledFont(id)) return false;
        const row = await this._tx('fonts', 'readonly', os => os.get(id));
        if (!row) return false;
        await this._tx('fonts', 'readwrite', os => os.put({ ...row, folderId: folderId || null }));
        if (!silent) this._emit();
        return true;
    }

    async deleteFont(id) {
        if (await this.getBundledFont(id)) return false;
        await this._tx('fonts', 'readwrite', os => os.delete(id));
        this._loaded.delete(id);
        this._emit();
    }

    /** 同梱/保存済みフォントを文書のFontFaceとして読み込む。失敗は次回呼び出しで再試行する。 */
    async ensureLoaded(id) {
        const key = String(id ?? '');
        if (this._loaded.get(key)) return this._loaded.get(key);
        if (this._loadPromises.has(key)) return this._loadPromises.get(key);
        const promise = this._ensureLoaded(key)
            .catch(() => null)
            .finally(() => this._loadPromises.delete(key));
        this._loadPromises.set(key, promise);
        return promise;
    }

    async _ensureLoaded(id) {
        if (typeof this.FontFace !== 'function') return null;
        const bundled = await this.getBundledFont(id);
        let row = bundled;
        let data = null;
        if (bundled) {
            const url = this.getBundledAssetUrl(bundled, 'file');
            if (!url || typeof this.fetch !== 'function') return null;
            const response = await this.fetch(url);
            if (!response || response.ok === false || typeof response.arrayBuffer !== 'function') throw new Error('font fetch failed');
            data = await response.arrayBuffer();
        } else {
            row = await this._tx('fonts', 'readonly', os => os.get(id));
            if (!row) return null;
            data = row.data;
        }
        if (!data) return null;
        const family = row.family;
        const face = new this.FontFace(family, data.slice(0));
        await face.load();
        this.document?.fonts?.add?.(face);
        const entry = { family, ext: row.ext || extOf(row.file), base64: null, data, bundled: !!bundled, id };
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
