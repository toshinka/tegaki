import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, source, playbackCss, authorityMap, mainCss] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8'),
    readFile(new URL('../UI_DESIGN_AUTHORITY_MAP.md', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8')
]);

const mainIndex = index.indexOf('styles/main.css');
const componentIndex = index.indexOf('styles/components/animation-table-playback.css');
assert.ok(mainIndex >= 0 && componentIndex > mainIndex,
    'palette and semantic tokens load before the Playback component stylesheet');

for (const selector of [
    'anim-play-btn',
    'anim-playback-primary-slot',
    'anim-playback-controls',
    'anim-playback-range-controls',
    'anim-playback-range-focus-deck',
    'anim-playback-marker-btn'
]) {
    assert.match(playbackCss, new RegExp(`\\.animation-table-panel(?:\\.is-narrow)? \\.${selector}`),
        `${selector} is scoped to the Animation Table component`);
    assert.doesNotMatch(source, new RegExp(`\\.${selector}(?:[^\\n{]*)\\s*\\{`),
        `${selector} has no duplicate static-style authority in the runtime injection`);
}

assert.doesNotMatch(playbackCss, /#[a-z][\w-]*\s*\{/i,
    'component appearance does not depend on ID specificity');
assert.doesNotMatch(playbackCss, /!important/,
    'component scope wins without important overrides');
assert.match(source, /style\.id = 'animation-table-styles'/,
    'legacy runtime style remains explicit for components not yet extracted');
assert.match(source, /durationWidthCss[\s\S]*?--anim-cell-width/,
    'generated Timeline width rules remain in JavaScript');
assert.match(source, /this\.panel\.style\.left[\s\S]*?this\.panel\.style\.top/,
    'runtime panel geometry remains in JavaScript');

for (const token of ['--ui-surface-control', '--ui-border-hover', '--ui-radius-control', '--ui-shadow-float']) {
    assert.match(mainCss, new RegExp(`${token}:`), `${token} remains in the shared semantic authority`);
}

assert.match(authorityMap, /再生 \/ 停止は最頻action[\s\S]*?視覚中央の主action/,
    'authority map fixes playback priority instead of one skin');
assert.match(authorityMap, /色、枠、角丸、font、shadow、厳密なpixel寸法はskin変更対象/,
    'future skin changes remain explicitly allowed');
assert.match(authorityMap, /Playback static appearance.*styles\/components\/animation-table-playback\.css/,
    'the extracted component stylesheet has one documented owner');

console.log('verify-ui-design-authority-boundary: load order, scoped Playback CSS, runtime geometry and concept authority OK');
