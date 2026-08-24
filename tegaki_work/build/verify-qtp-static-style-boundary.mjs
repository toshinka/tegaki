import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, source, componentCss, mainCss] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/quick-access-popup.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8')
]);

const extractRule = (text, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `${selector} rule exists`);
    return match[1];
};

const mainIndex = index.indexOf('styles/main.css');
const playbackIndex = index.indexOf('styles/components/animation-table-playback.css');
const qtpIndex = index.indexOf('styles/components/quick-access-popup.css');
assert.ok(mainIndex >= 0 && playbackIndex > mainIndex && qtpIndex > playbackIndex,
    'shared tokens load before the bounded component stylesheets');
assert.equal(index.match(/styles\/components\/quick-access-popup\.css/g)?.length, 1,
    'QTP component stylesheet is loaded once');

const sourceRoot = extractRule(source, '#quick-access-popup.qa-popup');
for (const property of [
    'position', 'z-index', 'width', 'min-width', 'max-width', 'padding',
    'box-sizing', 'user-select', 'touch-action', 'cursor'
]) {
    assert.match(sourceRoot, new RegExp(`(?:^|\\n)\\s*${property}:`),
        `${property} remains in the runtime geometry/behavior authority`);
}
for (const property of [
    'border', 'border-radius', 'background', 'box-shadow',
    'backdrop-filter', '-webkit-backdrop-filter', 'color'
]) {
    assert.doesNotMatch(sourceRoot, new RegExp(`(?:^|\\n)\\s*${property}:`),
        `${property} is removed from the runtime root rule`);
}

const sourceHeader = extractRule(source, '.qa-header');
assert.match(sourceHeader, /position:\s*relative/, 'header positioning remains in JavaScript');
assert.match(sourceHeader, /padding:\s*0 20px 4px 2px/, 'header geometry remains unchanged');
assert.match(sourceHeader, /cursor:\s*grab/, 'header drag affordance remains in JavaScript');
assert.doesNotMatch(sourceHeader, /border(?:-bottom)?:/, 'header border has one CSS authority');
assert.doesNotMatch(source, /\.qa-header-main\s*\{/, 'header title skin is removed from runtime injection');
assert.match(extractRule(source, '.qa-header-sub'), /white-space:\s*nowrap/,
    'header subtitle wrapping behavior remains in JavaScript');

const componentRoot = extractRule(componentCss, '#quick-access-popup.qa-popup');
for (const property of [
    'border', 'border-radius', 'background', 'box-shadow',
    'backdrop-filter', '-webkit-backdrop-filter', 'color'
]) {
    assert.match(componentRoot, new RegExp(`(?:^|\\n)\\s*${property}:`),
        `${property} is owned by the QTP component stylesheet`);
}
for (const property of [
    'position', 'z-index', 'width', 'min-width', 'max-width', 'padding',
    'box-sizing', 'display', 'touch-action', 'cursor'
]) {
    assert.doesNotMatch(componentRoot, new RegExp(`(?:^|\\n)\\s*${property}:`),
        `${property} is outside the static root skin boundary`);
}

const componentHeader = extractRule(componentCss, '#quick-access-popup.qa-popup .qa-header');
assert.match(componentHeader, /border-bottom:\s*1px solid transparent/,
    'header keeps its layout edge while reducing inactive border competition');
assert.match(extractRule(componentCss, '#quick-access-popup.qa-popup .qa-header-main'),
    /color:\s*var\(--futaba-maroon\)[\s\S]*font-weight:\s*700/,
    'header main label keeps the Futaba title hierarchy');
assert.match(extractRule(componentCss, '#quick-access-popup.qa-popup .qa-header-sub'),
    /color:\s*color-mix\(in srgb, var\(--futaba-maroon\) 58%, transparent\)/,
    'header subtitle uses palette-derived restrained contrast');

for (const token of [
    '--ui-qa-popup-width', '--ui-qa-popup-padding', '--ui-border-float',
    '--ui-radius-panel', '--ui-surface-float', '--ui-shadow-float', '--ui-backdrop-float'
]) {
    assert.match(mainCss, new RegExp(`${token}:`), `${token} remains in the shared token authority`);
}

assert.match(source, /style\.setAttribute\('data-qa-popup-styles', 'true'\)/,
    'legacy runtime style remains explicit for controls not yet extracted');
assert.match(source, /QA_STORAGE_KEYS\.position/, 'QTP position storage authority remains in JavaScript');

console.log('verify-qtp-static-style-boundary: load order, one static root/header skin and runtime geometry boundary OK');
