// ========================================
// UIBuilder.js - UI生成・レイアウト
// ========================================

(function() {
    'use strict';
    
    class UIBuilder {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            
            const config = window.TegakiConstants?.UI_CONFIG || {};
            this.config = {
                shortcutPanelWidth: config.SHORTCUT_PANEL_WIDTH || 180,
                controlPanelWidth: config.CONTROL_PANEL_WIDTH || 180,
                layerPanelWidth: config.LAYER_PANEL_WIDTH || 150,
                thumbnailSize: config.THUMBNAIL_SIZE || 60,
                layerThumbnailSize: config.LAYER_THUMBNAIL_SIZE || 50,
                panelGap: config.PANEL_GAP || 10,
                panelPadding: config.PANEL_PADDING || 10,
                panelBackground: config.PANEL_BACKGROUND || 'rgba(240, 224, 214, 0.8)',
                panelBorderColor: config.PANEL_BORDER_COLOR || '#cf9c97',
                activeColor: config.ACTIVE_COLOR || '#800000',
                inactiveColor: config.INACTIVE_COLOR || '#aa5a56'
            };
            
            this.colorPalette = window.TegakiConstants?.COLOR_PALETTE || [
                '#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6', '#ffffff'
            ];
        }
        
        /**
         * メインレイアウト作成
         */
        createMainLayout() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                flex-direction: row;
                width: 100%;
                height: 100%;
                background: #ffffee;
                gap: ${this.config.panelGap}px;
                padding: ${this.config.panelGap}px;
            `;
            
            this.container.appendChild(this.wrapper);
            return this.wrapper;
        }
        
        /**
         * ショートカットパネル作成
         */
        createShortcutPanel(shortcuts) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.shortcutPanelWidth}px;
                background: ${this.config.panelBackground};
                border: 2px solid ${this.config.panelBorderColor};
                border-radius: 4px;
                padding: ${this.config.panelPadding}px;
                font-size: 12px;
                color: ${this.config.activeColor};
                overflow-y: auto;
            `;
            
            let shortcutHtml = `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid ${this.config.panelBorderColor}; padding-bottom: 5px;">
                    ⌨️ ショートカット
                </h3>
                <div style="line-height: 1.8;">
                    <div><b>1-9</b>: フレーム切替</div>
                    <div><b>Q/W</b>: レイヤー切替</div>
                    <div><b>P</b>: ペン</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>O</b>: オニオンスキン</div>
                    <div><b>V</b>: ドラッグ移動</div>
                    <div><b>Ctrl+Z</b>: 元に戻す</div>
                    <div><b>Ctrl+Y</b>: やり直し</div>
                    <div><b>Ctrl+C</b>: コピー</div>
                    <div><b>Ctrl+V</b>: ペースト</div>
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; border-bottom: 1px solid ${this.config.panelBorderColor}; padding-bottom: 5px;">
                    ℹ️ 使い方
                </h3>
                <div style="line-height: 1.6; font-size: 11px;">
                    ・各レイヤーに描画<br>
                    ・サムネイルで切替<br>
                    ・オニオンスキンで<br>
                    　前後を確認<br>
                    ・完成したらAPNG投稿
                </div>
            `;
            
            panel.innerHTML = shortcutHtml;
            this.wrapper.appendChild(panel);
            return panel;
        }
        
        /**
         * キャンバスエリア作成
         */
        createCanvasArea(canvas, bgCanvas) {
            const centerArea = document.createElement('div');
            centerArea.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: ${this.config.panelGap}px;
                min-width: 0;
            `;
            
            // キャンバスコンテナ
            const canvasWrapper = document.createElement('div');
            canvasWrapper.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 0;
            `;
            
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: ${canvas.width}px;
                height: ${canvas.height}px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            
            canvasContainer.appendChild(bgCanvas);
            canvasContainer.appendChild(canvas);
            canvasWrapper.appendChild(canvasContainer);
            
            centerArea.appendChild(canvasWrapper);
            this.wrapper.appendChild(centerArea);
            
            return centerArea;
        }
        
        /**
         * フレームサムネイル作成
         */
        createFrameThumbnails(frameCount, onClick) {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: ${this.config.panelGap}px;
                padding: ${this.config.panelPadding}px;
                background: rgba(240, 224, 214, 0.5);
                border-radius: 4px;
            `;
            
            const thumbnails = [];
            
            for (let i = 0; i < frameCount; i++) {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.style.cssText = 'text-align: center;';
                
                const thumb = document.createElement('canvas');
                thumb.width = this.config.thumbnailSize;
                thumb.height = this.config.thumbnailSize;
                thumb.style.cssText = `
                    border: 3px solid ${this.config.inactiveColor};
                    border-radius: 2px;
                    background: #f0e0d6;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: block;
                `;
                thumb.title = `フレーム ${i + 1} (${i + 1}キー)`;
                thumb.onclick = () => onClick(i);
                
                const label = document.createElement('div');
                label.style.cssText = `
                    font-size: 10px;
                    color: ${this.config.activeColor};
                    margin-top: 2px;
                `;
                label.textContent = i + 1;
                
                thumbWrapper.appendChild(thumb);
                thumbWrapper.appendChild(label);
                thumbnails.push(thumb);
                thumbnailContainer.appendChild(thumbWrapper);
            }
            
            return { container: thumbnailContainer, thumbnails };
        }
        
        /**
         * フレームサムネイルを更新
         */
        updateFrameThumbnail(thumbnailCanvas, imageData) {
            const thumbCtx = thumbnailCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            
            // 一時キャンバスでImageDataを描画
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            // サムネイルに縮小描画
            thumbCtx.drawImage(
                tempCanvas,
                0, 0,
                thumbnailCanvas.width,
                thumbnailCanvas.height
            );
        }
        
        /**
         * フレームサムネイルのハイライト
         */
        highlightFrameThumbnail(thumbnails, activeIndex) {
            thumbnails.forEach((thumb, i) => {
                thumb.style.borderColor = (i === activeIndex) ? 
                    this.config.activeColor : this.config.inactiveColor;
                thumb.style.transform = (i === activeIndex) ? 'scale(1.1)' : 'scale(1)';
            });
        }
        
        /**
         * レイヤーパネル作成
         */
        createLayerPanel(layerCount, onLayerClick, onVisibilityChange, onOpacityChange) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.layerPanelWidth}px;
                background: ${this.config.panelBackground};
                border: 2px solid ${this.config.panelBorderColor};
                border-radius: 4px;
                padding: ${this.config.panelPadding}px;
                font-size: 12px;
                color: ${this.config.activeColor};
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: bold;
                margin-bottom: 10px;
                border-bottom: 1px solid ${this.config.panelBorderColor};
                padding-bottom: 5px;
                flex-shrink: 0;
            `;
            header.innerHTML = '🖼️ フレームのレイヤー';
            panel.appendChild(header);
            
            const layersContainer = document.createElement('div');
            layersContainer.style.cssText = `
                display: flex;
                flex-direction: column-reverse;
                gap: 8px;
                flex: 1;
            `;
            
            const layers = [];
            
            for (let i = 0; i < layerCount; i++) {
                const layerItem = document.createElement('div');
                layerItem.style.cssText = `
                    border: 2px solid ${this.config.inactiveColor};
                    border-radius: 2px;
                    padding: 5px;
                    transition: all 0.2s;
                    background: white;
                `;
                
                // 上部: サムネイル + 表示切替
                const topRow = document.createElement('div');
                topRow.style.cssText = 'display: flex; align-items: center; gap: 5px; margin-bottom: 5px;';
                
                const visibilityBtn = document.createElement('button');
                visibilityBtn.innerHTML = '👁️';
                visibilityBtn.style.cssText = `
                    width: 24px;
                    height: 24px;
                    border: 1px solid ${this.config.inactiveColor};
                    background: white;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 14px;
                    padding: 0;
                    flex-shrink: 0;
                `;
                visibilityBtn.title = '表示/非表示';
                visibilityBtn.onclick = (e) => {
                    e.stopPropagation();
                    onVisibilityChange(i);
                };
                
                const layerCanvas = document.createElement('canvas');
                layerCanvas.width = 40;
                layerCanvas.height = 40;
                layerCanvas.style.cssText = `
                    display: block;
                    flex: 1;
                    background: #f0e0d6;
                    cursor: pointer;
                    border: 1px solid ${this.config.panelBorderColor};
                `;
                layerCanvas.onclick = () => onLayerClick(i);
                
                topRow.appendChild(visibilityBtn);
                topRow.appendChild(layerCanvas);
                
                // 中央: レイヤー名
                const layerLabel = document.createElement('div');
                layerLabel.style.cssText = `
                    font-size: 11px;
                    text-align: center;
                    font-weight: bold;
                    margin-bottom: 5px;
                    cursor: pointer;
                `;
                layerLabel.textContent = i === 0 ? '背景' : `レイヤー${i}`;
                layerLabel.onclick = () => onLayerClick(i);
                
                // 下部: 不透明度コントロール
                const opacityRow = document.createElement('div');
                opacityRow.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 10px;
                `;
                
                const decreaseBtn = document.createElement('button');
                decreaseBtn.innerHTML = '◀';
                decreaseBtn.style.cssText = `
                    width: 18px;
                    height: 18px;
                    border: 1px solid ${this.config.inactiveColor};
                    background: white;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 10px;
                    padding: 0;
                `;
                decreaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    onOpacityChange(i, -1);
                };
                
                const opacityDisplay = document.createElement('div');
                opacityDisplay.style.cssText = `
                    flex: 1;
                    text-align: center;
                    font-weight: bold;
                    cursor: ew-resize;
                    user-select: none;
                    padding: 2px;
                `;
                opacityDisplay.textContent = '100%';
                
                // ドラッグで不透明度調整
                let isDragging = false;
                let startX = 0;
                let startOpacity = 100;
                
                opacityDisplay.onmousedown = (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startOpacity = parseInt(opacityDisplay.textContent);
                    e.preventDefault();
                };
                
                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    const diff = e.clientX - startX;
                    const newOpacity = Math.max(0, Math.min(100, startOpacity + Math.round(diff / 2)));
                    onOpacityChange(i, newOpacity - parseInt(opacityDisplay.textContent));
                });
                
                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });
                
                const increaseBtn = document.createElement('button');
                increaseBtn.innerHTML = '▶';
                increaseBtn.style.cssText = `
                    width: 18px;
                    height: 18px;
                    border: 1px solid ${this.config.inactiveColor};
                    background: white;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 10px;
                    padding: 0;
                `;
                increaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    onOpacityChange(i, 1);
                };
                
                opacityRow.appendChild(decreaseBtn);
                opacityRow.appendChild(opacityDisplay);
                opacityRow.appendChild(increaseBtn);
                
                layerItem.appendChild(topRow);
                layerItem.appendChild(layerLabel);
                layerItem.appendChild(opacityRow);
                
                layers.push({ 
                    item: layerItem, 
                    canvas: layerCanvas, 
                    label: layerLabel,
                    visibilityBtn: visibilityBtn,
                    opacityDisplay: opacityDisplay
                });
                layersContainer.appendChild(layerItem);
            }
            
            panel.appendChild(layersContainer);
            this.wrapper.appendChild(panel);
            
            return { panel, layers };
        }
        
        /**
         * レイヤーサムネイルを更新
         */
        updateLayerThumbnail(layerCanvas, imageData) {
            const layerCtx = layerCanvas.getContext('2d', {
                willReadFrequently: true
            });
            layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
            
            // 背景を描画（チェック柄）
            this.drawCheckeredBackground(layerCtx, layerCanvas.width, layerCanvas.height);
            
            // 一時キャンバスでImageDataを描画
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            // サムネイルに縮小描画
            layerCtx.drawImage(
                tempCanvas,
                0, 0,
                layerCanvas.width,
                layerCanvas.height
            );
        }
        
        /**
         * チェック柄背景を描画（透明部分の可視化用）
         */
        drawCheckeredBackground(ctx, width, height) {
            const checkSize = 4;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#cccccc';
            for (let y = 0; y < height; y += checkSize) {
                for (let x = 0; x < width; x += checkSize) {
                    if ((x / checkSize + y / checkSize) % 2 === 0) {
                        ctx.fillRect(x, y, checkSize, checkSize);
                    }
                }
            }
        }
        
        /**
         * レイヤーパネルのハイライト
         */
        highlightLayerPanel(layers, activeIndex) {
            layers.forEach((layer, i) => {
                layer.item.style.borderColor = (i === activeIndex) ? 
                    this.config.activeColor : this.config.inactiveColor;
                layer.item.style.backgroundColor = (i === activeIndex) ? 
                    'rgba(128, 0, 0, 0.05)' : 'white';
            });
        }
        
        /**
         * レイヤーの表示状態を更新
         */
        updateLayerVisibility(layers, layerIndex, visible) {
            layers[layerIndex].visibilityBtn.innerHTML = visible ? '👁️' : '🚫';
            layers[layerIndex].item.style.opacity = visible ? '1' : '0.5';
        }
        
        /**
         * レイヤーの不透明度表示を更新
         */
        updateLayerOpacity(layers, layerIndex, opacity) {
            layers[layerIndex].opacityDisplay.textContent = `${Math.round(opacity * 100)}%`;
        }
        
        /**
         * コントロールパネル作成
         */
        createControlPanel(callbacks) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.controlPanelWidth}px;
                background: ${this.config.panelBackground};
                border: 2px solid ${this.config.panelBorderColor};
                border-radius: 4px;
                padding: ${this.config.panelPadding}px;
                font-size: 12px;
                color: ${this.config.activeColor};
                display: flex;
                flex-direction: column;
                gap: 12px;
                overflow-y: auto;
            `;
            
            // カラーパレット
            const paletteSection = this.createColorPalette(callbacks.onColorChange);
            panel.appendChild(paletteSection);
            
            // ツールスロット
            const toolSection = this.createToolSlots(callbacks.onToolChange);
            panel.appendChild(toolSection.section);
            
            // ペンサイズスライダー
            const sizeSection = this.createSizeSlider(callbacks.onSizeChange);
            panel.appendChild(sizeSection);
            
            // 消しゴムサイズスライダー
            const eraserSection = this.createEraserSlider(callbacks.onEraserSizeChange);
            panel.appendChild(eraserSection);
            
            // フレーム間隔スライダー
            const delaySection = this.createDelaySlider(callbacks.onDelayChange);
            panel.appendChild(delaySection);
            
            // フレーム操作ボタン
            const frameButtons = this.createFrameButtons(callbacks.onAddFrame, callbacks.onDeleteFrame);
            panel.appendChild(frameButtons);
            
            // プレビュー・オニオンスキン
            const previewSection = this.createPreviewSection(callbacks.onPreview, callbacks.onOnionSkinChange);
            panel.appendChild(previewSection);
            
            this.wrapper.appendChild(panel);
            return panel;
        }
        
        /**
         * カラーパレット作成
         */
        createColorPalette(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
            label.textContent = '🎨 パレット';
            section.appendChild(label);
            
            const palette = document.createElement('div');
            palette.style.cssText = `
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 5px;
            `;
            
            const colorButtons = [];
            
            this.colorPalette.forEach((color, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    width: 100%;
                    height: 30px;
                    background: ${color};
                    border: 2px solid ${this.config.inactiveColor};
                    border-radius: 2px;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                btn.onclick = () => {
                    onChange(color);
                    this.highlightColorButton(colorButtons, i);
                };
                
                colorButtons.push(btn);
                palette.appendChild(btn);
            });
            
            // 最初の色をアクティブに
            this.highlightColorButton(colorButtons, 0);
            
            section.appendChild(palette);
            return section;
        }
        
        /**
         * カラーボタンのハイライト
         */
        highlightColorButton(buttons, activeIndex) {
            buttons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.activeColor : this.config.inactiveColor;
                btn.style.transform = (i === activeIndex) ? 'scale(1.05)' : 'scale(1)';
            });
        }
        
        /**
         * ツールスロット作成
         */
        createToolSlots(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
            label.textContent = '🛠️ ツール';
            section.appendChild(label);
            
            const tools = document.createElement('div');
            tools.style.cssText = 'display: flex; gap: 5px;';
            
            const toolButtons = [];
            
            const toolList = [
                { name: 'ペン', icon: '✏️', tool: 'pen' },
                { name: '消しゴム', icon: '🧽', tool: 'eraser' }
            ];
            
            toolList.forEach((toolInfo, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    flex: 1;
                    padding: 8px;
                    background: white;
                    border: 2px solid ${this.config.inactiveColor};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s;
                `;
                btn.innerHTML = `${toolInfo.icon}<br><span style="font-size: 10px;">${toolInfo.name}</span>`;
                btn.title = toolInfo.name;
                btn.onclick = () => {
                    onChange(toolInfo.tool);
                    this.highlightToolButton(toolButtons, i);
                };
                
                toolButtons.push(btn);
                tools.appendChild(btn);
            });
            
            // ペンをデフォルトでアクティブに
            this.highlightToolButton(toolButtons, 0);
            
            section.appendChild(tools);
            return { section, buttons: toolButtons };
        }
        
        /**
         * ツールボタンのハイライト
         */
        highlightToolButton(buttons, activeIndex) {
            buttons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.activeColor : this.config.inactiveColor;
                btn.style.backgroundColor = (i === activeIndex) ? 
                    'rgba(128, 0, 0, 0.1)' : 'white';
            });
        }
        
        /**
         * ペンサイズスライダー作成
         */
        createSizeSlider(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
            label.innerHTML = `✏️ ペンサイズ: <span id="pen-size-value">2</span>px`;
            section.appendChild(label);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'pen-size-slider';
            slider.min = '1';
            slider.max = '20';
            slider.value = '2';
            slider.style.cssText = 'width: 100%;';
            
            const valueSpan = label.querySelector('#pen-size-value');
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                valueSpan.textContent = value;
                onChange(value);
            });
            
            section.appendChild(slider);
            return section;
        }
        
        /**
         * 消しゴムサイズスライダー作成
         */
        createEraserSlider(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
            label.innerHTML = `🧽 消しゴムサイズ: <span id="eraser-size-value">10</span>px`;
            section.appendChild(label);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'eraser-size-slider';
            slider.min = '1';
            slider.max = '50';
            slider.value = '10';
            slider.style.cssText = 'width: 100%;';
            
            const valueSpan = label.querySelector('#eraser-size-value');
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                valueSpan.textContent = value;
                onChange(value);
            });
            
            section.appendChild(slider);
            return section;
        }
        
        /**
         * フレーム間隔スライダー作成
         */
        createDelaySlider(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
            label.innerHTML = `⏱️ フレーム間隔: <span id="delay-value">200</span>ms`;
            section.appendChild(label);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'delay-slider';
            slider.min = '10';
            slider.max = '2000';
            slider.value = '200';
            slider.step = '10';
            slider.style.cssText = 'width: 100%;';
            
            const valueSpan = label.querySelector('#delay-value');
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                valueSpan.textContent = value;
                onChange(value);
            });
            
            const hint = document.createElement('div');
            hint.style.cssText = 'display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;';
            hint.innerHTML = '<span>速い</span><span>遅い</span>';
            section.appendChild(slider);
            section.appendChild(hint);
            
            return section;
        }
        
        /**
         * フレーム操作ボタン作成
         */
        createFrameButtons(onAdd, onDelete) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
            label.textContent = '🎞️ フレーム操作';
            section.appendChild(label);
            
            const buttons = document.createElement('div');
            buttons.style.cssText = 'display: flex; gap: 5px;';
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '選択右に新規';
            addBtn.style.cssText = `
                flex: 1;
                padding: 6px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 11px;
            `;
            addBtn.onclick = onAdd;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '選択削除';
            deleteBtn.style.cssText = `
                flex: 1;
                padding: 6px;
                background: #f87171;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 11px;
            `;
            deleteBtn.onclick = onDelete;
            
            buttons.appendChild(addBtn);
            buttons.appendChild(deleteBtn);
            section.appendChild(buttons);
            
            return section;
        }
        
        /**
         * プレビュー・オニオンスキンセクション作成
         */
        createPreviewSection(onPreview, onOnionSkinChange) {
            const section = document.createElement('div');
            section.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
            
            // プレビューボタン
            const previewBtn = document.createElement('button');
            previewBtn.textContent = '▶️ プレビュー';
            previewBtn.style.cssText = `
                padding: 10px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
            `;
            previewBtn.onclick = onPreview;
            
            // オニオンスキン
            const onionLabel = document.createElement('label');
            onionLabel.style.cssText = 'display: flex; align-items: center; gap: 5px; font-size: 11px; cursor: pointer;';
            
            const onionCheckbox = document.createElement('input');
            onionCheckbox.type = 'checkbox';
            onionCheckbox.id = 'onion-skin-check';
            onionCheckbox.checked = false;
            onionCheckbox.onchange = (e) => onOnionSkinChange(e.target.checked);
            
            const onionText = document.createElement('span');
            onionText.textContent = '🧅 オニオンスキン';
            
            onionLabel.appendChild(onionCheckbox);
            onionLabel.appendChild(onionText);
            
            section.appendChild(previewBtn);
            section.appendChild(onionLabel);
            
            return section;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            this.wrapper = null;
            this.container = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.UIBuilder = UIBuilder;
        console.log('✅ UIBuilder loaded');
    }
})();