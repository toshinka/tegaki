// R-64: bottom-fixed Animation Dock dynamic height ownership (source-level contract).
// _bottomDockNormalHeight is user-intent only (null = AUTO). AUTO height is recomputed from the
// visible row count on every layout, so structural changes (Lane add/remove) cannot leave a stale
// cached height. One owner (_queueBottomDockLayout -> _setBottomDockHeight) applies the result.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const popup = fs.readFileSync(path.join(root, 'ui/animation-table-popup.js'), 'utf8').replace(/\r\n/g, '\n');

const methodBody = (name) => {
    const start = popup.indexOf(`\n    ${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    const end = popup.indexOf('\n    }\n', start);
    assert.ok(end > start, `${name} body is delimited`);
    return popup.slice(start, end);
};
const arrowBody = (name) => {
    const start = popup.indexOf(`\n    ${name} = (`);
    assert.ok(start >= 0, `${name} exists`);
    const end = popup.indexOf('\n    };\n', start);
    assert.ok(end > start, `${name} body is delimited`);
    return popup.slice(start, end);
};

// 1. Normal height is only ever a user resize (or its rollback) after construction.
const assignments = [...popup.matchAll(/this\._bottomDockNormalHeight\s*=\s*([^;]+);/g)].map(match => match[1].trim());
assert.deepEqual(assignments, ['null', 'session.initialNormalHeight', 'session.height'],
    'constructor null, resize-cancel restore, resize-finish are the only writers of _bottomDockNormalHeight');
assert.doesNotMatch(popup, /_rememberBottomDockNormalHeight/u,
    'leaving compact no longer freezes the AUTO height into the user-height slot');
assert.match(arrowBody('_finishBottomDockResize'), /session\.initialState === 'compact'[\s\S]*?this\._bottomDockNormalHeight = session\.height/u,
    'an intentional compact resize is the only thing that pins the normal height');

// 2. AUTO derivation: recomputed on each layout, clamped, single apply point.
const layout = methodBody('_queueBottomDockLayout');
assert.doesNotMatch(layout, /_bottomDockNormalHeight\s*=/u, 'the layout pass never caches a derived height');
assert.match(layout, /Math\.min\(laneCount, 4\) \* laneHeight/u, 'AUTO body height derives from the visible row count (existing 4-row compact cap)');
assert.match(layout, /this\._bottomDockNormalHeight !== null[\s\S]*?height = this\._bottomDockNormalHeight;[\s\S]*?height = compactDesired;/u,
    'manual height wins; otherwise the freshly derived compactDesired is used');
assert.match(layout, /Math\.max\(bounds\.min, Math\.min\(bounds\.max, height\)\)/u, 'existing min/max bounds still clamp every result');
assert.match(layout, /getComputedStyle\(this\.panel\)\.getPropertyValue\('--ui-anim-lane-row-height'\)/u,
    'R-62 Dock-scoped 22px row contract is the only row-height input');
assert.match(layout, /this\._setBottomDockHeight\(height\)/u);

// 3. Structural changes reach the layout path through render(); no direct Canvas/CSS writes elsewhere.
assert.match(methodBody('render'), /this\._queueBottomDockLayout\(\)/u, 'render() (used by Lane add/remove) invalidates the Dock layout');
const heightVarWrites = [...popup.matchAll(/setProperty\('--ui-bottom-dock-open-height'/g)];
assert.equal(heightVarWrites.length, 1, 'exactly one writer of --ui-bottom-dock-open-height');
assert.match(methodBody('_setBottomDockHeight'), /setProperty\('--ui-bottom-dock-open-height'[\s\S]*?\?\.resize\?\.\(\)/u,
    'the single writer also drives the existing app resize / camera recentre');
for (const name of ['deleteActiveLane']) {
    assert.doesNotMatch(methodBody(name), /bottom-dock|_setBottomDockHeight|canvas-area/u, `${name} does not manipulate Dock height or Canvas directly`);
}

// 4. Bounds unchanged: min = chrome, max = min(440, 52% viewport, Canvas-safe ceiling).
assert.match(methodBody('_getBottomDockHeightBounds'), /Math\.min\(440, Math\.floor\(viewportHeight \* 0\.52\), layoutCeiling\)/u);

console.log('verify-animation-dock-dynamic-height: normal height is user-intent only / AUTO recomputed per layout / clamped / single writer / render() invalidation OK');
