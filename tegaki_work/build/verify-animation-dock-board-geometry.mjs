// R-62: Animation Dock timeline board geometry contract (source-level guard).
// The Bottom Dock owns one set of board tokens; every row type rendered on both
// the label side and the grid side shares the same explicit row height; the JS
// dock-height math reads the Dock-scoped token; ruler and grid share one line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lod = fs.readFileSync(path.join(root, 'styles/components/animation-table-utility-lod.css'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'ui/animation-table-popup.js'), 'utf8');

// Top-level (4-space) declarations only; the coarse-pointer @media override is nested deeper.
const rowDefs = lod.match(/^    --ui-anim-lane-row-height:/gm) || [];
const headerDefs = lod.match(/^    --ui-anim-timeline-header-height:/gm) || [];
assert.equal(rowDefs.length, 1, 'the Dock defines its lane row height exactly once (outside pointer media)');
assert.equal(headerDefs.length, 1, 'the Dock defines its ruler height exactly once (outside pointer media)');
assert.match(lod, /--ui-anim-lane-row-height: 22px;\s*--ui-anim-grid-line:/u,
    'the shared grid line lives beside the geometry tokens');

const rowRule = lod.match(/((?:#animation-table-popup\.is-bottom-dock \.[\w-]+,\s*)+#animation-table-popup\.is-bottom-dock \.anim-timeline-row)\s*\{\s*box-sizing: border-box;\s*flex: 0 0 var\(--ui-anim-lane-row-height\)/u);
assert.ok(rowRule, 'label rows and grid rows share one explicit border-box row rule');
for (const selector of ['.anim-track-item', '.anim-rig-bone-group-row', '.anim-timeline-row']) {
    assert.ok(rowRule[1].includes(selector), `${selector} is covered by the shared row-height rule`);
}

assert.match(lod, /\.anim-frame-num\s*\{[^}]*border-right-color: var\(--ui-anim-grid-line\)/u,
    'ruler ticks use the shared grid line');
assert.match(lod, /\.anim-cell-slot:not\(\.is-clip-range\)\s*\{\s*border-right-color: var\(--ui-anim-grid-line\)/u,
    'grid columns use the same line as the ruler ticks');
assert.match(lod, /\.anim-track-list\s*\{\s*background: var\(--futaba-background\);/u,
    'the sticky label column is opaque so the scrolled board never shows through');

assert.match(popup, /getComputedStyle\(this\.panel\)\.getPropertyValue\('--ui-anim-lane-row-height'\)/u,
    'dock height math reads the Dock-scoped row height');
assert.doesNotMatch(popup, /getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--ui-anim-lane-row-height'\)/u,
    'dock height math no longer reads the taller :root row height');
assert.match(popup, /anim-rig-bone-group-timeline-fill" style="width:calc\(var\(--anim-cell-width\) \* \$\{totalFrames\}\)"/u,
    'the Bone group fill derives its width from the shared cell-width variable');

console.log('verify-animation-dock-board-geometry: single Dock tokens / shared row rule incl. Bone group / shared grid line / opaque sticky labels / Dock-scoped JS row height OK');
