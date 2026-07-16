/**
 * ============================================================================
 * ファイル名: ui/dom-builder.js
 * 責務: アプリケーションのUI構造（サイドバー、パネル、ポップアップ）をDOMで構築する
 * 依存: ui/ui-icons.js
 * 被依存: core-initializer.js, ui-panels.js等
 * 公開API: DOMBuilder
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.DOMBuilder
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { UI_ICONS } from './ui-icons.js';

export const DOMBuilder = (function() {
    'use strict';

    // SVGアイコン定義 (ui-icons.js へ移行。後方互換性のために一部参照を維持)
    const ICONS = UI_ICONS;

    // ヘルパー: 要素作成

    // ヘルパー: 要素作成
    function createElement(tag, options = {}) {
        const el = document.createElement(tag);
        if (options.id) el.id = options.id;
        if (options.className) el.className = options.className;
        if (options.innerHTML) el.innerHTML = options.innerHTML;
        if (options.textContent) el.textContent = options.textContent;
        if (options.title) el.title = options.title;
        if (options.style) Object.assign(el.style, options.style);
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                el.setAttribute(key, value);
            });
        }
        return el;
    }

    function createCloseButton(popupId, options = {}) {
        const btn = createElement('button', {
            className: options.className || 'ui-close-button ui-close-button--medium popup-close-btn',
            innerHTML: ICONS.close,
            title: options.title || '閉じる',
            attributes: {
                type: 'button',
                'aria-label': options.ariaLabel || options.title || '閉じる'
            }
        });

        // クリックイベントは UIController で一括処理できるように data 属性を付与
        btn.dataset.action = 'close-popup';
        btn.dataset.target = popupId;

        return btn;
    }

    // サイドバー構築
    function buildSidebar() {
        const sidebar = createElement('div', { className: 'sidebar' });

        const tools = [
            { id: 'library-tool', icon: 'library', title: 'アルバム保管' },
            { id: 'image-import-tool', icon: 'load', title: '画像をアクティブレイヤーへ読み込み' },
            { id: 'export-tool', icon: 'export', title: '画像・アニメ出力' },
            { separator: true },
            { id: 'resize-tool', icon: 'resize', title: 'リサイズ' },
            { separator: true },
            { id: 'pen-tool', icon: 'pen', title: 'ペン (P / Shift+Pで筆圧切替 / Shift+ドラッグで直線)', active: true },
            { id: 'eraser-tool', icon: 'eraser', title: '消しゴム (E / Shift+ドラッグで直線)' },
            { id: 'airbrush-tool', icon: 'airbrush', title: 'スプレー / 透明スプレー (B)' },
            { id: 'fill-tool', icon: 'fill', title: '塗りつぶし (G)' },
            { id: 'selection-tool', icon: 'rectangleSelect', title: '矩形選択 (M)' },
            { separator: true },
            { id: 'gif-animation-tool', icon: 'animation', title: 'GIFアニメーション (Alt+A)' },
            { separator: true },
            { id: 'settings-tool', icon: 'settings', title: '設定 (S)' }
        ];

        tools.forEach(tool => {
            if (tool.separator) {
                sidebar.appendChild(createElement('div', { className: 'tool-separator' }));
            } else {
                const iconHtml = tool.textIcon
                    ? `<span class="tool-button-text-icon">${tool.textIcon}</span>`
                    : ICONS[tool.icon];

                const btn = createElement('div', {
                    className: tool.active ? 'tool-button active' : 'tool-button',
                    id: tool.id,
                    title: tool.title,
                    innerHTML: iconHtml || ''
                });
                sidebar.appendChild(btn);
            }
        });

        return sidebar;
    }

    // キャンバスエリア構築
    function buildCanvasArea() {
        const canvasArea = createElement('div', { className: 'canvas-area' });
        const drawingCanvas = createElement('div', { id: 'drawing-canvas' });
        canvasArea.appendChild(drawingCanvas);

        // 反転警告コンテナ
        const warningContainer = createElement('div', { className: 'canvas-warning-container', id: 'canvas-warning-container' });
        canvasArea.appendChild(warningContainer);

        return canvasArea;
    }

    // ポップアップパネル: ペン設定（レガシー・非表示）
    function buildPenSettingsPopup() {
        const popup = createElement('div', {
            className: 'popup-panel popup-panel--translucent',
            id: 'legacy-pen-settings',
            style: { left: '60px', top: '100px', display: 'none' }
        });

        popup.appendChild(createCloseButton('legacy-pen-settings'));
        const title = createElement('div', { className: 'popup-title', textContent: 'ベクターペンツール設定（レガシー）' });
        popup.appendChild(title);

        // サイズ設定
        const sizeGroup = createElement('div', { className: 'setting-group' });
        sizeGroup.appendChild(createElement('div', { className: 'setting-label', textContent: 'サイズ' }));
        
        const sizeContainer = createElement('div', { className: 'slider-container' });
        const sizeSlider = createElement('div', { className: 'slider', id: 'legacy-pen-size-slider' });
        sizeSlider.appendChild(createElement('div', { className: 'slider-track', id: 'legacy-pen-size-track' }));
        sizeSlider.appendChild(createElement('div', { className: 'slider-handle', id: 'legacy-pen-size-handle' }));
        sizeContainer.appendChild(sizeSlider);
        sizeContainer.appendChild(createElement('div', { className: 'slider-value', id: 'legacy-pen-size-value', textContent: '16.0px' }));
        sizeGroup.appendChild(sizeContainer);
        popup.appendChild(sizeGroup);

        // 不透明度設定
        const opacityGroup = createElement('div', { className: 'setting-group' });
        opacityGroup.appendChild(createElement('div', { className: 'setting-label', textContent: '不透明度' }));
        
        const opacityContainer = createElement('div', { className: 'slider-container' });
        const opacitySlider = createElement('div', { className: 'slider', id: 'legacy-pen-opacity-slider' });
        opacitySlider.appendChild(createElement('div', { className: 'slider-track', id: 'legacy-pen-opacity-track' }));
        opacitySlider.appendChild(createElement('div', { className: 'slider-handle', id: 'legacy-pen-opacity-handle' }));
        opacityContainer.appendChild(opacitySlider);
        opacityContainer.appendChild(createElement('div', { className: 'slider-value', id: 'legacy-pen-opacity-value', textContent: '85.0%' }));
        opacityGroup.appendChild(opacityContainer);
        popup.appendChild(opacityGroup);

        return popup;
    }

    function buildExportPopup() {
        const popup = createElement('div', {
            className: 'popup-panel popup-panel--translucent',
            id: 'export-popup',
            style: { left: '60px', top: '10px' }
        });

        popup.appendChild(createCloseButton('export-popup'));
        popup.appendChild(createElement('div', { className: 'popup-title', textContent: '画像・アニメ出力' }));

        const formatSelection = createElement('div', { className: 'format-selection' });
        ['png', 'gif', 'webp', 'psd'].forEach((fmt) => {
            const btn = createElement('button', {
                className: fmt === 'png' ? 'format-btn selected' : 'format-btn',
                textContent: fmt.toUpperCase(),
                attributes: { 'data-format': fmt }
            });
            formatSelection.appendChild(btn);
        });
        popup.appendChild(formatSelection);

        const exportOptions = createElement('div', {
            className: 'export-options',
            id: 'export-options'
        });
        exportOptions.appendChild(createElement('div', { className: 'setting-label', textContent: 'PNG出力' }));
        exportOptions.appendChild(createElement('div', {
            className: 'export-option-description',
            textContent: '現在のキャンバス状態をPNG画像として出力します。'
        }));
        popup.appendChild(exportOptions);

        const progress = createElement('div', { className: 'export-progress', id: 'export-progress', style: { display: 'none' } });
        const progressBar = createElement('div', { className: 'progress-bar' });
        progressBar.appendChild(createElement('div', { className: 'progress-fill' }));
        progress.appendChild(progressBar);
        progress.appendChild(createElement('div', { className: 'progress-text', textContent: '0%' }));
        popup.appendChild(progress);

        const previewContainer = createElement('div', {
            className: 'preview-container ui-scrollbar',
            id: 'preview-container',
            style: { display: 'none' }
        });
        previewContainer.appendChild(createElement('img', { id: 'preview-image', attributes: { alt: 'Preview' } }));
        popup.appendChild(previewContainer);

        popup.appendChild(createElement('div', {
            className: 'export-status',
            id: 'export-status',
            style: { display: 'none' }
        }));

        const actions = createElement('div', { className: 'export-actions' });
        actions.appendChild(createElement('button', { className: 'action-button', id: 'export-execute', textContent: 'ダウンロード' }));
        actions.appendChild(createElement('button', { className: 'action-button secondary', id: 'export-preview', textContent: 'プレビュー' }));
        popup.appendChild(actions);

        return popup;
    }

    function buildResizePopup() {
        const popup = createElement('div', {
            className: 'popup-panel popup-panel--translucent resize-popup-compact',
            id: 'resize-settings',
            style: { left: '60px', top: '150px' }
        });

        popup.appendChild(createCloseButton('resize-settings'));
        
        const widthGroup = createElement('div', { className: 'resize-compact-group' });
        
        const widthLabel = createElement('div', { className: 'resize-compact-label', textContent: '幅' });
        widthGroup.appendChild(widthLabel);

        const widthAlignRow = createElement('div', { className: 'resize-align-row' });
        const hAlignBtns = [
            { id: 'horizontal-align-left', text: '←' },
            { id: 'horizontal-align-center', text: '⇔', active: true },
            { id: 'horizontal-align-right', text: '→' }
        ];
        hAlignBtns.forEach(btn => {
            widthAlignRow.appendChild(createElement('button', {
                className: btn.active ? 'resize-align-btn active' : 'resize-align-btn',
                id: btn.id,
                textContent: btn.text
            }));
        });
        widthGroup.appendChild(widthAlignRow);

        const widthSliderRow = createElement('div', { className: 'resize-slider-row' });
        widthSliderRow.appendChild(createElement('button', { className: 'resize-arrow-btn', id: 'width-decrease', textContent: '◀' }));
        const widthSlider = createElement('div', { className: 'resize-slider', id: 'canvas-width-slider' });
        widthSlider.appendChild(createElement('div', { className: 'resize-slider-track', id: 'canvas-width-track' }));
        widthSlider.appendChild(createElement('div', { className: 'resize-slider-handle', id: 'canvas-width-handle' }));
        widthSliderRow.appendChild(widthSlider);
        widthSliderRow.appendChild(createElement('button', { className: 'resize-arrow-btn', id: 'width-increase', textContent: '▶' }));
        widthGroup.appendChild(widthSliderRow);

        const widthValueRow = createElement('div', { className: 'resize-value-row' });
        widthValueRow.appendChild(createElement('span', { className: 'resize-value-display', id: 'canvas-width-display', textContent: '400px' }));
        widthGroup.appendChild(widthValueRow);

        popup.appendChild(widthGroup);

        const heightGroup = createElement('div', { className: 'resize-compact-group' });
        
        const heightLabel = createElement('div', { className: 'resize-compact-label', textContent: '高さ' });
        heightGroup.appendChild(heightLabel);

        const heightAlignRow = createElement('div', { className: 'resize-align-row' });
        const vAlignBtns = [
            { id: 'vertical-align-top', text: '↑' },
            { id: 'vertical-align-center', text: '⇕', active: true },
            { id: 'vertical-align-bottom', text: '↓' }
        ];
        vAlignBtns.forEach(btn => {
            heightAlignRow.appendChild(createElement('button', {
                className: btn.active ? 'resize-align-btn active' : 'resize-align-btn',
                id: btn.id,
                textContent: btn.text
            }));
        });
        heightGroup.appendChild(heightAlignRow);

        const heightSliderRow = createElement('div', { className: 'resize-slider-row' });
        heightSliderRow.appendChild(createElement('button', { className: 'resize-arrow-btn', id: 'height-decrease', textContent: '◀' }));
        const heightSlider = createElement('div', { className: 'resize-slider', id: 'canvas-height-slider' });
        heightSlider.appendChild(createElement('div', { className: 'resize-slider-track', id: 'canvas-height-track' }));
        heightSlider.appendChild(createElement('div', { className: 'resize-slider-handle', id: 'canvas-height-handle' }));
        heightSliderRow.appendChild(heightSlider);
        heightSliderRow.appendChild(createElement('button', { className: 'resize-arrow-btn', id: 'height-increase', textContent: '▶' }));
        heightGroup.appendChild(heightSliderRow);

        const heightValueRow = createElement('div', { className: 'resize-value-row' });
        heightValueRow.appendChild(createElement('span', { className: 'resize-value-display', id: 'canvas-height-display', textContent: '400px' }));
        heightGroup.appendChild(heightValueRow);

        popup.appendChild(heightGroup);

        const presetGroup = createElement('div', { className: 'resize-preset-group' });
        const presets = [
            { width: 344, height: 135, label: '344×135' },
            { width: 400, height: 400, label: '400×400' },
            { width: 800, height: 600, label: '800×600' }
        ];
        presets.forEach(preset => {
            const btn = createElement('button', {
                className: 'resize-preset-btn',
                textContent: preset.label,
                attributes: { 'data-width': preset.width, 'data-height': preset.height }
            });
            presetGroup.appendChild(btn);
        });
        popup.appendChild(presetGroup);

        const applyBtn = createElement('button', {
            className: 'resize-apply-btn',
            id: 'apply-resize',
            textContent: 'リサイズ実行'
        });
        popup.appendChild(applyBtn);

        popup.appendChild(createElement('input', {
            className: 'resize-hidden-input',
            id: 'canvas-width-input',
            attributes: { type: 'hidden' }
        }));
        popup.appendChild(createElement('input', {
            className: 'resize-hidden-input',
            id: 'canvas-height-input',
            attributes: { type: 'hidden' }
        }));

        return popup;
    }

    function buildSettingsPopup() {
        const popup = createElement('div', {
            className: 'popup-panel popup-panel--translucent ui-scrollbar',
            id: 'settings-popup',
            style: { left: '60px', top: '250px' }
        });

        popup.appendChild(createCloseButton('settings-popup'));
        return popup;
    }


    function buildLayerTransformPanel() {
        const panel = createElement('div', {
            className: 'layer-transform-panel transform-popup-shell',
            id: 'layer-transform-panel'
        });

        const header = createElement('div', { className: 'transform-popup-header' });
        const heading = createElement('div', { className: 'transform-popup-heading' });
        heading.appendChild(createElement('span', {
            className: 'transform-popup-title',
            textContent: 'LAYER TRANSFORM'
        }));
        heading.appendChild(createElement('span', {
            className: 'layer-transform-context-note',
            id: 'layer-transform-context-note',
            textContent: 'CAF原画編集 / Motion非表示'
        }));

        const flipGroup = createElement('div', { className: 'flip-section transform-popup-actions' });
        flipGroup.appendChild(createElement('div', { className: 'flip-button flip-button--icon', id: 'flip-horizontal-btn', title: '左右反転', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>' }));
        flipGroup.appendChild(createElement('div', { className: 'flip-button flip-button--icon', id: 'flip-vertical-btn', title: '上下反転', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/></svg>' }));
        flipGroup.appendChild(createElement('div', { className: 'flip-button flip-button--icon transform-anchor-toggle', id: 'layer-transform-anchor-btn', title: '回転・拡縮中心を移動。中心マークは常時表示され、ON中だけドラッグできます', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/></svg>' }));
        flipGroup.appendChild(createElement('div', { className: 'flip-button flip-button--icon', id: 'layer-transform-reset-btn', title: '変形をリセット', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>' }));
        header.appendChild(heading);
        header.appendChild(flipGroup);
        panel.appendChild(header);

        const sections = createElement('div', { className: 'panel-sections' });

        const posSection = createElement('div', { className: 'panel-section' });
        const posGroup = createElement('div', { className: 'compact-slider-group' });
        
        const xSlider = createElement('div', { className: 'compact-slider' });
        xSlider.appendChild(createElement('div', { className: 'compact-slider-label', textContent: 'X' }));
        const xSliderEl = createElement('div', { className: 'slider', id: 'layer-x-slider' });
        xSliderEl.appendChild(createElement('div', { className: 'slider-track' }));
        xSliderEl.appendChild(createElement('div', { className: 'slider-handle' }));
        xSlider.appendChild(xSliderEl);
        xSlider.appendChild(createElement('div', { className: 'slider-value', id: 'layer-x-value', textContent: '0px' }));
        posGroup.appendChild(xSlider);

        const ySlider = createElement('div', { className: 'compact-slider' });
        ySlider.appendChild(createElement('div', { className: 'compact-slider-label', textContent: 'Y' }));
        const ySliderEl = createElement('div', { className: 'slider', id: 'layer-y-slider' });
        ySliderEl.appendChild(createElement('div', { className: 'slider-track' }));
        ySliderEl.appendChild(createElement('div', { className: 'slider-handle' }));
        ySlider.appendChild(ySliderEl);
        ySlider.appendChild(createElement('div', { className: 'slider-value', id: 'layer-y-value', textContent: '0px' }));
        posGroup.appendChild(ySlider);

        posSection.appendChild(posGroup);
        sections.appendChild(posSection);

        const transSection = createElement('div', { className: 'panel-section' });
        const transGroup = createElement('div', { className: 'compact-slider-group' });

        const rotSlider = createElement('div', { className: 'compact-slider' });
        rotSlider.appendChild(createElement('div', { className: 'compact-slider-label', textContent: '回転' }));
        const rotSliderEl = createElement('div', { className: 'slider', id: 'layer-rotation-slider' });
        rotSliderEl.appendChild(createElement('div', { className: 'slider-track' }));
        rotSliderEl.appendChild(createElement('div', { className: 'slider-handle' }));
        rotSlider.appendChild(rotSliderEl);
        rotSlider.appendChild(createElement('div', { className: 'slider-value', id: 'layer-rotation-value', textContent: '0°' }));
        transGroup.appendChild(rotSlider);

        const scaleSlider = createElement('div', { className: 'compact-slider' });
        scaleSlider.appendChild(createElement('div', { className: 'compact-slider-label', textContent: '拡縮' }));
        const scaleSliderEl = createElement('div', { className: 'slider', id: 'layer-scale-slider' });
        scaleSliderEl.appendChild(createElement('div', { className: 'slider-track' }));
        scaleSliderEl.appendChild(createElement('div', { className: 'slider-handle' }));
        scaleSlider.appendChild(scaleSliderEl);
        scaleSlider.appendChild(createElement('div', { className: 'slider-value', id: 'layer-scale-value', textContent: '1.00x' }));
        transGroup.appendChild(scaleSlider);

        transSection.appendChild(transGroup);
        sections.appendChild(transSection);

        panel.appendChild(sections);
        return panel;
    }

    function buildStatusPanel() {
        const panel = createElement('div', { className: 'status-panel' });

        const group1 = createElement('div', { className: 'status-group' });
        const items1 = [
            { label: 'Canvas:', id: 'canvas-info', value: '400×400px' },
            { label: 'Tool:', id: 'current-tool', value: 'ペン（筆圧ON）' },
            { label: 'Layer:', id: 'current-layer', value: 'レイヤー1' },
            { label: '座標:', id: 'coordinates', value: 'X: 0, Y: 0' }
        ];
        items1.forEach(item => {
            const statusItem = createElement('div', { className: 'status-item' });
            statusItem.appendChild(document.createTextNode(item.label + ' '));
            statusItem.appendChild(createElement('span', { id: item.id, textContent: item.value }));
            group1.appendChild(statusItem);
        });
        panel.appendChild(group1);

        const group2 = createElement('div', { className: 'status-group' });
        const items2 = [
            { label: 'FPS:', id: 'fps-info', value: '60' },
            { label: 'History:', id: 'history-info', value: '0/500' }
        ];
        items2.forEach(item => {
            const statusItem = createElement('div', { className: 'status-item' });
            statusItem.appendChild(document.createTextNode(item.label + ' '));
            statusItem.appendChild(createElement('span', { id: item.id, textContent: item.value }));
            group2.appendChild(statusItem);
        });
        panel.appendChild(group2);

        return panel;
    }

    function buildLayerPanel() {
        const container = createElement('div', {
            className: 'layer-panel-container',
            id: 'layer-panel-container'
        });

        const controlsRow = createElement('div', { className: 'layer-controls-row' });
        
        const addLayerBtn = createElement('div', {
            className: 'layer-add-button',
            id: 'add-layer-btn',
            title: 'レイヤー追加 (Ctrl+L)',
            innerHTML: ICONS.plus
        });
        controlsRow.appendChild(addLayerBtn);

        const addFolderBtn = createElement('div', {
            className: 'folder-add-button',
            id: 'add-folder-btn',
            title: 'フォルダ追加',
            innerHTML: ICONS.folderPlus
        });
        controlsRow.appendChild(addFolderBtn);

        const layerAttributeBtn = createElement('button', {
            className: 'ui-icon-button ui-icon-button--medium layer-op-button',
            id: 'layer-attribute-panel-btn',
            title: 'アクティブレイヤー属性',
            innerHTML: ICONS.slidersHorizontal,
            attributes: {
                type: 'button',
                'aria-label': 'アクティブレイヤー属性'
            }
        });
        controlsRow.appendChild(layerAttributeBtn);

        const duplicateLayerBtn = createElement('button', {
            className: 'ui-icon-button ui-icon-button--medium layer-op-button',
            id: 'duplicate-active-layer-btn',
            title: 'アクティブレイヤーを複製',
            innerHTML: ICONS.duplicate,
            attributes: {
                type: 'button',
                'aria-label': 'アクティブレイヤーを複製'
            }
        });
        controlsRow.appendChild(duplicateLayerBtn);

        const mergeLayerBtn = createElement('button', {
            className: 'ui-icon-button ui-icon-button--medium layer-op-button',
            id: 'merge-active-layer-btn',
            title: 'アクティブレイヤーを下のレイヤーと結合',
            innerHTML: ICONS.mergeDown,
            attributes: {
                type: 'button',
                'aria-label': 'アクティブレイヤーを下のレイヤーと結合'
            }
        });
        controlsRow.appendChild(mergeLayerBtn);

        const deleteLayerBtn = createElement('button', {
            className: 'ui-icon-button ui-icon-button--medium layer-op-button layer-op-danger',
            id: 'delete-active-layer-btn',
            title: 'アクティブレイヤーを削除',
            innerHTML: ICONS.trash,
            attributes: {
                type: 'button',
                'aria-label': 'アクティブレイヤーを削除'
            }
        });
        controlsRow.appendChild(deleteLayerBtn);

        container.appendChild(createElement('div', { className: 'layer-panel-items ui-scrollbar', id: 'layer-list' }));
        container.appendChild(controlsRow);

        return container;
    }

    function buildMainLayout() {
        const mainLayout = createElement('div', { className: 'main-layout' });
        
        mainLayout.appendChild(buildSidebar());

        const canvasArea = buildCanvasArea();
        canvasArea.appendChild(buildPenSettingsPopup());
        mainLayout.appendChild(canvasArea);
        mainLayout.appendChild(buildExportPopup());
        mainLayout.appendChild(buildResizePopup());
        mainLayout.appendChild(buildSettingsPopup());
        mainLayout.appendChild(buildLayerTransformPanel());

        const rightPanel = createElement('div', { className: 'right-panel' });
        rightPanel.appendChild(buildLayerPanel());
        mainLayout.appendChild(rightPanel);

        return mainLayout;
    }

    return {
        buildMainLayout: buildMainLayout,
        buildStatusPanel: buildStatusPanel,
        createCloseButton: createCloseButton,
        createElement: createElement,
        ICONS: ICONS
    };
})();

// 下位互換性のためにグローバルに登録
window.DOMBuilder = DOMBuilder;
