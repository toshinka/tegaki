import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [fixture, phase, mainCss, index, popup, panels] = await Promise.all([
    readFile(new URL('./phase9k-integrated-outer-shell-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9k.md', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8')
]);

assert.equal(fixture.match(/id="fixture-shell"/gu)?.length, 1,
    'all candidates use one shared fixture DOM');
for (const theme of ['current-warm', 'opaque-umber', 'translucent-umber', 'floating-dark', 'warm-mid-light']) {
    assert.match(fixture, new RegExp(`data-value="${theme}"`), `${theme} control exists`);
}
for (const frame of ['gap', 'guide']) {
    assert.match(fixture, new RegExp(`data-value="${frame}"`), `${frame} outer-frame control exists`);
}
for (const tableTools of ['header', 'bottom']) {
    assert.match(fixture, new RegExp(`data-value="${tableTools}"`), `${tableTools} table-utility control exists`);
}
for (const size of ['wide', 'square', 'narrow']) {
    assert.match(fixture, new RegExp(`data-value="${size}"`), `${size} viewport control exists`);
}
for (const art of ['light', 'dark', 'vivid']) {
    assert.match(fixture, new RegExp(`data-value="${art}"`), `${art} art control exists`);
}
for (const opacity of ['soft', 'mid', 'deep']) {
    assert.match(fixture, new RegExp(`data-value="${opacity}"`), `${opacity} translucency control exists`);
    assert.match(fixture, new RegExp(`data-opacity="${opacity}"`), `${opacity} translucency token projection exists`);
}

assert.match(fixture, /--candidate-umber:\s*#60463f/u,
    'candidate umber remains fixture-local');
assert.match(fixture, /--candidate-warm-mid:\s*#b9aaa0/u,
    'candidate warm-mid surround remains fixture-local');
assert.match(fixture, /\.viewport-shell\[data-theme="opaque-umber"\][\s\S]*?--shell-outer-bg:[\s\S]*?--shell-rail-bg:/u,
    'opaque candidate changes outer shell and rails together');
assert.match(fixture, /\.viewport-shell\[data-theme="translucent-umber"\][\s\S]*?--shell-outer-bg:[\s\S]*?--shell-rail-bg:/u,
    'translucent candidate changes outer shell and rails together');
assert.match(fixture, /\.viewport-shell\[data-theme="floating-dark"\][\s\S]*?--shell-outer-bg:\s*var\(--futaba-background\)[\s\S]*?--shell-rail-bg:\s*var\(--candidate-umber\)/u,
    'floating-dark candidate keeps a light surround and darkens only the rails');
assert.match(fixture, /\.viewport-shell\[data-theme="warm-mid-light"\][\s\S]*?--shell-outer-bg:\s*var\(--candidate-warm-mid\)[\s\S]*?--shell-rail-bg:\s*rgba\(255, 255, 238, \.94\)/u,
    'warm-mid candidate separates the Canvas with light rails');
assert.match(fixture, /\.tool-rail,\s*\.control-rail\s*\{[\s\S]*?background:\s*var\(--shell-rail-bg\)/u,
    'left and right rails share one theme token');
assert.match(fixture, /background:\s*var\(--shell-outer-bg\)/u,
    'outer background consumes the integrated shell token');
for (const token of ['--setup-on-dark: #9fc6f2', '--motion-on-dark: #ffc08a', '--danger-on-dark: #f3aaa2']) {
    assert.match(fixture, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${token} remains fixture-local`);
}
assert.match(fixture, /\.rail-button\.is-setup\s*\{\s*color:\s*var\(--setup-on-shell\)/u);
assert.match(fixture, /\.rail-button\.is-motion\s*\{\s*color:\s*var\(--motion-on-shell\)/u);
assert.match(fixture, /\.rail-button\.is-danger\s*\{\s*color:\s*var\(--danger-on-shell\)/u);

const themeBlocks = fixture.match(/\.viewport-shell\[data-theme="(?:opaque-umber|translucent-umber|floating-dark|warm-mid-light)"\]\s*\{[\s\S]*?\}/gu) || [];
assert.equal(themeBlocks.length, 4, 'four outer-shell candidate blocks are isolated');
for (const block of themeBlocks) {
    assert.doesNotMatch(block, /--fixture-(?:canvas|panel)/u,
        'candidate theme does not alter Canvas or center-panel tokens');
}
for (const surface of ['作品Canvas', 'Quick Tool Presets', 'Layer Panel', 'Animation Table']) {
    assert.match(fixture, new RegExp(`aria-label="${surface}"`), `${surface} remains in every comparison`);
}
for (const state of ['is-hover', 'is-active', 'is-setup', 'is-motion', 'is-danger']) {
    assert.match(fixture, new RegExp(state), `${state} is represented`);
}
assert.match(fixture, /disabled>G<\/button>/u, 'disabled state is represented');
assert.match(fixture, /data-blur="off"/u);
assert.match(fixture, /--shell-blur:\s*6px/u, 'blur has one explicit small comparison value');
assert.match(fixture, /data-frame="gap"/u, 'outer frame is absent by default');
assert.match(fixture, /data-table-tools="bottom"/u, 'bottom utility separation is the default comparison');
assert.match(fixture, /class="table-utility"[\s\S]*?TIMELINE 47%[\s\S]*?COPY[\s\S]*?DELETE/u,
    'Timeline zoom and selected Clip actions share the low-attention utility band');
assert.match(fixture, /data-table-tools="header"[\s\S]*?\.table-utility[\s\S]*?order:\s*2/u,
    'the same utility DOM can be compared in the upper stack');

const toLinear = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
};
const luminance = ([red, green, blue]) => (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
);
const contrast = (foreground, background) => {
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};
const blend = (foreground, alpha, background) => foreground.map(
    (channel, index) => channel * alpha + background[index] * (1 - alpha)
);

const umber = [96, 70, 63];
const opaqueRail = blend(umber, 0.88, [240, 224, 214]);
const onDarkSemantic = {
    setup: [159, 198, 242],
    motion: [255, 192, 138],
    danger: [243, 170, 162]
};
const currentSemantic = {
    setup: [47, 103, 168],
    motion: [216, 98, 40],
    danger: [166, 58, 50]
};
assert.ok(Object.values(currentSemantic).some((color) => contrast(color, opaqueRail) < 3),
    'unchanged light-surface semantic colors reproduce the dark-rail contrast failure');
for (const [name, color] of Object.entries(onDarkSemantic)) {
    assert.ok(contrast(color, opaqueRail) >= 3,
        `${name} on-dark semantic color clears 3:1 on opaque rail`);
    for (const [opacity, shellAlpha, railAlpha] of [
        ['soft', 0.56, 0.72],
        ['mid', 0.70, 0.82],
        ['deep', 0.82, 0.90]
    ]) {
        for (const underlay of [[255, 255, 238], [234, 212, 201]]) {
            const translucentShell = blend(umber, shellAlpha, underlay);
            const translucentRail = blend([86, 61, 55], railAlpha, translucentShell);
            assert.ok(contrast(color, translucentRail) >= 3,
                `${name} on-dark semantic color clears 3:1 on ${opacity} translucent rail`);
        }
    }
}
const lightRail = blend([255, 255, 238], 0.94, [185, 170, 160]);
for (const [name, color] of Object.entries(currentSemantic)) {
    assert.ok(contrast(color, lightRail) >= 3,
        `${name} current semantic color clears 3:1 on warm-mid light rail`);
}
assert.ok(contrast([128, 0, 0], lightRail) >= 4.5,
    'maroon glyph clears 4.5:1 on warm-mid light rail');

for (const productionText of [mainCss, index, popup, panels]) {
    assert.doesNotMatch(productionText, /candidate-(?:umber|warm-mid)|fixture-shell|opaque-umber|translucent-umber|floating-dark|warm-mid-light|setup-on-dark|motion-on-dark|danger-on-dark|data-table-tools/u,
        'Stage A candidate state does not leak into production');
}
assert.doesNotMatch(index, /phase9k-integrated-outer-shell-fixture/u,
    'production does not load the comparison fixture');
assert.match(phase, /Gate 0=`GO — D: Floating dark rails`/u);
assert.match(phase, /theme picker、Project \/ localStorage保存flag/u);
assert.match(phase, /Canvas、QTP、Layer card、CAF card、Animation Table contentは淡色warmを維持/u);

console.log('verify-integrated-outer-shell-fixture: one DOM, five shells, gap-only frame, split table utility, three alpha levels, semantic contrast and production isolation OK');
