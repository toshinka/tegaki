import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const repoDir = path.resolve(workDir, '..');
const fixture = fs.readFileSync(path.join(buildDir, 'phase9p-transform-edit-target-placement-fixture.html'), 'utf8');
const phase = fs.readFileSync(
    path.join(repoDir, '開発用資料保管庫', 'Archive', 'phase9p.md'),
    'utf8'
);

assert.equal((fixture.match(/class="candidate(?: [^"]+)?" data-option=/g) || []).length, 4);
for (const option of ['topbar', 'panel', 'dual', 'canvas']) {
    assert.match(fixture, new RegExp(`data-option="${option}"`));
}
for (const state of ['source', 'ready', 'keyed', 'blocked']) {
    assert.match(fixture, new RegExp(`data-set-state="${state}"`));
    assert.match(fixture, new RegExp(`${state}: '`, 'm'));
}

assert.match(fixture, /candidate is-recommended" data-option="panel"/);
assert.match(fixture, /第一候補: production projectionへ限定接続/);
assert.match(fixture, /NO-GO: 二重projectionを先に作らない/);
assert.match(fixture, /NO-GO: Canvasは直接操作へ譲る/);
assert.match(fixture, /READYやKEYEDを表示してもAuto Keyやkey mutationは起こさない/);
assert.match(fixture, /@media \(max-width: 600px\)/);
assert.match(fixture, /aria-pressed/);

assert.match(phase, /Stage A2 — visible Edit Target projection/);
assert.match(phase, /Gate 1=`GO — B: Transform-local indicator`/);
assert.match(phase, /production表示はまだ接続しない/);
assert.doesNotMatch(fixture, /\.\.\/system|EventBus|historyManager|localStorage|setClipTransformKeyframes/);

console.log('Phase 9p Transform Edit Target placement fixture verifier passed.');
