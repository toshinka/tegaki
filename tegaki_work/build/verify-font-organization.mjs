import { FontLibrary } from '../system/font-library.js';
import { FontOrganization } from '../system/font-organization.js';
import { webcrypto } from 'node:crypto';

const failures = [];
function assert(condition, message) {
    if (!condition) failures.push(message);
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function fakeLibrary({ catalog, folders = [], fonts = [], folderError = false } = {}) {
    const listeners = new Set();
    return {
        onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        async loadCatalog() { return catalog; },
        async listFolders() { if (folderError) throw new Error('folder backend unavailable'); return folders; },
        async listFonts() { return fonts; },
        getCachedFolders() { return folders; },
        getCachedFonts() { return fonts; },
        emit() { listeners.forEach(listener => listener()); }
    };
}

class FakeRequest {
    constructor(result) {
        this.result = result;
        queueMicrotask(() => this.onsuccess?.({ target: this }));
    }
}

class FakeObjectStore {
    constructor(tx, values) { this.tx = tx; this.values = values; }
    get(key) { return { result: this.values.get(key) }; }
    getAll() { return { result: [...this.values.values()] }; }
    put(value) { this.values.set(value.id, value); return { result: value.id }; }
    delete(key) { this.values.delete(key); return { result: undefined }; }
}

class FakeTransaction {
    constructor(db) { this.db = db; }
    objectStore(name) {
        const values = this.db.stores.get(name);
        if (!values) throw new Error(`missing store ${name}`);
        queueMicrotask(() => this.oncomplete?.({ target: this }));
        return new FakeObjectStore(this, values);
    }
}

class FakeDb {
    constructor() {
        this.stores = new Map();
        this.objectStoreNames = { contains: name => this.stores.has(name) };
    }
    createObjectStore(name) { const values = new Map(); this.stores.set(name, values); return new FakeObjectStore(null, values); }
    transaction(name) { return new FakeTransaction(this, name); }
}

function fakeIndexedDB() {
    const db = new FakeDb();
    return {
        open() {
            const request = new FakeRequest(db);
            queueMicrotask(() => request.onupgradeneeded?.({ target: request }));
            queueMicrotask(() => request.onsuccess?.({ target: request }));
            return request;
        }
    };
}

function directoryHandle(files, permission = 'granted') {
    const state = { permission };
    const root = {
        name: 'TegakiFonts',
        get permission() { return state.permission; },
        async queryPermission() { return state.permission; },
        async getDirectoryHandle(name) {
            if (name !== 'Library') throw new Error('directory missing');
            return {
                async getDirectoryHandle(id) {
                    if (![...files.keys()].some(path => path.startsWith(`Library/${id}/`))) throw new Error('font directory missing');
                    return {
                        async getFileHandle(fileName) {
                            const path = `Library/${id}/${fileName}`;
                            if (!files.has(path)) throw new Error('file missing');
                            return { async getFile() { return new Blob([files.get(path)]); } };
                        }
                    };
                },
                async getFileHandle(fileName) {
                    const path = `Library/${fileName}`;
                    if (!files.has(path)) throw new Error('file missing');
                    return { async getFile() { return new Blob([files.get(path)]); } };
                }
            };
        },
        async getFileHandle(fileName) {
            const path = fileName;
            if (!files.has(path)) throw new Error('file missing');
            return { async getFile() { return new Blob([files.get(path)]); } };
        }
    };
    return { root, state };
}

async function verifyModel() {
    const storage = memoryStorage();
    const catalog = {
        organization: {
            folders: [
                { id: 'scene', label: '場面', parentId: null },
                { id: 'dialogue', label: '会話', parentId: 'scene' }
            ],
            placements: { 'bundled-a': 'scene' },
            orders: { root: ['folder:scene'], scene: ['font:bundled-a', 'folder:dialogue'], dialogue: [] },
            favoriteFirst: false
        }
    };
    const library = fakeLibrary({
        catalog,
        folderError: true,
        folders: [{ id: 'legacy', name: '旧取り込み', order: 1, createdAt: 1 }],
        fonts: [{ id: 'imported-a', label: 'Imported', folderId: 'legacy', addedAt: 1 }]
    });
    const organization = new FontOrganization({ storage, fontLibrary: library, autoInit: false });
    await organization.initialize(['bundled-a', 'imported-a']);
    let model = organization.getOrganization(['bundled-a', 'imported-a']);
    assert(model.folders.some(folder => folder.id === 'scene'), 'catalog organization folder missing');
    assert(model.folders.some(folder => folder.id === 'legacy'), 'legacy folder seed missing after independent folder failure');
    assert(model.placements['imported-a'] === 'legacy', 'legacy imported folder placement missing');
    assert(model.orders.root.includes('font:imported-a') === false, 'imported font remains in root after folder seed');

    assert(organization.setFavoriteFirst(true), 'favoriteFirst setter failed');
    assert(organization.moveOrganizationNode('font:bundled-a', 'dialogue') === true, 'font move failed');
    assert(organization.moveOrganizationNode('folder:scene', 'dialogue') === false, 'cycle move was accepted');
    const removed = organization.deleteOrganizationFolder('scene');
    assert(removed === true, 'folder delete failed');
    model = organization.getOrganization();
    assert(!model.folders.some(folder => folder.id === 'scene'), 'deleted folder remains');
    assert(model.folders.find(folder => folder.id === 'dialogue')?.parentId === null, 'child folder was not returned to parent');
    assert(model.placements['bundled-a'] === 'dialogue', 'nested font placement was not retained under the promoted child folder');

    const reloaded = new FontOrganization({ storage, fontLibrary: library, autoInit: false });
    await reloaded.initialize(['bundled-a', 'imported-a']);
    const reloadModel = reloaded.getOrganization();
    assert(reloadModel.favoriteFirst === true, 'favoriteFirst did not persist');
    assert(reloadModel.folders.some(folder => folder.id === 'dialogue'), 'manual folder order did not persist');
}

async function verifyExternalBackend() {
    const files = new Map([
        ['Library/ext-font/font.ttf', new Uint8Array([1, 2, 3])],
        ['Library/retry/font.ttf', new Uint8Array([4, 5])]
    ]);
    const { root, state } = directoryHandle(files);
    let pickerCalled = false;
    const digestHex = async value => [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', value))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
    const extHash = await digestHex(new Uint8Array([1, 2, 3]));
    const retryHash = await digestHex(new Uint8Array([4, 5]));
    class FakeFontFace {
        constructor(family, data) { this.family = family; this.data = data; }
        async load() { return this; }
    }
    const catalog = {
        version: 1,
        fonts: [
            { id: 'ext-font', label: 'External', family: 'External Family', external: true, file: 'Library/ext-font/font.ttf', licenseFile: 'Library/ext-font/LICENSE', sha256: extHash },
            { id: 'retry', label: 'Retry', family: 'Retry Family', external: true, file: 'Library/retry/font.ttf', sha256: retryHash }
        ],
        primaryId: 'ext-font'
    };
    const library = new FontLibrary({
        indexedDB: fakeIndexedDB(),
        directoryPicker: () => { pickerCalled = true; return Promise.resolve(root); },
        fetch: async () => ({ ok: true, async json() { return catalog; } }),
        FontFace: FakeFontFace,
        document: { fonts: { add() {} } },
        crypto: webcrypto,
        storage: memoryStorage()
    });
    const connection = library.connectExternalDirectory();
    assert(pickerCalled, 'directory picker was not called before await');
    const result = await connection;
    assert(result.ok === true, 'external directory connection failed');
    const status = await library.getExternalStatus();
    assert(status.connected && status.permission === 'granted' && status.name === 'TegakiFonts', 'external status did not use queryPermission');
    const file = await library.readExternalFile('Library/ext-font/font.ttf');
    assert(file instanceof Blob && (await file.arrayBuffer()).byteLength === 3, 'external file read failed');
    assert(await library.readExternalFile('Library/missing/font.ttf') === null, 'missing external file did not fail closed');
    assert((await library.getBundledAssetUrl('ext-font')) === '', 'external row exposed a public fallback URL');
    assert((await library.ensureLoaded('ext-font'))?.family === 'External Family', 'external ensureLoaded failed');

    files.delete('Library/retry/font.ttf');
    assert(await library.ensureLoaded('retry') === null, 'missing external load did not fail');
    files.set('Library/retry/font.ttf', new Uint8Array([4, 5]));
    assert((await library.ensureLoaded('retry'))?.family === 'Retry Family', 'external load did not retry after failure');
    state.permission = 'denied';
    assert((await library.getExternalStatus()).permission === 'denied', 'permission status did not update');
    assert(await library.readExternalFile('Library/ext-font/font.ttf') === null, 'denied external read was not blocked');
}

async function verifyLibraryBridge() {
    const storage = memoryStorage();
    const library = new FontLibrary({
        indexedDB: null,
        storage,
        fetch: async () => ({
            ok: true,
            async json() {
                return {
                    organization: { folders: [{ id: 'catalog', label: 'Catalog', parentId: null }], placements: {}, orders: { root: ['folder:catalog'] }, favoriteFirst: false },
                    fonts: []
                };
            }
        })
    });
    let libraryEvents = 0;
    library.onChange(() => { libraryEvents += 1; });
    const organization = await library.initializeOrganization(['bundled-a']);
    const snapshot = library.getOrganization(['bundled-a']);
    assert(snapshot.placements['bundled-a'] === null, 'FontLibrary synchronous organization snapshot missing font id');
    assert(snapshot.folders.some(folder => folder.id === 'catalog'), 'FontLibrary bridge lost catalog organization');
    organization.onChange(() => {});
    assert(library.setFavoriteFirst(true) === true, 'FontLibrary favoriteFirst delegate failed');
    assert(library.getOrganization().favoriteFirst === true, 'FontLibrary delegate did not update organization');
    assert(libraryEvents === 1, 'organization mutation emitted duplicate or missing FontLibrary onChange');
    assert(library.setFontFolder('bundled-a', 'catalog') === true, 'FontLibrary setFontFolder delegate failed');
    assert(library.getOrganization().placements['bundled-a'] === 'catalog', 'FontLibrary setFontFolder did not update placement');
    assert(libraryEvents === 2, 'FontLibrary setFontFolder notification was duplicated or missing');
    const created = library.createOrganizationFolder('Bridge folder');
    assert(created?.id && library.getOrganization().folders.some(folder => folder.id === created.id), 'FontLibrary folder CRUD delegate failed');

    const orderedLibrary = new FontLibrary({
        indexedDB: null,
        storage: memoryStorage(),
        fetch: async () => ({ ok: true, async json() { return { organization: { folders: [], placements: {}, orders: { root: [] }, favoriteFirst: false }, fonts: [] }; } })
    });
    orderedLibrary.listFolders = async () => [{ id: 'legacy', name: 'Legacy', order: 1, createdAt: 1 }];
    orderedLibrary.listFonts = async () => [
        { id: 'imported-a', label: 'A', folderId: 'legacy', addedAt: 1 },
        { id: 'imported-b', label: 'B', folderId: 'legacy', addedAt: 2 }
    ];
    await orderedLibrary.initializeOrganization(['imported-a', 'imported-b']);
    assert(orderedLibrary.moveOrganizationNode('font:imported-b', 'legacy', 'font:imported-a') === true, 'FontLibrary manual reorder delegate failed');
    const orderedNodes = orderedLibrary.getOrganization().orders['folder:legacy'];
    assert(JSON.stringify(orderedNodes) === JSON.stringify(['font:imported-b', 'font:imported-a']), 'FontLibrary notification re-seeded and changed manual order');
}

await verifyModel();
await verifyExternalBackend();
await verifyLibraryBridge();

// IDBRequest.result is inherited in the real browser. Own-property mocks missed handle reload.
{
    const library = new FontLibrary();
    library.init = async () => true;
    const saved = { id: 'root', handle: { name: 'external-proof' } };
    let requestValue = saved;
    library.db = { transaction() {
        const transaction = { objectStore: () => ({ get: () => Object.create({ get result() { return requestValue; } }) }) };
        queueMicrotask(() => transaction.oncomplete());
        return transaction;
    } };
    assert(await library._tx('external', 'readonly', os => os.get('root')) === saved, 'inherited IDBRequest.result must resolve to saved handle record');
    requestValue = undefined;
    assert(await library._tx('external', 'readonly', os => os.get('missing')) === undefined, 'missing IDB record must not return the request object');
}

if (failures.length) {
    console.error(`verify-font-organization: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log('verify-font-organization: PASS (model, FontLibrary bridge, legacy seed, external permission/read/retry)');
}
