import assert from 'node:assert/strict';
import {
    FONT_LIBRARY_STORAGE_KEY,
    FONT_SAMPLE_OPTIONS,
    FontLibrary,
    sanitizeFontPreferences,
    sortBundledFonts
} from '../system/font-library.js';

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
}

class FakeFontFace {
    static count = 0;
    constructor(family, data) {
        this.family = family;
        this.data = data;
        FakeFontFace.count += 1;
    }
    async load() { return this; }
}

const catalog = {
    version: 1,
    primaryId: 'font-b',
    fonts: [
        { id: 'font-a', label: 'A', family: 'Catalog A', file: 'a.woff2', ext: 'woff2', category: '手書き', comment: 'A short note', sourceUrl: 'https://example.test/a', licenseUrl: 'https://example.test/a-license', licenseFile: 'a-LICENSE.txt', coverage: 'かな・漢字', dakuten: true },
        { id: 'font-b', label: 'B', family: 'Catalog B', file: 'b.woff2', ext: 'woff2', category: 'ポップ', comment: 'B short note', sourceUrl: 'https://example.test/b', licenseUrl: 'https://example.test/b-license', licenseFile: 'b-LICENSE.txt', coverage: 'かな', dakuten: '要確認' },
        { id: 'font-c', label: 'C', family: 'Catalog C', file: 'c.woff2', ext: 'woff2', category: 'クール', comment: 'C short note', sourceUrl: 'javascript:alert(1)', licenseUrl: 'https://example.test/c-license', licenseFile: '../outside.txt', coverage: '漢字', dakuten: false }
    ]
};

const storage = new MemoryStorage();
const fetchCalls = [];
let bAttempts = 0;
const fetchMock = async (url) => {
    fetchCalls.push(String(url));
    if (String(url).endsWith('/fonts/catalog.json')) return { ok: true, json: async () => catalog };
    if (String(url).endsWith('/fonts/a.woff2')) {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    }
    if (String(url).endsWith('/fonts/b.woff2')) {
        bAttempts += 1;
        if (bAttempts === 1) return { ok: false };
        return { ok: true, arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer };
    }
    if (String(url).endsWith('/fonts/c.woff2')) return { ok: true, arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer };
    throw new Error(`unexpected fetch: ${url}`);
};

const documentRef = { fonts: { add() {} } };
const library = new FontLibrary({
    baseUrl: '/tegaki/',
    fetch: fetchMock,
    storage,
    FontFace: FakeFontFace,
    document: documentRef
});

const beforeLoad = await library.listBundledFonts();
assert.deepEqual(beforeLoad.map(font => font.id), ['font-a', 'font-b', 'font-c'], 'catalog primary does not reorder the catalog');
assert.equal(fetchCalls.filter(url => url.endsWith('/fonts/catalog.json')).length, 1, 'catalog is fetched once');
assert.equal(fetchCalls.filter(url => /\/fonts\/(?:a|b|c)\.woff2$/.test(url)).length, 0, 'metadata listing does not fetch font bytes');
assert.equal(library.getBundledAssetUrl(beforeLoad[1], 'licenseFile'), '/tegaki/fonts/b-LICENSE.txt', 'license path stays under same origin fonts root');
assert.equal(library.getBundledAssetUrl(beforeLoad[2], 'licenseFile'), '', 'parent traversal in asset paths is rejected');

library.setFavorite('font-c', true);
const favoriteOrder = await library.listBundledFonts();
assert.deepEqual(favoriteOrder.map(font => font.id), ['font-c', 'font-a', 'font-b'], 'favorites sort first with stable nonfavorite order');
assert.equal(favoriteOrder[0].favorite, true);
assert.equal(favoriteOrder[2].primary, true, 'catalog primary is exposed until the user selects another primary');

const concurrent = await Promise.all([library.ensureLoaded('font-a'), library.ensureLoaded('font-a'), library.ensureLoaded('font-a')]);
assert.ok(concurrent[0]);
assert.strictEqual(concurrent[0], concurrent[1], 'same font shares one in-flight load');
assert.strictEqual(concurrent[1], concurrent[2]);
assert.equal(fetchCalls.filter(url => url.endsWith('/fonts/a.woff2')).length, 1, 'same font makes one byte request');

assert.equal(await library.ensureLoaded('font-b'), null, 'failed font load is reported as unavailable');
assert.ok(await library.ensureLoaded('font-b'), 'a failed font load can be retried');
assert.equal(fetchCalls.filter(url => url.endsWith('/fonts/b.woff2')).length, 2, 'failed font load is not cached as success');
assert.equal(await library.deleteFont('font-a'), false, 'bundled fonts cannot enter the IndexedDB delete path');

const catalogWithBrokenDb = new FontLibrary({
    baseUrl: '/tegaki/',
    fetch: fetchMock,
    storage: new MemoryStorage(),
    FontFace: FakeFontFace,
    document: documentRef
});
catalogWithBrokenDb._tx = async () => { throw new Error('simulated IndexedDB outage'); };
assert.deepEqual((await catalogWithBrokenDb.listBundledFonts()).map(font => font.id), ['font-a', 'font-b', 'font-c'], 'catalog remains readable when IndexedDB is unavailable');

const imported = new FontLibrary({
    baseUrl: '/tegaki/',
    fetch: fetchMock,
    storage: new MemoryStorage(),
    FontFace: FakeFontFace,
    document: documentRef
});
const importedRow = { id: 'font_user_1', family: 'User Import', ext: 'ttf', data: new Uint8Array([10, 11]).buffer };
imported._tx = async (store, mode, fn) => store === 'fonts' ? importedRow : fn({ getAll: () => ({ result: [] }) });
const importedEntry = await imported.ensureLoaded(importedRow.id);
assert.equal(importedEntry.family, importedRow.family, 'existing IndexedDB font remains loadable beside catalog fonts');
assert.equal(importedEntry.bundled, false);
assert.equal(fetchCalls.filter(url => url.endsWith('/fonts/catalog.json')).length, 3, 'each library instance has one catalog request while imported data stays separate');

const sanitized = sanitizeFontPreferences({
    favorites: ['font-b', 'font-b', '<bad>'],
    primaryId: 'font-b',
    comments: { 'font-b': '<keep>  note  ', 'bad id': 'discard' },
    sampleId: 'unknown'
});
assert.deepEqual(sanitized.favorites, ['font-b']);
assert.equal(sanitized.comments['font-b'], 'keep  note');
assert.equal(sanitized.sampleId, FONT_SAMPLE_OPTIONS[0].id);
storage.setItem(FONT_LIBRARY_STORAGE_KEY, JSON.stringify({ favorites: ['font-a'], comments: { 'font-a': 'owner note' }, primaryId: 'font-a' }));
assert.deepEqual(sortBundledFonts(catalog.fonts, library.getPreferences()).map(font => font.id), ['font-a', 'font-b', 'font-c']);
library.setPrimary('font-c');
library.setUserComment('font-c', '  owner memo  ');
library.setSample('headline');
const savedPreferences = library.getPreferences();
assert.equal(savedPreferences.primaryId, 'font-c');
assert.equal(savedPreferences.comments['font-c'], 'owner memo');
assert.equal(savedPreferences.sampleId, 'headline');
let preferenceChanges = 0;
const stopPreferenceChanges = library.onChange(() => { preferenceChanges += 1; });
library.setUserComment('font-a', 'draft commit', { silent: true });
assert.equal(preferenceChanges, 0, 'a silent draft commit does not start a competing refresh');
library.setUserComment('font-a', 'saved comment');
assert.equal(preferenceChanges, 1, 'normal comment change still emits the UI refresh');
stopPreferenceChanges();

console.log('curated font library verifier: metadata-only catalog / lazy load / concurrent dedupe / retry / preferences / imported coexistence ok');
