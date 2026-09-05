import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [qtpSource, iconSource] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-icons.js', import.meta.url), 'utf8')
]);

assert.match(qtpSource, /position:\s*'quick-access-position'/, 'existing x/y localStorage key remains the position authority');
assert.match(qtpSource, /localStorage\.setItem\(QA_STORAGE_KEYS\.position, JSON\.stringify\(\{ x, y \}\)\)/, 'position persistence remains x/y only');
assert.doesNotMatch(qtpSource, /positionPreset|handedness|handedSide|lastPositionPreset/, 'preset ID and handedness must not become saved state');

for (const preset of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    assert.equal((qtpSource.match(new RegExp(`data-qa-position="${preset}"`, 'g')) || []).length, 1, `${preset} must have one header deck choice`);
}

assert.match(qtpSource, /id="qa-position-toggle"[\s\S]*aria-controls="qa-position-deck"[\s\S]*aria-expanded="false"/, 'header entry exposes one controlled deck');
assert.match(qtpSource, /\$\{UI_ICONS\.positionCorners\}/, 'position entry uses the shared palette-bound SVG');
assert.match(iconSource, /positionCorners:[\s\S]*stroke="currentColor"/, 'position icon inherits the component palette');
assert.match(qtpSource, /_moveToPositionPreset\(preset\)[\s\S]*const inset = 12;[\s\S]*this\._savePosition\(clamped\.x, clamped\.y\)/, 'corner choice resolves to clamped existing x/y storage');
assert.match(qtpSource, /_clampPanelPosition\(x, y[\s\S]*window\.innerWidth - width[\s\S]*window\.innerHeight - height/, 'preset and drag share viewport clamp authority');
assert.match(qtpSource, /const layoutWidth = Number\(this\.panel\?\.offsetWidth\)[\s\S]*const layoutHeight = Number\(this\.panel\?\.offsetHeight\)/, 'viewport clamp measures final layout size instead of fadeIn transform bounds');
assert.match(qtpSource, /const layoutLeft = Number\(this\.panel\.offsetLeft\)[\s\S]*const layoutTop = Number\(this\.panel\.offsetTop\)/, 'reopen clamp uses layout coordinates without fadeIn transform drift');
assert.match(qtpSource, /const clamped = this\._clampPanelPosition\(newX, newY, panelRect\)/, 'free drag remains active through the shared clamp');
assert.match(qtpSource, /_clampCurrentPanelPosition\(\{ save: true \}\)/, 'reopen adapts an old saved position to the current viewport');
assert.match(qtpSource, /event\.key !== 'Escape'[\s\S]*this\._setPositionDeckOpen\(false\)/, 'Escape closes the anchored deck');
assert.match(qtpSource, /!positionDeck\.contains\(event\.target\)[\s\S]*!positionToggleBtn\.contains\(event\.target\)/, 'outside pointer closes the anchored deck');
assert.match(qtpSource, /_setPositionDeckOpen\(false\);[\s\S]*_setTextRasterPanelOpen\(false\);/, 'QTP close clears transient subpanels');

console.log('verify-qtp-position-preset: four-corner command, x/y-only persistence, shared clamp, free drag and transient deck contract OK');
