import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const repoDir = path.resolve(workDir, '..');
const fixturePath = path.join(buildDir, 'phase9o-layer-transform-interaction-grammar-fixture.html');
const phasePath = path.join(repoDir, '開発用資料保管庫', 'Archive', 'phase9o.md');

const fixture = fs.readFileSync(fixturePath, 'utf8');
const phase = fs.readFileSync(phasePath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const count = (source, pattern) => (source.match(pattern) || []).length;
const optionBlock = (name) => {
  const match = fixture.match(new RegExp(`<article class="candidate" data-option="${name}"[\\s\\S]*?<\\/article>`));
  return match?.[0] ?? '';
};

assert(count(fixture, /data-phase9o-fixture/g) === 1, 'fixture root must be unique');
assert(count(fixture, /<article class="candidate" data-option="(?:current|csp-like|procreate-like|tegaki-hybrid)"/g) === 4, 'A-D candidates must exist exactly once');
assert(count(fixture, /data-scene="transform-target"/g) === 4, 'all candidates must use the same transform-target scene marker');

const current = optionBlock('current');
assert(/Current/.test(current), 'Current candidate label is missing');
for (const label of ['X', 'Y', 'Rotation', 'Scale']) {
  assert(current.includes(label), `Current candidate must expose ${label}`);
}
assert(/Shift horizontal = ROTATE/.test(current) && /Shift vertical = SCALE/.test(current), 'Current modifier grammar is missing');

const csp = optionBlock('csp-like');
for (const handle of ['north-west', 'north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west']) {
  assert(csp.includes(`data-handle="${handle}"`), `CSP-like candidate is missing ${handle} handle`);
}
assert(/class="rotate-handle"/.test(csp), 'CSP-like rotate affordance is missing');
assert(/class="anchor-handle"/.test(csp), 'CSP-like anchor affordance is missing');

const procreate = optionBlock('procreate-like');
for (const mode of ['uniform', 'freeform', 'distort', 'warp']) {
  assert(procreate.includes(`data-mode="${mode}"`), `Procreate-like candidate is missing ${mode} mode`);
}
assert(count(procreate, /role="tab"/g) === 4, 'Procreate-like candidate must expose four first-level modes');

const hybrid = optionBlock('tegaki-hybrid');
for (const mode of ['basic', 'distort', 'warp']) {
  assert(hybrid.includes(`data-mode="${mode}"`), `Tegaki hybrid candidate is missing ${mode} mode`);
}
assert(/data-option="tegaki-hybrid" data-transform-mode="basic"/.test(hybrid), 'Tegaki hybrid must default to BASIC');
assert(/<details class="precise-controls" data-precise-controls>/.test(hybrid), 'Tegaki hybrid precise controls must use secondary disclosure');
assert(/data-mode-panel="warp"/.test(hybrid) && /GRID 3 × 3/.test(hybrid), 'Tegaki hybrid WARP-only grid controls are missing');
assert(/\[data-transform-mode="warp"\] \.warp-grid[\s\S]*?display: block/.test(fixture), 'WARP grid must be hidden until WARP selection');
assert(/\[data-option="tegaki-hybrid"\]\[data-transform-mode="distort"\] \[data-mode-panel="distort"\]/.test(fixture), 'DISTORT controls must be mode-gated');

for (const authority of ['normal-raster', 'folder', 'caf-working', 'selection', 'svg-path']) {
  assert(fixture.includes(`data-authority="${authority}"`), `authority matrix is missing ${authority}`);
}
assert(fixture.includes('Layer Warp Grid ≠ Rig Mesh'), 'Layer Warp Grid and Rig Mesh boundary must be explicit');
assert(fixture.includes('EventBus / History / save / production module 非接続'), 'production-disconnected fixture status is missing');
assert(fixture.includes('OWNER SELECT PENDING'), 'Owner visual selection gate is missing');

assert(/@media \(max-width: 520px\)/.test(fixture), '480px-class responsive rule is missing');
assert(/@media \(pointer: coarse\)/.test(fixture), 'coarse pointer hit rule is missing');
assert(/min-height: 38px/.test(fixture), 'coarse controls must retain a 38px hit target');
assert(!/min-width:\s*(?:9\d\d|[1-9]\d{3,})px/.test(fixture), 'fixture must not force a desktop page minimum width');

assert(/candidate\.dataset\.transformMode = button\.dataset\.mode/.test(fixture), 'mode comparison must update only local candidate state');
assert(/setAttribute\('aria-selected', String\(peer === button\)\)/.test(fixture), 'mode comparison must synchronize aria-selected');
assert(!/(?:TegakiEventBus|localStorage|sessionStorage|fetch\s*\(|import\s+[^('])/.test(fixture), 'fixture must not connect EventBus, storage, network, or production imports');
assert(!/(?:\bblack\b|\bwhite(?!-space)\b|\bgray\b|\bgrey\b|#000(?:000)?\b|#fff(?:fff)?\b)/i.test(fixture), 'fixture must not use neutral black/white/gray literals');

assert(/Stage A1/.test(phase) && /Static fixture comparison/.test(phase), 'Phase 9o must define Stage A1 static comparison');
assert(/productionを変更せず/.test(phase), 'Phase 9o must keep Stage A1 disconnected from production');
assert(/Ownerがvisual comparisonを選べる/.test(phase), 'Phase 9o must require Owner visual selection');
assert(/Drawing Warp/.test(phase) && /Anchor animation/.test(phase) && /RIG model/.test(phase), 'Phase 9o no-go boundaries are incomplete');

for (const productionPath of [
  path.join(workDir, 'system', 'layer-transform.js'),
  path.join(workDir, 'ui', 'dom-builder.js'),
]) {
  const source = fs.readFileSync(productionPath, 'utf8');
  assert(!/phase9o|tegaki-hybrid|procreate-like|csp-like/i.test(source), `${path.relative(workDir, productionPath)} must remain disconnected from Phase 9o candidates`);
}

if (failures.length > 0) {
  console.error('Phase 9o Layer Transform fixture verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 9o Layer Transform fixture verification passed.');
console.log('- one-DOM A / B / C / D comparison: OK');
console.log('- progressive BASIC / DISTORT / WARP disclosure: OK');
console.log('- Raster / Folder / CAF / Selection / SVG-path authority matrix: OK');
console.log('- production / EventBus / History / save isolation: OK');
