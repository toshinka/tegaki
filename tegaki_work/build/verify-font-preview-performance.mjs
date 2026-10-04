/** WP-024 runtime cache boundaries: bounded warm jobs, immutable raster reuse. */
import assert from 'node:assert/strict';
import { FontLibrary } from '../system/font-library.js';
import { rasterizeLettering } from '../system/lettering-raster.js';

const library = new FontLibrary();
let active = 0, maximum = 0, loads = 0;
library._ensureLoaded = async id => {
    active++; loads++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    const entry = { id, family: id }; library._loaded.set(id, entry); active--;
    return entry;
};
assert.equal(library.getLoadedFont('one'), null);
await Promise.all([library.warmFonts(['one', 'two', 'three', 'four'], { concurrency: 99 }), library.ensureLoaded('one')]);
assert.equal(maximum, 2);
assert.equal(loads, 4, 'foreground and warming must share a load');
assert.equal(library.getLoadedFont('one').family, 'one');
await library.warmFonts(['one', 'two', 'three', 'four']);
assert.equal(loads, 4, 'warm visits must not re-read font bytes');
await Promise.all([library.warmFonts(['five', 'six']), library.warmFonts(['seven', 'eight'])]);
assert.equal(maximum, 2, 'overlapping UI warm queues must share the library-wide limit');
let continueWarming = true;
const cancellation = new FontLibrary();
let cancelledLoads = 0;
cancellation.ensureLoaded = async id => { cancelledLoads++; continueWarming = false; return { id }; };
await cancellation.warmFonts(['a', 'b', 'c'], { concurrency: 1, shouldContinue: () => continueWarming });
assert.equal(cancelledLoads, 1);

const documents = new FontLibrary();
let documentReads = 0;
documents._readExternalFile = async () => { documentReads++; return new Blob(['author license']); };
await Promise.all([documents.readExternalFile('Library/a/LICENSE'), documents.readExternalFile('Library/a/LICENSE')]);
await documents.readExternalFile('Library/a/LICENSE');
assert.equal(documentReads, 1);
for (let i = 0; i < 33; i++) await documents.readExternalFile(`Library/a/${i}.txt`);
assert.equal(documents._externalDocumentCache.size, 32);

let decodes = 0;
const previousImage = globalThis.Image;
globalThis.Image = class { async decode() { decodes++; } };
const documentRef = {
    fonts: { ready: Promise.resolve() },
    body: { appendChild() {} },
    createElement(type) {
        if (type === 'div') return { style: {}, firstElementChild: { getBoundingClientRect: () => ({ width: 4, height: 3 }) }, remove() {} };
        if (type === 'canvas') return { getContext: () => ({ clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(48).fill(7) }) }) };
        throw new Error(type);
    }
};
try {
    const request = { text: 'あ1', fontFamily: 'Preview', embedCss: '@font-face{test:one}', color: '#800000' };
    const first = await rasterizeLettering(request, { documentRef });
    first.pixels[0] = 255; first.request.color = '#ffffff';
    const second = await rasterizeLettering(request, { documentRef });
    assert.equal(decodes, 1);
    assert.equal(second.pixels[0], 7, 'caller edits must not mutate cached pixels');
    assert.equal(second.request.color, '#800000');
    await rasterizeLettering({ ...request, embedCss: '@font-face{test:two}' }, { documentRef });
    assert.equal(decodes, 2, 'changed font bytes/CSS must not reuse old glyph pixels');
    await rasterizeLettering({ ...request, text: '別' }, { documentRef });
    await rasterizeLettering({ ...request, text: '三' }, { documentRef });
    await rasterizeLettering({ ...request, text: '四' }, { documentRef });
    await rasterizeLettering(request, { documentRef });
    assert.equal(decodes, 6, 'bounded cache must evict the least recently used result');
} finally {
    globalThis.Image = previousImage;
}
console.log('font preview performance PASS: bounded/shared warm jobs, cancellation, document cache, immutable raster reuse/eviction');
