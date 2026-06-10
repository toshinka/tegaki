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
            { id: 'export-tool', icon: 'export', title: '画像・アニメ出力' },
            { separator: true },
            { id: 'resize-tool', icon: 'resize', title: 'リサイズ' },
            { separator: true },
            { id: 'pen-tool', icon: 'pen', title: 'ペン (P / Shift+Pで筆圧切替)', active: true },
            { id: 'eraser-tool', icon: 'eraser', title: '消しゴム (E)' },
            { id: 'fill-tool', icon: 'fill', title: '塗りつぶし (G)' },
            { separator: true },
            { id: 'gif-animation-tool', icon: 'animation', title: 'GIFアニメーション (Alt+A)' },
            { separator: true },
            { id: 'settings-tool', icon: 'settings', title: '設定 (S)' }
        ];

        tools.forEach(tool => {
            if (tool.separator) {
                sidebar.appendChild(createElement('div', { className: 'tool-separator' }));
            } else {
                const btn = createElement('div', {
                    className: tool.active ? 'tool-button active' : 'tool-button',
                    id: tool.id,
                    title: tool.title,
                    innerHTML: ICONS[tool.icon]
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
        return canvasArea;
    }

    // ポップアップパネル: ペン設定（レガシー・非表示）
    function buildPenSettingsPopup() {
        const popup = createElement('div', {
            className: 'popup-panel',
            id: 'legacy-pen-settings',
            style: { left: '60px', top: '100px', display: 'none' }
        });

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
            className: 'popup-panel',
            id: 'export-popup',
            style: { left: '60px', top: '10px', minWidth: '420px' }
        });

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
            style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' },
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
            className: 'preview-container',
            id: 'preview-container',
            style: { display: 'none' }
        });
        previewContainer.appendChild(createElement('img', { id: 'preview-image', attributes: { alt: 'Preview' } }));
        popup.appendChild(previewContainer);

        popup.appendChild(createElement('div', {
            className: 'export-status',
            id: 'export-status',
            style: { display: 'none', fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0' }
        }));

        const actions = createElement('div', { className: 'export-actions' });
        actions.appendChild(createElement('button', { className: 'action-button', id: 'export-execute', textContent: 'ダウンロード' }));
        actions.appendChild(createElement('button', { className: 'action-button secondary', id: 'export-preview', textContent: 'プレビュー' }));
        popup.appendChild(actions);

        return popup;
    }

    function buildResizePopup() {
        const popup = createElement('div', {
            className: 'popup-panel resize-popup-compact',
            id: 'resize-settings',
            style: { left: '60px', top: '150px' }
        });

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
        return createElement('div', {
            className: 'popup-panel',
            id: 'settings-popup',
            style: { left: '60px', top: '250px' }
        });
    }

    function buildLayerTransformPanel() {
        const panel = createElement('div', {
            className: 'layer-transform-panel',
            id: 'layer-transform-panel'
        });

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

        const flipSection = createElement('div', { className: 'panel-section' });
        const flipGroup = createElement('div', { className: 'flip-section' });
        flipGroup.appendChild(createElement('div', { className: 'flip-button', id: 'flip-horizontal-btn', textContent: '水平反転' }));
        flipGroup.appendChild(createElement('div', { className: 'flip-button', id: 'flip-vertical-btn', textContent: '垂直反転' }));
        flipSection.appendChild(flipGroup);
        sections.appendChild(flipSection);

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
            { label: '座標:', id: 'coordinates', value: 'X: 0, Y: 0' },
            { label: 'Transform:', id: 'transform-info', value: 'x:0 y:0 s:1.0 r:0°' },
            { label: 'System:', id: 'system-info', value: 'WebGL' }
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
            title: 'フォルダ追加（準備中）',
            innerHTML: ICONS.folder
        });
        controlsRow.appendChild(addFolderBtn);

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

        container.appendChild(controlsRow);
        container.appendChild(createElement('div', { className: 'layer-panel-items', id: 'layer-list' }));

        return container;
    }

    function buildMainLayout() {
        const mainLayout = createElement('div', { className: 'main-layout' });
        
        mainLayout.appendChild(buildSidebar());

        const canvasArea = buildCanvasArea();
        canvasArea.appendChild(buildPenSettingsPopup());
        canvasArea.appendChild(buildExportPopup());
        canvasArea.appendChild(buildResizePopup());
        canvasArea.appendChild(buildSettingsPopup());
        canvasArea.appendChild(buildLayerTransformPanel());
        
        mainLayout.appendChild(canvasArea);

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
