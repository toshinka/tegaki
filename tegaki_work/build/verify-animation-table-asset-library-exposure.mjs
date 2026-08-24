import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../ui/ui-icons.js', import.meta.url), 'utf8');
const panelMethodStart = source.indexOf('_ensurePanelElement()');
const templateStart = source.indexOf('this.panel.innerHTML = `', panelMethodStart);
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(panelMethodStart >= 0 && templateStart >= 0 && templateEnd > templateStart);

const template = source.slice(templateStart, templateEnd);
assert.equal(template.split('id="anim-assets-toggle-btn"').length - 1, 1,
    'Asset Library trigger remains unique');
assert.equal(template.split('id="anim-asset-library"').length - 1, 1,
    'Asset Library surface remains unique');
assert.match(template, /id="anim-assets-toggle-btn"[^>]*aria-label="Asset Library"[^>]*aria-controls="anim-asset-library"[^>]*aria-expanded="false"[^>]*>\$\{UI_ICONS\.library\}<\/button>/,
    'compact trigger uses the shared Library icon and explicit disclosure semantics');
assert.doesNotMatch(template, /id="anim-assets-toggle-btn"[^>]*>LIB<\/button>/,
    'ambiguous LIB abbreviation is removed from the persistent header');
assert.match(icons, /library:\s*'<svg[^']+<rect width="8" height="18"/,
    'the shared palette-bound Library icon remains the visual authority');
assert.match(source, /assetsBtn\.classList\.toggle\('active', this\.isAssetLibraryVisible\);[\s\S]*?assetsBtn\.setAttribute\('aria-expanded', String\(this\.isAssetLibraryVisible\)\);/,
    'open state drives both visual and accessibility projection');
assert.match(source, /#anim-assets-toggle-btn'[\s\S]*?this\.isAssetLibraryVisible = !this\.isAssetLibraryVisible;[\s\S]*?this\.render\(\);/,
    'the icon reuses the existing runtime toggle and render path');
assert.match(source, /libraryPanel\.classList\.toggle\('is-visible', this\.isAssetLibraryVisible\);[\s\S]*?_renderAssetLibrary\(libraryPanel\)/,
    'the existing Asset Library DOM and renderer remain unchanged');
assert.doesNotMatch(template, /anim-assets[^\n]*(settings|overflow|selected-clip)/i,
    'Asset Library is not merged into Settings, overflow, or Selected Clip context');

console.log('verify-animation-table-asset-library-exposure: shared icon, one-step toggle and Asset Library authority OK');
