import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const cssSource = fs.readFileSync(path.join(workDir, 'styles/main.css'), 'utf8');
const quickAccessCss = fs.readFileSync(path.join(workDir, 'styles/components/quick-access-popup.css'), 'utf8');
const quickAccessSource = fs.readFileSync(path.join(workDir, 'ui/quick-access-popup.js'), 'utf8');

const expectedTokens = new Map([
    ['--ui-surface-rail', 'rgba(240, 224, 214, 0.42)'],
    ['--ui-surface-control', 'rgba(255, 255, 238, 0.12)'],
    ['--ui-surface-control-hover', 'rgba(255, 255, 238, 0.72)'],
    ['--ui-surface-control-active', 'rgba(255, 245, 222, 0.92)'],
    ['--ui-border-subtle', 'transparent'],
    ['--ui-border-hover', 'rgba(128, 0, 0, 0.16)'],
    ['--ui-border-active', 'rgba(255, 140, 66, 0.9)'],
    ['--ui-border-float', 'rgba(128, 0, 0, 0.18)'],
    ['--ui-shadow-float', '0 8px 20px rgba(80, 32, 24, 0.16), inset 0 1px 0 rgba(255, 255, 238, 0.38)'],
    ['--ui-shadow-control-active', '0 0 0 1px rgba(255, 140, 66, 0.2), 0 2px 5px rgba(80, 32, 24, 0.12)'],
    ['--ui-radius-rail', '6px'],
    ['--ui-radius-panel', '11px'],
    ['--ui-radius-control', '5px'],
    ['--ui-backdrop-rail', 'blur(6px)'],
    ['--ui-backdrop-float', 'blur(10px) saturate(1.12)']
]);

for (const [name, value] of expectedTokens) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+');
    assert.match(cssSource, new RegExp(`${escapedName}:\\s*${escapedValue};`, 'u'), `${name} keeps its accepted Phase 8l value`);
}

assert.match(cssSource, /--ui-surface-float:\s*linear-gradient\(180deg, rgba\(255, 255, 238, 0\.78\), rgba\(240, 224, 214, 0\.66\)\), rgba\(255, 255, 238, 0\.56\);/u);
assert.doesNotMatch(cssSource, /PHASE8L_RUNTIME_PROTOTYPE/u, 'temporary comparison overrides are removed');
assert.match(cssSource, /\.sidebar\s*\{[\s\S]*?background:\s*var\(--ui-surface-rail\)/u, 'sidebar outer surface uses the semantic rail alias');
assert.match(cssSource, /\.sidebar,\s*\n\.layer-controls-row\s*\{[\s\S]*?border-radius:\s*var\(--ui-radius-rail\)/u);
assert.match(cssSource, /\.sidebar\s*\{[\s\S]*?backdrop-filter:\s*var\(--ui-backdrop-rail\)[\s\S]*?box-shadow:\s*var\(--ui-shadow-rail\)/u);

const qtpPanelStyle = quickAccessCss.match(/#quick-access-popup\.qa-popup\s*\{[\s\S]*?\n\}/u)?.[0] || '';
assert.ok(qtpPanelStyle, 'QTP static panel skin exists in its component stylesheet');
assert.match(qtpPanelStyle, /border:\s*1px solid var\(--ui-border-float\)/u);
assert.match(qtpPanelStyle, /border-radius:\s*var\(--ui-radius-panel\)/u);
assert.match(qtpPanelStyle, /background:\s*var\(--ui-surface-float\)/u);
assert.match(qtpPanelStyle, /box-shadow:\s*var\(--ui-shadow-float\)/u);
assert.match(qtpPanelStyle, /backdrop-filter:\s*var\(--ui-backdrop-float\)/u);
assert.doesNotMatch(qtpPanelStyle, /(?:^|\n)\s*(?:position|z-index|width|min-width|max-width|padding|box-sizing|display|touch-action|cursor):/u,
    'runtime geometry and interaction properties stay outside the static QTP skin');

const toolStyle = quickAccessSource.match(/\.qa-tool-button\s*\{[\s\S]*?\n\s*\}/u)?.[0] || '';
const toolHoverStyle = quickAccessSource.match(/\.qa-tool-button:hover\s*\{[\s\S]*?\n\s*\}/u)?.[0] || '';
const toolActiveStyle = quickAccessSource.match(/\.qa-tool-button\.active\s*\{[\s\S]*?\n\s*\}/u)?.[0] || '';
assert.match(toolStyle, /width:\s*var\(--ui-qa-grid-size\)/u, 'QTP hit size remains on the existing responsive token');
assert.match(toolStyle, /border-radius:\s*var\(--ui-radius-control\)/u);
assert.match(toolStyle, /border:\s*1px solid var\(--ui-border-subtle\)/u);
assert.match(toolStyle, /background:\s*var\(--ui-surface-control\)/u);
assert.match(toolHoverStyle, /background:\s*var\(--ui-surface-control-hover\)/u);
assert.match(toolHoverStyle, /border-color:\s*var\(--ui-border-hover\)/u);
assert.match(toolActiveStyle, /border-color:\s*var\(--ui-border-active\)/u);
assert.match(toolActiveStyle, /background:\s*var\(--ui-surface-control-active\)/u);
assert.match(toolActiveStyle, /box-shadow:\s*var\(--ui-shadow-control-active\)/u);

const sharedToolStyle = cssSource.match(/\/\* ===== クイックアクセス - ツールボタン統一 ===== \*\/[\s\S]*?(?=\.resize-compact-group)/u)?.[0] || '';
assert.ok(sharedToolStyle, 'shared QTP tool style exists');
assert.match(sharedToolStyle, /\.qa-tool-button\s*\{[\s\S]*?border:\s*1px solid var\(--ui-border-subtle\)[\s\S]*?background:\s*var\(--ui-surface-control\)[\s\S]*?border-radius:\s*var\(--ui-radius-control\)/u,
    'later shared QTP rule keeps the semantic normal surface');
assert.match(sharedToolStyle, /\.qa-tool-button:hover:not\(\.active\)\s*\{[\s\S]*?background:\s*var\(--ui-surface-control-hover\)[\s\S]*?border-color:\s*var\(--ui-border-hover\)/u,
    'later shared QTP hover rule cannot override the semantic hover surface');
assert.match(sharedToolStyle, /\.qa-tool-button\.active\s*\{[\s\S]*?background:\s*var\(--ui-surface-control-active\)[\s\S]*?border-color:\s*var\(--ui-border-active\)[\s\S]*?box-shadow:\s*var\(--ui-shadow-control-active\)/u,
    'later shared QTP active rule cannot override the semantic active surface');
assert.doesNotMatch(sharedToolStyle, /\.qa-tool-button[\s\S]*?border:\s*3px solid/u,
    'QTP state changes do not shrink the existing hit area with a thicker border');

assert.match(cssSource, /@media \(pointer:\s*coarse\)[\s\S]*?--ui-rail-control-size:\s*38px;[\s\S]*?--ui-qa-grid-size:\s*24px;/u,
    'coarse pointer hit dimensions remain unchanged');
assert.match(quickAccessSource, /position:\s*'quick-access-position'/u, 'QTP keeps the existing localStorage position authority');
assert.match(quickAccessSource, /_savePosition\(x, y\)[\s\S]*?localStorage\.setItem\(QA_STORAGE_KEYS\.position/u);
assert.match(quickAccessSource, /_loadPosition\(\)[\s\S]*?localStorage\.getItem\(QA_STORAGE_KEYS\.position/u);
assert.match(quickAccessSource, /import \{ UI_ICONS \} from '\.\/ui-icons\.js';/u, 'QTP keeps centralized icons');
assert.doesNotMatch(quickAccessSource, /<svg\b/u, 'token bridge does not add direct SVG markup to QTP');

console.log('verify-ui-surface-token-bridge: semantic aliases / restrained QTP depth / position and hit contracts OK');
