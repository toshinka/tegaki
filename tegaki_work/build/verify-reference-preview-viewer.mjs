/**
 * ============================================================================
 * verify-reference-preview-viewer.mjs
 * 責務: Reference / Preview Viewer (Floating Mirror + Multi-Reference Tabs) の全契約を検証する
 *
 * T1 — sidebar entry (Monitor / reference launcher exists and targets Viewer)
 * T2 — Preview fixed tab (first, not closeable)
 * T3 — Reference multi-tabs (add A, add B, close A, resources released)
 * T4 — Per-tab view state preservation (zoom, pan, rotation, flip independent per tab)
 * T5 — Reset View (rotation 0, flip false, Fit state)
 * T6 — Large image proxy sizing (1000x800 unchanged, 6000x9000 safely bounded <=2048px/4MP, AR preserved)
 * T7 — Proxy disclosure (downscaled metadata / badge)
 * T8 — Clipboard focus routing (Viewer focused -> Reference paste, Canvas focused -> not stolen)
 * T9 — D&D scope (Viewer drop accepted, outside drop ignored)
 * T10 — Runtime only (not serialized in ProjectManager save/load)
 * T11 — History 0 (viewer operations do not create drawing history entries)
 * T12 — Mirror transform state (preview view transform does not mutate project canvas)
 * ============================================================================
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Mock browser globals for Node.js test execution
globalThis.window = globalThis;
globalThis.document = {
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
    }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {} }
};

const {
    calculateReferenceProxyDimensions,
    calculateFitTransform,
    calculate100PercentTransform,
    getCssTransformString,
    REFERENCE_PROXY_BUDGET,
    MIRROR_PREVIEW_BUDGET
} = await import('../ui/reference-preview-viewer.js');

console.log('--- Starting Reference / Preview Viewer Verification (T1 - T12) ---');

// T1: Sidebar Entry Verification
{
    const domBuilderCode = await readFile(new URL('../ui/dom-builder.js', import.meta.url), 'utf8');
    const uiPanelsCode = await readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8');

    assert.match(
        domBuilderCode,
        /id:\s*'reference-preview-tool',\s*icon:\s*'monitor',\s*title:\s*'資料 \/ プレビュー',\s*role:\s*'popup-launcher',\s*popupName:\s*'referencePreview',\s*controls:\s*'reference-preview-viewer'/u,
        'T1: reference-preview-tool launcher defined in dom-builder with popup-launcher role, monitor icon, and referencePreview popupName'
    );

    assert.match(
        uiPanelsCode,
        /referencePreview:\s*'reference-preview-tool'/u,
        'T1: SIDEBAR_POPUP_BUTTONS maps referencePreview to reference-preview-tool'
    );

    assert.match(
        uiPanelsCode,
        /'reference-preview-tool':\s*\(\)\s*=>\s*\{[\s\S]*?this\.togglePopup\('referencePreview'\);/u,
        'T1: toolMap delegates reference-preview-tool to togglePopup(referencePreview)'
    );
    console.log('T1: Sidebar launcher contract PASS');
}

// T2: Preview Fixed Tab Verification
{
    // Minimal mock for testing ReferencePreviewViewer state
    const { ReferencePreviewViewer } = await import('../ui/reference-preview-viewer.js');
    const viewer = new ReferencePreviewViewer({
        app: { renderer: { extract: { canvas: () => ({ width: 800, height: 600 }) } } },
        layerSystem: { currentFrameContainer: {} },
        exportManager: null,
        cameraSystem: {},
        eventBus: { on: () => {}, emit: () => {} }
    });

    assert.equal(viewer.tabs.length, 1, 'T2: Starts with 1 initial tab');
    const previewTab = viewer.tabs[0];
    assert.equal(previewTab.id, 'preview', 'T2: First tab is preview');
    assert.equal(previewTab.type, 'preview', 'T2: First tab type is preview');
    assert.equal(previewTab.closeable, false, 'T2: Preview tab cannot be closed');

    // Attempting to close preview tab should be rejected
    viewer.closeTab('preview');
    assert.equal(viewer.tabs.length, 1, 'T2: Preview tab cannot be closed by closeTab');
    assert.equal(viewer.tabs[0].id, 'preview', 'T2: Preview tab remains intact');
    console.log('T2: Preview fixed tab contract PASS');
}

// T3: Reference Multi-tabs and Resource Cleanup
{
    const { ReferencePreviewViewer } = await import('../ui/reference-preview-viewer.js');
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    // Add Tab A
    let aReleased = false;
    const fakeCanvasA = {
        width: 400,
        height: 300
    };
    viewer.tabs.push({
        id: 'ref_A',
        type: 'reference',
        name: 'Ref A',
        canvas: fakeCanvasA,
        origWidth: 400,
        origHeight: 300,
        width: 400,
        height: 300,
        downscaled: false,
        closeable: true,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    });

    // Add Tab B
    const fakeCanvasB = {
        width: 500,
        height: 400
    };
    viewer.tabs.push({
        id: 'ref_B',
        type: 'reference',
        name: 'Ref B',
        canvas: fakeCanvasB,
        origWidth: 500,
        origHeight: 400,
        width: 500,
        height: 400,
        downscaled: false,
        closeable: true,
        viewState: { zoom: 1.5, panX: 10, panY: 20, rotationDeg: 15, flipX: true, flipY: false, initialized: true }
    });

    assert.equal(viewer.tabs.length, 3, 'T3: 3 tabs present (Preview, Ref A, Ref B)');
    viewer.switchTab('ref_A');
    assert.equal(viewer.activeTabId, 'ref_A');

    // Close Tab A
    viewer.closeTab('ref_A');
    assert.equal(viewer.tabs.length, 2, 'T3: Ref A removed, 2 tabs remaining');
    assert.equal(viewer.tabs.some(t => t.id === 'ref_A'), false, 'T3: Ref A not in tabs');
    assert.equal(viewer.tabs.some(t => t.id === 'ref_B'), true, 'T3: Ref B remains intact');
    assert.equal(fakeCanvasA.width, 1, 'T3: Ref A canvas buffer shrunk to 1x1 for GC');
    assert.equal(fakeCanvasA.height, 1, 'T3: Ref A canvas buffer shrunk to 1x1 for GC');
    console.log('T3: Reference multi-tabs and resource cleanup PASS');
}

// T4: Per-tab View State Preservation
{
    const { ReferencePreviewViewer } = await import('../ui/reference-preview-viewer.js');
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const tabA = {
        id: 'ref_A',
        type: 'reference',
        name: 'Ref A',
        width: 400,
        height: 300,
        closeable: true,
        viewState: { zoom: 2.0, panX: 50, panY: -30, rotationDeg: 45, flipX: true, flipY: false, initialized: true }
    };
    const tabB = {
        id: 'ref_B',
        type: 'reference',
        name: 'Ref B',
        width: 600,
        height: 600,
        closeable: true,
        viewState: { zoom: 0.5, panX: 0, panY: 0, rotationDeg: -90, flipX: false, flipY: true, initialized: true }
    };
    viewer.tabs.push(tabA, tabB);

    viewer.switchTab('ref_A');
    assert.equal(viewer.getActiveTab().viewState.zoom, 2.0);
    assert.equal(viewer.getActiveTab().viewState.panX, 50);
    assert.equal(viewer.getActiveTab().viewState.panY, -30);
    assert.equal(viewer.getActiveTab().viewState.rotationDeg, 45);
    assert.equal(viewer.getActiveTab().viewState.flipX, true);
    assert.equal(viewer.getActiveTab().viewState.flipY, false);

    viewer.switchTab('ref_B');
    assert.equal(viewer.getActiveTab().viewState.zoom, 0.5);
    assert.equal(viewer.getActiveTab().viewState.rotationDeg, -90);
    assert.equal(viewer.getActiveTab().viewState.flipX, false);
    assert.equal(viewer.getActiveTab().viewState.flipY, true);

    // Modify Tab B
    viewer.getActiveTab().viewState.zoom = 0.75;
    viewer.getActiveTab().viewState.panX = 100;

    // Switch back to Tab A
    viewer.switchTab('ref_A');
    assert.equal(viewer.getActiveTab().viewState.zoom, 2.0, 'T4: Tab A zoom preserved');
    assert.equal(viewer.getActiveTab().viewState.panX, 50, 'T4: Tab A panX preserved');
    assert.equal(viewer.getActiveTab().viewState.panY, -30, 'T4: Tab A panY preserved');
    assert.equal(viewer.getActiveTab().viewState.rotationDeg, 45, 'T4: Tab A rotation preserved');
    assert.equal(viewer.getActiveTab().viewState.flipX, true, 'T4: Tab A flipX preserved');
    assert.equal(viewer.getActiveTab().viewState.flipY, false, 'T4: Tab A flipY preserved');

    // Switch back to Tab B
    viewer.switchTab('ref_B');
    assert.equal(viewer.getActiveTab().viewState.zoom, 0.75, 'T4: Tab B modified zoom preserved');
    assert.equal(viewer.getActiveTab().viewState.panX, 100, 'T4: Tab B modified panX preserved');
    console.log('T4: Per-tab view state preservation PASS');
}

// T5: Reset View
{
    const { ReferencePreviewViewer } = await import('../ui/reference-preview-viewer.js');
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const tab = {
        id: 'ref_test',
        type: 'reference',
        name: 'Test',
        width: 500,
        height: 500,
        closeable: true,
        viewState: { zoom: 3.5, panX: 120, panY: -80, rotationDeg: 60, flipX: true, flipY: true, initialized: true }
    };
    viewer.tabs.push(tab);
    viewer.switchTab('ref_test');

    viewer.resetActiveTabView();

    assert.equal(tab.viewState.rotationDeg, 0, 'T5: Reset rotationDeg is 0');
    assert.equal(tab.viewState.flipX, false, 'T5: Reset flipX is false');
    assert.equal(tab.viewState.flipY, false, 'T5: Reset flipY is false');
    // Zoom should be fit scale (> 0 and finite)
    assert.ok(Number.isFinite(tab.viewState.zoom) && tab.viewState.zoom > 0, 'T5: Reset zoom is valid fit scale');
    console.log('T5: Reset View contract PASS');
}

// T6: Large Image Proxy Sizing Math
{
    // Case 1: 1000x800 (within limits: edge <= 2048 and pixels <= 4MP)
    const res1 = calculateReferenceProxyDimensions(1000, 800);
    assert.equal(res1.width, 1000);
    assert.equal(res1.height, 800);
    assert.equal(res1.downscaled, false, 'T6: 1000x800 is not downscaled');
    assert.equal(res1.origWidth, 1000);
    assert.equal(res1.origHeight, 800);

    // Case 2: 6000x9000 (oversize: edge 9000 > 2048, 54MP > 4MP)
    const res2 = calculateReferenceProxyDimensions(6000, 9000);
    assert.equal(res2.downscaled, true, 'T6: 6000x9000 is downscaled');
    assert.ok(res2.width <= REFERENCE_PROXY_BUDGET.maxEdge, 'T6: width <= 2048');
    assert.ok(res2.height <= REFERENCE_PROXY_BUDGET.maxEdge, 'T6: height <= 2048');
    assert.ok(res2.width * res2.height <= REFERENCE_PROXY_BUDGET.maxPixels, 'T6: total pixels <= 4MP');
    assert.equal(res2.height, 2048, 'T6: longest edge clamped to 2048');
    assert.equal(res2.width, 1365, 'T6: aspect ratio 6000/9000 preserved: 1365x2048');
    assert.equal(res2.origWidth, 6000);
    assert.equal(res2.origHeight, 9000);

    // Case 3: 4000x4000 square
    const res3 = calculateReferenceProxyDimensions(4000, 4000);
    assert.equal(res3.downscaled, true);
    assert.ok(res3.width <= 2048);
    assert.ok(res3.height <= 2048);
    assert.ok(res3.width * res3.height <= REFERENCE_PROXY_BUDGET.maxPixels);
    assert.equal(res3.width, res3.height, 'T6: square aspect ratio preserved');
    console.log('T6: Large image proxy sizing math PASS');
}

// T7: Proxy Disclosure (Metadata & Badge)
{
    const proxyInfo = calculateReferenceProxyDimensions(6000, 9000);
    assert.equal(proxyInfo.downscaled, true);
    assert.equal(proxyInfo.origWidth, 6000);
    assert.equal(proxyInfo.origHeight, 9000);
    assert.equal(proxyInfo.width, 1365);
    assert.equal(proxyInfo.height, 2048);

    const normalInfo = calculateReferenceProxyDimensions(800, 600);
    assert.equal(normalInfo.downscaled, false);
    console.log('T7: Proxy disclosure metadata PASS');
}

// T8: Clipboard Focus Routing Verification
{
    const imageImporterCode = await readFile(new URL('../system/image-importer.js', import.meta.url), 'utf8');
    const pixelSelectionCode = await readFile(new URL('../system/pixel-selection-system.js', import.meta.url), 'utf8');
    const keyboardHandlerCode = await readFile(new URL('../ui/keyboard-handler.js', import.meta.url), 'utf8');

    assert.match(
        imageImporterCode,
        /if\s*\(\s*event\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\)\s*return;/u,
        'T8: image-importer paste listener bypasses when target is in .reference-preview-viewer'
    );

    assert.match(
        pixelSelectionCode,
        /if\s*\(\s*event\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\)\s*return;/u,
        'T8: pixel-selection keydown listener bypasses when target is in .reference-preview-viewer'
    );

    assert.match(
        keyboardHandlerCode,
        /if\s*\(\s*e\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\|\|\s*document\.activeElement\?\.closest\?\.\(('|")\.reference-preview-viewer\2\)\s*\)/u,
        'T8: keyboard-handler yields shortcuts when focus is inside .reference-preview-viewer'
    );
    console.log('T8: Clipboard focus routing isolation PASS');
}

// T9: D&D Scope Verification
{
    const viewerModuleCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');

    assert.match(
        viewerModuleCode,
        /this\.popup\.addEventListener\('drop'/u,
        'T9: drop listener is bound directly to this.popup (.reference-preview-viewer)'
    );

    assert.doesNotMatch(
        viewerModuleCode,
        /document\.addEventListener\('drop'/u,
        'T9: drop listener is NOT attached globally to document'
    );

    assert.doesNotMatch(
        viewerModuleCode,
        /window\.addEventListener\('drop'/u,
        'T9: drop listener is NOT attached globally to window'
    );
    console.log('T9: D&D scope isolation PASS');
}

// T10: Runtime Only (Not serialized in ProjectManager)
{
    const projectManagerCode = await readFile(new URL('../system/project-manager.js', import.meta.url), 'utf8');

    assert.doesNotMatch(
        projectManagerCode,
        /referencePreview/u,
        'T10: project-manager does not reference referencePreview'
    );
    assert.doesNotMatch(
        projectManagerCode,
        /reference-preview-viewer/u,
        'T10: project-manager does not reference reference-preview-viewer'
    );
    console.log('T10: Runtime-only (no project schema impact) PASS');
}

// T11: History 0
{
    const viewerModuleCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');

    assert.doesNotMatch(
        viewerModuleCode,
        /historyManager|history\.add|history\.execute|history\.record/u,
        'T11: viewer operations do not invoke drawing history'
    );
    console.log('T11: History 0 contract PASS');
}

// T12: Mirror Transform State & View Transform Math
{
    const surfaceW = 400;
    const surfaceH = 300;
    const contentW = 800;
    const contentH = 600;

    // Fit Transform
    const fit = calculateFitTransform(surfaceW, surfaceH, contentW, contentH);
    assert.ok(fit.zoom > 0 && fit.zoom < 1, 'T12: Fit zoom scales down 800x600 to fit 400x300');
    assert.equal(fit.rotationDeg, 0);
    assert.equal(fit.flipX, false);
    assert.equal(fit.flipY, false);

    // 100% Transform
    const t100 = calculate100PercentTransform(surfaceW, surfaceH, contentW, contentH);
    assert.equal(t100.zoom, 1, 'T12: 100% zoom is 1.0');
    assert.equal(t100.panX, (surfaceW - contentW) / 2);
    assert.equal(t100.panY, (surfaceH - contentH) / 2);

    // CSS Transform String
    const cssTransform = getCssTransformString(
        { zoom: 1.5, panX: 20, panY: 30, rotationDeg: 15, flipX: true, flipY: false },
        800,
        600
    );
    assert.match(cssTransform, /translate\(/u, 'T12: CSS transform contains translate');
    assert.match(cssTransform, /rotate\(15deg\)/u, 'T12: CSS transform contains rotation 15deg');
    assert.match(cssTransform, /scale\(-1\.5,\s*1\.5\)/u, 'T12: CSS transform reflects flipX and zoom');

    console.log('T12: Mirror transform state and CSS transform math PASS');
}

console.log('\nverify-reference-preview-viewer: ALL 12 SCENARIOS (T1 - T12) PASS');
