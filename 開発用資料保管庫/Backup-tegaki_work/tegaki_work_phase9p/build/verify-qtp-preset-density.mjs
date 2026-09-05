import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [qtpSource, cssSource] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8')
]);

assert.match(qtpSource, /Array\.from\(\{ length: QA_PRESET_SLOT_COUNT \}/, 'preset count must remain authority-driven');
assert.match(qtpSource, /class="qa-preset-slot-index"/, 'each preset slot must expose a compact index');
assert.match(qtpSource, /id="qa-preset-status"/, 'active summary must reuse the existing status row');
assert.match(qtpSource, /slot\.addEventListener\('focus'/, 'keyboard focus must preview a non-active preset');
assert.match(qtpSource, /slot\.addEventListener\('blur'/, 'blur must restore the active preset summary');
assert.match(qtpSource, /_previewPresetSlotSummary\(slot\)/, 'focus preview must be display-only');
assert.match(qtpSource, /_restorePresetSummary\(\)/, 'summary restore hook must remain explicit');
assert.match(qtpSource, /const activeIndex = isPresetEnabled[\s\S]*this\._clampSlotIndex\(this\.activePresetSlots\[presetKey\] \?\? 0\)/, 'active summary must reuse the existing safe slot clamp');
assert.match(qtpSource, /const index = this\._clampSlotIndex\(slot\?\.dataset\?\.slot\)/, 'focus preview must clamp its display index without mutation');
assert.match(qtpSource, /_selectPresetSlot\(index\)/, 'direct slot selection must remain unchanged');
assert.match(qtpSource, /_applyPreset\(preset, \{ updateSlotIndex: safeIndex, emit: true \}\)/, 'preset application authority must remain unchanged');
assert.match(qtpSource, /QA_STORAGE_KEYS\.presets/, 'preset localStorage authority must remain unchanged');
assert.match(qtpSource, /activeSlots/, 'tool-specific active slot persistence must remain present');
assert.match(qtpSource, /class="qa-preset-opacity-val"/, 'opacity value remains available to the DOM contract');
assert.match(qtpSource, /aria-label="スロット\$\{index \+ 1\}"/, 'slot buttons must remain accessible before hydration');

assert.match(cssSource, /--ui-qa-preset-height:\s*26px;/, 'compact preset height should use the B density');
assert.match(cssSource, /--ui-qa-preset-height:\s*32px;/, 'coarse preset height should retain a usable touch target');
assert.match(qtpSource, /\.qa-preset-opacity-val\s*\{[\s\S]*display:\s*none;/, 'non-active opacity values must not add a second dense row');
assert.match(qtpSource, /\.qa-preset-slot-index\s*\{[\s\S]*pointer-events:\s*none;/, 'slot index must not steal the preset hit area');

console.log('verify-qtp-preset-density: six-slot authority, compact active summary, focus preview and disabled contract OK');
