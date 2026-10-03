import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [qtpSource, cssSource, componentCss] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/quick-access-popup.css', import.meta.url), 'utf8')
]);

assert.match(qtpSource, /Array\.from\(\{ length: QA_PRESET_SLOT_COUNT \}/, 'preset count must remain authority-driven');
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
assert.match(componentCss, /#quick-access-popup\.qa-popup #qa-preset-section\s*\{\s*margin-top:\s*5px;/, 'the third shelf keeps its intentional gap from the secondary row');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-preset-status\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?clip:\s*rect\(/, 'the status remains available without reserving visible layout space');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-preset-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);[^}]*gap:\s*var\(--qa-slot-gap\);[^}]*width:\s*var\(--ui-qa-inner-width\);[^}]*padding:\s*0;[^}]*border:\s*0;/, 'third cells share the primary/secondary tracks without inset offsets');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-preset-slot\.active\s*\{[^}]*border-color:\s*var\(--qa-value-active-keyline\);[^}]*background:\s*var\(--qa-value-active-surface\);[^}]*box-shadow:\s*none;/, 'selected values share a contained orange keyline');
assert.match(componentCss, /--qa-value-active-foreground:\s*var\(--futaba-maroon\)/, 'second and third active values retain maroon foreground');
assert.match(componentCss, /--qa-value-active-surface:\s*color-mix\(in srgb, var\(--futaba-medium\) 20%, var\(--futaba-background\)\)/, 'concrete value selection stays light rather than inverted');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-preset-opacity-val\s*\{\s*display:\s*block;/, 'all slots expose opacity, not only the active slot');
assert.match(componentCss, /height:\s*max\(var\(--ui-qa-preset-height\), 36px\)/, 'preset cells reserve space for ring, size and opacity');
assert.match(componentCss, /\.qa-tool-grid\s*\{[^}]*margin:\s*0 auto;/, 'primary tabs have no vertical overlap into the secondary shelf');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-tool-button\.active\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--futaba-light-maroon\) 80%, var\(--futaba-medium\)\);[\s\S]*?color:\s*var\(--futaba-background\)/, 'primary active is the selected inverted B color candidate');

assert.match(cssSource, /--ui-qa-preset-height:\s*26px;/, 'compact preset height should use the B density');
assert.match(cssSource, /--ui-qa-preset-height:\s*32px;/, 'coarse preset height should retain a usable touch target');

console.log('verify-qtp-preset-density: six-slot authority, fixed shelf, accessible status, active states and focus preview OK');
