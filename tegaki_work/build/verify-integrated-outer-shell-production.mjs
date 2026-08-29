import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, mainCss, sidebarCss, layerCss, quickAccessCss, animationTableCss, settingsSource, phase] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/sidebar-rail.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/quick-access-popup.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/settings-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9k.md', import.meta.url), 'utf8')
]);

const expectedTokens = new Map([
    ['--ui-rail-surface-dark', 'linear-gradient(180deg, color-mix(in srgb, var(--futaba-light-maroon) 98%, transparent), color-mix(in srgb, var(--futaba-light-maroon) 88%, transparent))'],
    ['--ui-rail-foreground', 'var(--futaba-background)'],
    ['--ui-rail-setup-foreground', '#9fc6f2'],
    ['--ui-rail-motion-foreground', '#ffc08a'],
    ['--ui-rail-danger-foreground', '#ffb87e'],
    ['--ui-rail-control-rest', 'transparent'],
    ['--ui-rail-control-hover', 'rgba(255, 255, 238, 0.18)'],
    ['--ui-rail-control-active', 'var(--active-border)'],
    ['--ui-rail-control-active-foreground', 'var(--futaba-background)'],
    ['--ui-rail-shadow-dark', 'none']
]);
for (const [name, value] of expectedTokens) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+');
    assert.match(mainCss, new RegExp(`${escapedName}:\\s*${escapedValue};`, 'u'), `${name} has the accepted candidate D value`);
}

assert.match(mainCss, /--ui-surface-rail:\s*var\(--ui-rail-surface-dark\)/u,
    'left rail resolves through the shared production surface');
assert.match(mainCss, /--ui-layer-surface-rail:\s*var\(--ui-rail-surface-dark\)/u,
    'right rail resolves through the same production surface');
assert.match(mainCss, /--ui-shadow-rail:\s*var\(--ui-rail-shadow-dark\)/u);
assert.match(mainCss, /--ui-layer-shadow-rail:\s*var\(--ui-rail-shadow-dark\)/u);

assert.match(sidebarCss, /\.sidebar \.tool-button\s*\{[\s\S]*?background:\s*var\(--ui-rail-control-rest\)[\s\S]*?color:\s*var\(--ui-rail-foreground\)/u,
    'left rail resting controls use the on-dark token set');
assert.match(sidebarCss, /\.sidebar \.tool-button:hover[\s\S]*?var\(--ui-rail-control-hover\)/u,
    'left rail hover stays inside the dark rail hierarchy');
assert.doesNotMatch(sidebarCss.match(/\.sidebar \.tool-button:hover[^\{]*\{[\s\S]*?\}/u)?.[0] || '', /border-color/u,
    'left rail hover uses a surface change without adding another frame');
assert.match(sidebarCss, /\.sidebar \.tool-button\[aria-expanded="true"\][\s\S]*?background:\s*var\(--ui-rail-control-active\)[\s\S]*?color:\s*var\(--ui-rail-control-active-foreground\)/u,
    'popup launcher active state is explicitly projected on the rail');
assert.match(sidebarCss, /\.sidebar \.tool-button\[aria-expanded="true"\][\s\S]*?border:\s*1px solid var\(--ui-border-active\)[\s\S]*?box-shadow:\s*none/u,
    'active rail control is one orange surface rather than a stacked double ring');

assert.match(layerCss, /\.right-panel \.layer-controls-row\s*\{[\s\S]*?background:\s*var\(--ui-layer-surface-rail\)[\s\S]*?color:\s*var\(--ui-rail-foreground\)/u,
    'right operation rail uses the shared dark surface and glyph color');
assert.match(layerCss, /\.right-panel \.layer-controls-row \.layer-op-button[\s\S]*?background:\s*var\(--ui-rail-control-rest\)/u,
    'right rail operation buttons use rail-local resting appearance');
assert.match(layerCss, /\.right-panel \.layer-controls-row \.layer-op-danger:not\(:disabled\):not\(\.is-disabled\)\s*\{[\s\S]*?color:\s*var\(--ui-rail-danger-foreground\)[\s\S]*?opacity:\s*1/u,
    'enabled destructive right-rail action keeps an opaque orange semantic color');
assert.match(layerCss, /\.right-panel \.layer-controls-row \.layer-op-danger:not\(:disabled\):not\(\.is-disabled\) svg\s*\{[\s\S]*?opacity:\s*1[\s\S]*?stroke-opacity:\s*1/u,
    'destructive glyph opacity stays independent from the translucent rail panel');
assert.match(layerCss, /\.right-panel \.layer-controls-row \.layer-op-button\.active[\s\S]*?var\(--ui-rail-control-active\)/u,
    'right-rail active state uses the shared orange active surface');

assert.equal(layerCss.match(/var\(--ui-layer-surface-rail\)/gu)?.length, 1,
    'the dark Layer token is scoped to the detached right operation rail');
for (const centerSource of [quickAccessCss, animationTableCss]) {
    assert.doesNotMatch(centerSource, /--ui-rail-(?:surface|foreground|control|border|shadow)/u,
        'center-view panels remain outside the dark rail token set');
}
assert.match(mainCss, /body\s*\{[\s\S]*?background:\s*var\(--futaba-background\)/u,
    'workspace background stays on the accepted warm-light surface');
assert.match(mainCss, /\.main-layout\s*\{[\s\S]*?user-select:\s*none/u,
    'workspace chrome does not leave accidental browser text selection active');
assert.match(mainCss, /\.main-layout :is\(input, textarea, \[contenteditable="true"\]\)\s*\{[\s\S]*?user-select:\s*text/u,
    'editable controls explicitly retain text selection');

for (const source of [settingsSource, index]) {
    assert.doesNotMatch(source, /ui-rail-surface-dark|rail-theme|theme-picker|data-rail-theme/u,
        'candidate D does not add Settings, DOM or saved theme state');
}
assert.doesNotMatch(sidebarCss, /(?:^|\n)\s*(?:width|height|position|inset|left|right|top|bottom|z-index|pointer-events):/u,
    'left production slice does not change rail geometry or interaction');
assert.doesNotMatch(layerCss, /(?:^|\n)\s*(?:width|height|position|inset|left|right|top|bottom|z-index|pointer-events):/u,
    'right production slice does not change rail geometry or interaction');

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
const composite = (foreground, background, alpha) => foreground.map((channel, index) => (
    Math.round(alpha * channel + (1 - alpha) * background[index])
));
const futabaLightMaroon = [156, 56, 53];
const railAlphas = [0.98, 0.88];
const artworkSamples = {
    lightArtwork: [255, 255, 238],
    maroonArtwork: [128, 0, 0],
    darkArtwork: [44, 24, 16]
};
const productionRailBackgrounds = Object.fromEntries(
    railAlphas.flatMap((alpha) => Object.entries(artworkSamples).map(([name, background]) => [
        `${name}-${Math.round(alpha * 100)}`,
        composite(futabaLightMaroon, background, alpha)
    ]))
);
const productionRailColors = {
    glyph: [255, 255, 238],
    setup: [159, 198, 242],
    motion: [255, 192, 138],
    danger: [255, 184, 126]
};
for (const [backgroundName, background] of Object.entries(productionRailBackgrounds)) {
    for (const [name, color] of Object.entries(productionRailColors)) {
        assert.ok(contrast(color, background) >= 3,
            `${name} clears 3:1 on the translucent production rail over ${backgroundName}`);
    }
}

assert.match(phase, /Gate 0=`GO — D: Floating dark rails`/u);
assert.match(phase, /rail表示切替 Gate=`FROZEN — dark rail production調整を優先`/u,
    'light / dark rail switch stays frozen while the dark production rail is refined');

console.log('verify-integrated-outer-shell-production: shared dark rails, light center surfaces, state contrast and no saved theme state OK');
