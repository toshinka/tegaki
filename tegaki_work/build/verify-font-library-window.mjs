/** WP030: overlapping/closed/failed font projections cannot overwrite current UI. */
import assert from 'node:assert/strict';
// Existing UI_ICONS has a browser compatibility export; projection itself needs no DOM.
globalThis.window = {};
const { FontLibraryWindow } = await import('../ui/font-library-window.js');

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const preferences = { favorites: ['new'], comments: {}, primaryId: null };
const old = deferred(), newest = deferred(); let request = 0, open = true;
const projected = [], initialized = [];
const manager = Object.assign(Object.create(FontLibraryWindow.prototype), {
    _revision: 0, selectedId: '', rows: [], refs: { feedback: { textContent: '' } },
    library: {
        listBundledFonts: () => (++request === 1 ? old.promise : newest.promise),
        listFonts: async () => [],
        initializeOrganization: async ids => { initialized.push(ids); },
        getPreferences: () => preferences,
        getOrganization: () => ({ folders: [], placements: {}, orders: {} })
    },
    comparison: { isOpen: () => open, setData: data => projected.push(data), setCommittedKey: () => {} },
    _renderInformation: () => {}
});
const first = manager.refresh(), second = manager.refresh();
newest.resolve([{ id: 'new', primary: true }]); await second;
old.resolve([{ id: 'old' }]); await first;
assert.deepEqual(manager.rows.map(row => row.id), ['new']);
assert.equal(manager.selectedId, 'new'); assert.equal(manager.rows[0].favorite, true);
assert.equal(projected.length, 1, 'late old response must not replace current projection');

const closed = deferred(); manager.library.listBundledFonts = () => closed.promise;
const closing = manager.refresh(); open = false; ++manager._revision;
closed.resolve([{ id: 'closed' }]); await closing;
assert.deepEqual(manager.rows.map(row => row.id), ['new']); assert.equal(projected.length, 1);

open = true; manager.library.listBundledFonts = async () => { throw Error('unavailable'); };
await manager.refresh();
assert.match(manager.refs.feedback.textContent, /unavailable/);
assert.equal(projected.length, 1, 'failed read preserves last good rows');
assert.equal(initialized.length, 3);
console.log('font library window: latest projection, closed-window rejection, error preservation PASS');
