// ================================================================================
// ui/dom-builder.js - システム情報表示版【v8.16.0】
// ================================================================================
// 
// 【依存関係】
//   なし（Pure DOM構築ユーティリティ）
// 
// 【責務】
//   - UI要素のDOM構築
//   - ステータスパネル構造定義
//   - ポップアップパネル構造定義
// 
// 【v8.16.0 改修内容】
//   ✅ DPR表示削除
//   ✅ System情報表示追加（WebGPU/GPU検出）
//   ✅ DRY/SOLID原則に基づくDOM構築の一元化
// ================================================================================

window.DOMBuilder = (function() {
    'use strict';

    // SVGアイコン定義
    const ICONS = {
        library: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"/></svg>',
        export: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19 3 3v-5.5"/><path d="m17 22 3-3"/><circle cx="9" cy="9" r="2"/></svg>',
        resize: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M14 15H9v-5"/><path d="M16 3h5v5"/><path d="M21 3 9 15"/></svg>',
        pen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
        eraser: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>',
        fill: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>',
        animation: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>',
        folder: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
        eye: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
        eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>'
    };

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

    // サイドバー構築
    function buildSidebar() {
        const sidebar = createElement('div', { className: 'sidebar' });

        const tools = [
            { id: 'library-tool', icon: 'library', title: 'アルバム保管 (準備中)' },
            { id: 'export-tool', icon: 'export', title: '画像・アニメ出力' },
            { separator: true },
            { id: 'resize-tool', icon: 'resize', title: 'リサイズ' },
            { separator: true },
            { id: 'pen-tool', icon: 'pen', title: 'ベクターペン (P)', active: true },
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

    // ポップアップパネル: エクスポート
    function buildExportPopup() {
        const popup = createElement('div', {
            className: 'popup-panel',
            id: 'export-popup',
            style: { left: '60px', top: '10px', minWidth: '420px' }
        });

        popup.appendChild(createElement('div', { className: 'popup-title', textContent: '画像・アニメ出力' }));

        // フォーマット選択
        const formatSelection = createElement('div', { className: 'format-selection' });
        ['png', 'gif', 'pdf'].forEach((fmt) => {
            const btn = createElement('button', {
                className: fmt === 'png' ? 'format-btn selected' : (fmt === 'pdf' ? 'format-btn disabled' : 'format-btn'),
                textContent: fmt.toUpperCase(),
                attributes: { 'data-format': fmt }
            });
            formatSelection.appendChild(btn);
        });
        popup.appendChild(formatSelection);

        // エクスポートオプション
        const exportOptions = createElement('div', {
            className: 'export-options',
            id: 'export-options'
        });
        exportOptions.appendChild(createElement('div', { className: 'setting-label', textContent: 'PNG限定画出力' }));
        exportOptions.appendChild(createElement('div', {
            style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' },
            textContent: '現在のキャンバス状態をPNG画像として出力します。'
        }));
        popup.appendChild(exportOptions);

        // プログレスバー
        const progress = createElement('div', { className: 'export-progress', id: 'export-progress' });
        const progressBar = createElement('div', { className: 'progress-bar' });
        progressBar.appendChild(createElement('div', { className: 'progress-fill' }));
        progress.appendChild(progressBar);
        progress.appendChild(createElement('div', { className: 'progress-text', textContent: '0%' }));
        popup.appendChild(progress);

        // プレビュー
        const previewContainer = createElement('div', {
            className: 'preview-container',
            id: 'preview-container',
            style: { display: 'none' }
        });
        previewContainer.appendChild(createElement('img', { id: 'preview-image', attributes: { alt: 'Preview' } }));
        popup.appendChild(previewContainer);

        // ステータス
        popup.appendChild(createElement('div', {
            className: 'export-status',
            id: 'export-status',
            style: { display: 'none', fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0' }
        }));

        // アクションボタン
        const actions = createElement('div', { className: 'export-actions' });
        actions.appendChild(createElement('button', { className: 'action-button', id: 'export-execute', textContent: 'ダウンロード' }));
        actions.appendChild(createElement('button', { className: 'action-button secondary', id: 'export-preview', textContent: 'プレビュー' }));
        popup.appendChild(actions);

        return popup;
    }

    // ポップアップパネル: リサイズ
    function buildResizePopup() {
        const popup = createElement('div', {
            className: 'popup-panel resize-popup-compact',
            id: 'resize-settings',
            style: { left: '60px', top: '150px' }
        });

        // 幅スライダーグループ
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
        widthValueRow.appendChild(createElement('span', { className: 'resize-value-display', id: 'canvas-width-display', textContent: '344px' }));
        widthGroup.appendChild(widthValueRow);

        popup.appendChild(widthGroup);

        // 高さスライダーグループ
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
        heightValueRow.appendChild(createElement('span', { className: 'resize-value-display', id: 'canvas-height-display', textContent: '135px' }));
        heightGroup.appendChild(heightValueRow);

        popup.appendChild(heightGroup);

        // プリセットボタン
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

        // リサイズ実行ボタン
        const applyBtn = createElement('button', {
            className: 'resize-apply-btn',
            id: 'apply-resize',
            textContent: 'リサイズ実行'
        });
        popup.appendChild(applyBtn);

        // 入力フィールド（隠し）
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

    // ポップアップパネル: 設定
    function buildSettingsPopup() {
        return createElement('div', {
            className: 'popup-panel',
            id: 'settings-popup',
            style: { left: '60px', top: '250px' }
        });
    }

    // レイヤー変形パネル
    function buildLayerTransformPanel() {
        const panel = createElement('div', {
            className: 'layer-transform-panel',
            id: 'layer-transform-panel'
        });

        const sections = createElement('div', { className: 'panel-sections' });

        // X/Y位置
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

        // 回転/拡縮
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

        // フリップボタン
        const flipSection = createElement('div', { className: 'panel-section' });
        const flipGroup = createElement('div', { className: 'flip-section' });
        flipGroup.appendChild(createElement('div', { className: 'flip-button', id: 'flip-horizontal-btn', textContent: '水平反転' }));
        flipGroup.appendChild(createElement('div', { className: 'flip-button', id: 'flip-vertical-btn', textContent: '垂直反転' }));
        flipSection.appendChild(flipGroup);
        sections.appendChild(flipSection);

        panel.appendChild(sections);
        return panel;
    }

    /**
     * ステータスパネル構築【v8.16.0改修】
     * 
     * 変更点:
     *   - DPR表示削除
     *   - System情報表示追加（id: system-info）
     *   - FPSとHistoryのid統一（fps → fps-info, history-info維持）
     */
    function buildStatusPanel() {
        const panel = createElement('div', { className: 'status-panel' });

        const group1 = createElement('div', { className: 'status-group' });
        const items1 = [
            { label: 'Canvas:', id: 'canvas-info', value: '400×400px' },
            { label: 'Tool:', id: 'current-tool', value: 'ベクターペン' },
            { label: 'Layer:', id: 'current-layer', value: 'レイヤー1' },
            { label: '座標:', id: 'coordinates', value: 'X: 0, Y: 0' },
            { label: 'Transform:', id: 'transform-info', value: 'x:0 y:0 s:1.0 r:0°' },
            { label: 'System:', id: 'system-info', value: 'WebGL' }  // 🆕 v8.16.0
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
            { label: 'FPS:', id: 'fps-info', value: '60' },  // 🔧 id統一: fps → fps-info
            { label: 'History:', id: 'history-info', value: '0/50' }
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

    // レイヤーパネル
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

        container.appendChild(controlsRow);
        container.appendChild(createElement('div', { className: 'layer-panel-items', id: 'layer-list' }));

        return container;
    }

    // メインレイアウト構築
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

    // 公開API
    return {
        buildMainLayout: buildMainLayout,
        buildStatusPanel: buildStatusPanel,
        createElement: createElement,
        ICONS: ICONS
    };
})();

console.log('✅ dom-builder.js v8.16.0 loaded');
console.log('   ✓ DPR表示削除');
console.log('   ✓ System情報表示追加（WebGPU/GPU検出）');