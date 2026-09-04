/**
 * ============================================================================
 * ファイル名: build/verify-layer-panel-animation-context-ux.mjs
 * 責務: レイヤーパネル アニメコンテキスト UI/UX再構築（C案：Frame Compass + CAF Parent Header）
 *       の階層構造、ボタンセマンティクス、インタラクション委譲、CSS寸法・配色契約を包括的に検証する
 * ============================================================================
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, timelineUi, icons, mainCss, componentCss] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/timeline-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-icons.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8')
]);

// ---------------------------------------------------------------------------
// 1. Structure: C案 hierarchy in LayerPanelRenderer.render()
// ---------------------------------------------------------------------------
assert.match(
    renderer,
    /const cafContextHeader = hasAnimationContext \? this\.createCafContextHeader\(\) : null;[\s\S]*?if \(cafContextHeader\) \{[\s\S]*?this\.container\.appendChild\(cafContextHeader\);[\s\S]*?if \(rigInspectorContext\) \{[\s\S]*?this\.container\.appendChild\(this\._createContextDockViewSwitch\(\)\);[\s\S]*?if \(isRigViewActive\) \{[\s\S]*?this\.container\.appendChild\(this\._createCafRigInspectorElement\(rigInspectorContext\)\);[\s\S]*?\} else if \(hasAnimationContext\) \{[\s\S]*?const cafLayerContent = this\.createCafLayerContent\(\);/u,
    'render() adopts C案 hierarchy: 1. CAF context header, 2. optional switch, 3. content body'
);

// Frame indicator is in #layer-panel-container, outside animation-content-group/layer-panel-items
assert.match(
    timelineUi,
    /layerContainer\.insertBefore\(frameIndicator, layerContainer\.firstChild\);/u,
    'frame-indicator is prepended directly to layer-panel-container as the top temporal compass'
);

// CAF identity exists and is retained even in RIG active view
assert.match(
    renderer,
    /createCafContextHeader\(\)\s*\{[\s\S]*?caf-simple-header--flat caf-context-header[\s\S]*?return header;\s*\}/u,
    'createCafContextHeader() generates independent CAF identity header'
);
assert.match(
    renderer,
    /createCafLayerContent\(\)\s*\{[\s\S]*?_createClipAssetLayerMirrorElement/u,
    'createCafLayerContent() generates content body mirror element independently'
);

// View Switch position: between CAF identity and Content Body
assert.match(
    renderer,
    /this\.container\.appendChild\(cafContextHeader\);[\s\S]*?this\.container\.appendChild\(this\._createContextDockViewSwitch\(\)\);[\s\S]*?appendChild\(this\._createCafRigInspectorElement/u,
    'View switch is located below CAF identity and above content body'
);

// Non-animation context: Animation Context UI is suppressed
assert.match(
    renderer,
    /const cafContextHeader = hasAnimationContext \? this\.createCafContextHeader\(\) : null;/u,
    'cafContextHeader is only rendered when animation context exists'
);
assert.match(
    timelineUi,
    /frameIndicator\.classList\.toggle\('is-visible', shouldShowIndicator\);/u,
    'frame indicator is hidden when no animation context exists'
);

// Table closed + animation context: remains visible
assert.match(
    timelineUi,
    /frameIndicator\.classList\.toggle\('is-table-closed', !isAnimationTableVisible && hasAnimationContext\);/u,
    'Table closed state retains frame indicator when animation context exists'
);

// ---------------------------------------------------------------------------
// 2. Button semantics
// ---------------------------------------------------------------------------
for (const id of [
    'frame-prev-btn',
    'frame-next-btn',
    'frame-display',
    'frame-play-toggle-btn',
    'frame-timeline-onion-btn',
    'frame-lane-reference-btn'
]) {
    assert.ok(timelineUi.includes(`id="${id}"`), `${id} ID is preserved`);
}

// Timeline Onion has Ghost icon
assert.match(
    timelineUi,
    /getOnionSkinIconHtml\(\)[\s\S]*?onionSkin/u,
    'Timeline Onion uses ghost icon'
);
// Lane Reference does NOT use Ghost icon, uses laneReference (rows-3)
assert.match(
    timelineUi,
    /getLaneReferenceIconHtml\(\)[\s\S]*?laneReference/u,
    'Lane Reference uses distinct laneReference icon'
);
assert.match(
    icons,
    /laneReference:\s*'<svg[\s\S]*?lucide-rows-3/u,
    'ui-icons defines laneReference as rows-3 SVG'
);
assert.doesNotMatch(
    timelineUi,
    /frame-lane-reference-btn[\s\S]*?getOnionSkinIconHtml\(\)/u,
    'Lane Reference button no longer shares ghost icon with timeline onion'
);

// Onion count 1-4
assert.match(
    timelineUi,
    /Math\.max\(1, Math\.min\(4, Math\.round\(animTable\.onionSkinFrameCount \|\| 1\)\)\)/u,
    'Timeline Onion count 1-4 preserved'
);

// ARIA and tooltips distinguish roles
assert.match(
    timelineUi,
    /laneReferenceBtn\.title = isLaneReferenceActive \? '他レーン参照: ON' : '他レーン参照: OFF';/u,
    'Lane Reference has dedicated Japanese tooltip'
);
assert.match(
    timelineUi,
    /timelineOnionBtn\.title = count > 0 \? `オニオンスキン: 前後\$\{count\}フレーム` : 'オニオンスキン: OFF';/u,
    'Timeline Onion has dedicated Japanese tooltip'
);
assert.match(
    timelineUi,
    /laneReferenceBtn\.setAttribute\('aria-pressed', isLaneReferenceActive \? 'true' : 'false'\);/u,
    'Lane Reference has aria-pressed attribute'
);
assert.match(
    timelineUi,
    /timelineOnionBtn\.setAttribute\('aria-pressed', count > 0 \? 'true' : 'false'\);/u,
    'Timeline Onion has aria-pressed attribute'
);

// Wheel handlers preserved
assert.match(
    timelineUi,
    /framePrevBtn\?\.addEventListener\('wheel', handleFrameWheel[\s\S]*?frameNextBtn\?\.addEventListener\('wheel', handleFrameWheel/u,
    'Frame nav wheel handlers preserved'
);
assert.match(
    timelineUi,
    /document\.getElementById\('frame-lane-reference-btn'\)\?\.addEventListener\('wheel'/u,
    'Lane Reference wheel handler preserved'
);
assert.match(
    timelineUi,
    /document\.getElementById\('frame-timeline-onion-btn'\)\?\.addEventListener\('wheel'/u,
    'Timeline Onion wheel handler preserved'
);

// ---------------------------------------------------------------------------
// 3. CAF interactions preserved
// ---------------------------------------------------------------------------
for (const handler of [
    '_toggleCafHeaderVisibilityFromClick',
    '_editCafHeaderNameFromClick',
    '_editCafHeaderLaneNameFromClick',
    '_toggleCafHeaderExpandedFromClick',
    '_selectCafAssetFromClick'
]) {
    assert.ok(renderer.includes(handler), `${handler} interaction delegation preserved`);
}

// ---------------------------------------------------------------------------
// 4. Visual contract & CSS
// ---------------------------------------------------------------------------
// Control size unified to --ui-frame-control-size
assert.match(
    mainCss,
    /\.frame-play-toggle-btn\s*\{[\s\S]*?width:\s*var\(--ui-frame-control-size\);[\s\S]*?height:\s*var\(--ui-frame-control-size\);/u,
    'play toggle button size unified to --ui-frame-control-size (no longer 18px)'
);
assert.match(
    mainCss,
    /\.frame-nav-btn\s*\{[\s\S]*?width:\s*var\(--ui-frame-control-size\);[\s\S]*?height:\s*var\(--ui-frame-control-size\);/u,
    'nav button size uses --ui-frame-control-size'
);
assert.match(
    mainCss,
    /\.frame-lane-reference-btn\s*\{[\s\S]*?width:\s*var\(--ui-frame-control-size\);[\s\S]*?height:\s*var\(--ui-frame-control-size\);/u,
    'lane reference button size uses --ui-frame-control-size'
);
assert.match(
    mainCss,
    /\.frame-timeline-onion-btn\s*\{[\s\S]*?width:\s*var\(--ui-frame-control-size\);[\s\S]*?height:\s*var\(--ui-frame-control-size\);/u,
    'timeline onion button size uses --ui-frame-control-size'
);

// Flex centering
assert.match(
    mainCss,
    /\.frame-indicator\s*\{[\s\S]*?align-items:\s*center;\s*justify-content:\s*center;/u,
    'frame indicator is centered with flex'
);
assert.match(
    mainCss,
    /\.frame-control-icon\s*\{[\s\S]*?display:\s*inline-flex;\s*align-items:\s*center;\s*justify-content:\s*center;/u,
    'frame control icon wrapper has flex centering'
);

// Gap between Frame Compass and CAF group
assert.match(
    mainCss,
    /\.layer-panel-container\.layer-panel-container--caf\s*\{[\s\S]*?row-gap:\s*3px;/u,
    'small 3px gap separates Frame Compass and CAF content group'
);

// Independent radii
assert.match(
    mainCss,
    /\.frame-indicator\s*\{[\s\S]*?border-radius:\s*6px;/u,
    'frame indicator has independent radius'
);
assert.match(
    componentCss,
    /\.caf-simple-group-title--flat\s*\{[\s\S]*?border-radius:\s*6px 6px 0 0;/u,
    'CAF identity has independent top radius'
);

// Lane reference active color distinguished from onion
assert.match(
    mainCss,
    /\.frame-lane-reference-btn\.is-active\s*\{[\s\S]*?background:\s*var\(--futaba-maroon\);[\s\S]*?color:\s*var\(--futaba-background\);/u,
    'lane reference active color uses futaba maroon background with contrasting foreground'
);

console.log('verify-layer-panel-animation-context-ux: C案 hierarchy, distinct Lane Reference icon/semantics, unified control sizes, and surface contracts OK');
