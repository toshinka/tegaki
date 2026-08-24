import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = await readFile(new URL('./phase9c-canvas-first-skin-baseline-fixture.html', import.meta.url), 'utf8');

assert.match(fixture, /data-variant="current"/u, 'current Futaba baseline exists');
assert.match(fixture, /data-variant="warm-canvas-first"/u, 'warm Canvas-first candidate exists');

for (const surface of ['animation-table', 'qtp', 'layer-panel']) {
    const count = fixture.match(new RegExp(`data-surface="${surface}"`, 'gu'))?.length || 0;
    assert.equal(count, 2, `${surface} is compared with identical A/B surface coverage`);
}

assert.equal(fixture.match(/class="ui-button play-priority" aria-label="Play"/gu)?.length, 2,
    'both variants keep one explicit play primary action');
assert.match(fixture, /\.play-row\s*\{[^}]*justify-content:center;/u,
    'play primary action stays centered independently of skin');
assert.match(fixture, /\.proposal-b \.play-priority\s*\{[^}]*min-width:44px;[^}]*min-height:38px;/u,
    'candidate gives the primary action more weight without changing behavior');
assert.equal(fixture.match(/class="ui-button low-frequency"/gu)?.length, 10,
    'both variants keep equivalent lower-frequency controls for hierarchy comparison');

assert.equal(fixture.match(/class="ui-button marker">I<\/button>/gu)?.length, 2,
    'unset I remains visible in both skins');
assert.equal(fixture.match(/class="ui-button marker is-set">O <span>F13<\/span><\/button>/gu)?.length, 2,
    'configured O and Frame value remain distinct in both skins');
assert.match(fixture, /\.marker\.is-set\s*\{[^}]*background:var\(--orange\);[^}]*color:var\(--ink\);/u,
    'configured O keeps readable Futaba ink on the orange action surface');
assert.match(fixture, /--setup:#315c96;/u, 'Setup blue has an explicit semantic token');
assert.equal(fixture.match(/class="setup-chip">RIG<\/span>/gu)?.length, 2,
    'Setup blue is demonstrated only by the RIG semantic chip');
assert.match(fixture, /data-concept="skin-independent-hierarchy"/u,
    'fixture states that visual skin must preserve the accepted hierarchy');

assert.match(fixture, /@media \(max-width:900px\)/u, 'A/B comparison stacks at narrow width');
assert.match(fixture, /@media \(max-width:520px\)/u, 'component controls have a compact-width rule');
assert.match(fixture, /@media \(pointer:coarse\)[^{]*\{[\s\S]*?\.ui-button\{min-height:38px\}[\s\S]*?\.play-priority\{min-width:44px;min-height:38px\}/u,
    'coarse pointer comparison restores deliberate hit areas while keeping play primary');
assert.doesNotMatch(fixture, /:\s*(?:black|white|gray|grey)\b/iu,
    'fixture does not introduce named neutral color values');
assert.doesNotMatch(fixture, /#(?:000000|ffffff)(?![0-9a-f])/iu,
    'fixture does not introduce pure black or pure white');

console.log('verify-phase9c-canvas-first-skin-baseline: paired three-surface skin comparison and concept invariants OK');
