// ========================================
// UIBuilder.js - UI生成・レイアウト（改修版）
// レイアウト案.pngに準拠した新デザイン
// ========================================

(function() {
    'use strict';
    
    class UIBuilder {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.layerPanelHeaderElement = null;
            
            // スロットUI要素への参照
            this.penSlotButtons = [];
            this.penSlider = null;
            this.eraserSlotButtons = [];
            this.eraserSlider = null;
            this.paletteCircle = null;
            this.isPaletteOpen = false;
            
            // カラースキーム
            this.config = {
                shortcutPanelWidth: 100,
                controlPanelWidth: 110,
                layerPanelWidth: 110,
                thumbnailSize: 60,
                layerThumbnailSize: 60,
                panelGap: 6,
                panelPadding: 6,
                panelBackground: 'transparent',
                panelBorderColor: 'transparent',
                primary: '#800000',
                secondary: '#aa5a56',
                border: '#cf9c97',
                light: '#e9c2ba',
                background: '#f0e0d6',
                page: '#ffffee',
                white: '#ffffff'
            };
            
            this.colorPalette = [
                ['#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6', '#ffffff'],
                ['#ff0000', '#0000ff', '#00ff00', '#ff8800', '#ffffff', '#000000']
            ];
        }
        
        /**
         * メインレイアウト作成
         */
        createMainLayout() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: ${this.config.page};
                gap: ${this.config.panelGap}px;
                padding: ${this.config.panelGap}px;
            `;
            
            // メインコンテンツエリア
            const mainContent = document.createElement('div');
            mainContent.style.cssText = `
                display: flex;
                flex-direction: row;
                flex: 1;
                gap: ${this.config.panelGap}px;
                min-height: 0;
            `;
            this.wrapper.appendChild(mainContent);
            this.mainContent = mainContent;
            
            this.container.appendChild(this.wrapper);
            return this.wrapper;
        }
        
        /**
         * ショートカットパネル作成
         */
        createShortcutPanel() {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.shortcutPanelWidth}px;
                background: ${this.config.panelBackground};
                padding: ${this.config.panelPadding}px;
                font-size: 10px;
                color: ${this.config.primary};
                overflow-y: auto;
            `;
            
            let shortcutHtml = `
                <h3 style="margin: 0 0 6px 0; font-size: 11px; padding-bottom: 3px; border-bottom: 1px solid ${this.config.border};">
                    ショートカット
                </h3>
                <div style="line-height: 1.5;">
                    <div><b>1-9</b>: フレーム</div>
                    <div><b>Q/W</b>: レイヤー</div>
                    <div><b>P</b>: ペン</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>G</b>: バケツ</div>
                    <div><b>I</b>: スポイト</div>
                    <div><b>[ / ]</b>: スロット</div>
                    <div><b>O</b>: オニオン</div>
                    <div><b>V</b>: 移動</div>
                    <div><b>Ctrl+Z</b>: Undo</div>
                    <div><b>Ctrl+Y</b>: Redo</div>
                </div>
                <h3 style="margin: 10px 0 6px 0; font-size: 11px; padding-bottom: 3px; border-bottom: 1px solid ${this.config.border};">
                    使い方
                </h3>
                <div style="line-height: 1.4; font-size: 9px;">
                    各レイヤーに描画してサムネイルで切替。完成したらAPNG投稿。
                </div>
            `;
            
            panel.innerHTML = shortcutHtml;
            this.mainContent.appendChild(panel);
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
            this.mainContent.appendChild(centerArea);
            
            return centerArea;
        }
        
        /**
         * フレームサムネイル作成
         */
        createFrameThumbnails(frameCount, onClick, onAdd, onDelete, onCopy) {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: ${this.config.panelGap}px;
            `;
            
            // 操作ボタン群
            const buttonRow = document.createElement('div');
            buttonRow.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 4px;
            `;
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '選択右に新規';
            addBtn.style.cssText = `
                padding: 3px 6px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
            `;
            addBtn.onclick = onAdd;
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '選択右にコピー';
            copyBtn.style.cssText = `
                padding: 3px 6px;
                background: #60a5fa;
                color: white;
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
            `;
            copyBtn.onclick = onCopy;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '選択削除';
            deleteBtn.style.cssText = `
                padding: 3px 6px;
                background: #f87171;
                color: white;
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
            `;
            deleteBtn.onclick = onDelete;
            
            buttonRow.appendChild(addBtn);
            buttonRow.appendChild(copyBtn);
            buttonRow.appendChild(deleteBtn);
            container.appendChild(buttonRow);
            
            // サムネイル行
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                padding: 6px;
                background: rgba(240, 224, 214, 0.3);
                border-radius: 3px;
            `;
            
            const thumbnails = [];
            
            for (let i = 0; i < frameCount; i++) {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.style.cssText = 'text-align: center;';
                
                const thumb = document.createElement('canvas');
                thumb.width = this.config.thumbnailSize;
                thumb.height = this.config.thumbnailSize;
                thumb.style.cssText = `
                    border: 2px solid ${this.config.secondary};
                    border-radius: 2px;
                    background: ${this.config.background};
                    cursor: pointer;
                    transition: all 0.2s;
                    display: block;
                `;
                thumb.title = `フレーム ${i + 1} (${i + 1}キー)`;
                thumb.onclick = () => onClick(i);
                
                const label = document.createElement('div');
                label.style.cssText = `
                    font-size: 9px;
                    color: ${this.config.primary};
                    margin-top: 2px;
                `;
                label.textContent = i + 1;
                
                thumbWrapper.appendChild(thumb);
                thumbWrapper.appendChild(label);
                thumbnails.push(thumb);
                thumbnailContainer.appendChild(thumbWrapper);
            }
            
            container.appendChild(thumbnailContainer);
            
            return { container, thumbnails };
        }
        
        /**
         * フレームサムネイルを更新
         */
        updateFrameThumbnail(thumbnailCanvas, imageData) {
            const thumbCtx = thumbnailCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
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
                    this.config.primary : this.config.secondary;
                thumb.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
            });
        }
        
        /**
         * チェック柄背景を描画
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
         * レイヤーパネル作成（コンパクト版）
         */
        createLayerPanel(layerCount, currentFrameIndex, onLayerClick, onVisibilityChange, onOpacityChange) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.layerPanelWidth}px;
                background: ${this.config.panelBackground};
                padding: ${this.config.panelPadding}px;
                font-size: 10px;
                color: ${this.config.primary};
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: bold;
                padding-bottom: 3px;
                flex-shrink: 0;
                font-size: 11px;
                border-bottom: 1px solid ${this.config.border};
            `;
            header.textContent = `F${currentFrameIndex + 1}のレイヤー`;
            this.layerPanelHeaderElement = header;
            panel.appendChild(header);
            
            const layersContainer = document.createElement('div');
            layersContainer.style.cssText = `
                display: flex;
                flex-direction: column-reverse;
                gap: 4px;
                flex: 1;
            `;
            
            const layers = [];
            
            for (let i = 0; i < layerCount; i++) {
                const layerItem = document.createElement('div');
                layerItem.style.cssText = `
                    border: 2px solid ${this.config.secondary};
                    border-radius: 2px;
                    padding: 3px;
                    transition: all 0.2s;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                `;
                
                // サムネイル
                const layerCanvas = document.createElement('canvas');
                layerCanvas.width = this.config.layerThumbnailSize;
                layerCanvas.height = this.config.layerThumbnailSize;
                layerCanvas.style.cssText = `
                    display: block;
                    width: 100%;
                    height: auto;
                    background: ${this.config.background};
                    cursor: pointer;
                    border: 1px solid ${this.config.border};
                    border-radius: 2px;
                `;
                layerCanvas.onclick = () => onLayerClick(i);
                layerItem.appendChild(layerCanvas);
                
                // 情報行
                const infoRow = document.createElement('div');
                infoRow.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 3px;
                `;
                
                // 表示切替ボタン
                const visibilityBtn = document.createElement('button');
                visibilityBtn.textContent = '👁';
                visibilityBtn.style.cssText = `
                    width: 20px;
                    height: 20px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 11px;
                    padding: 0;
                    flex-shrink: 0;
                `;
                visibilityBtn.title = '表示/非表示切替';
                visibilityBtn.onclick = (e) => {
                    e.stopPropagation();
                    onVisibilityChange(i);
                };
                infoRow.appendChild(visibilityBtn);
                
                // レイヤー名
                const layerLabel = document.createElement('div');
                layerLabel.style.cssText = `
                    font-size: 9px;
                    font-weight: bold;
                    cursor: pointer;
                    flex: 1;
                    text-align: center;
                `;
                layerLabel.textContent = i === 0 ? 'L0' : `L${i}`;
                layerLabel.onclick = () => onLayerClick(i);
                infoRow.appendChild(layerLabel);
                
                // 不透明度表示
                const opacityDisplay = document.createElement('div');
                opacityDisplay.style.cssText = `
                    font-size: 8px;
                    font-weight: bold;
                    text-align: right;
                    flex-shrink: 0;
                    width: 25px;
                `;
                opacityDisplay.textContent = '100%';
                infoRow.appendChild(opacityDisplay);
                
                layerItem.appendChild(infoRow);
                
                // 不透明度調整ボタン
                const opacityRow = document.createElement('div');
                opacityRow.style.cssText = 'display: flex; gap: 2px;';
                
                const decreaseBtn = document.createElement('button');
                decreaseBtn.innerHTML = '◀';
                decreaseBtn.style.cssText = `
                    flex: 1;
                    height: 16px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    font-size: 8px;
                    padding: 0;
                    border-radius: 2px;
                `;
                decreaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    onOpacityChange(i, -10);
                };
                
                const increaseBtn = document.createElement('button');
                increaseBtn.innerHTML = '▶';
                increaseBtn.style.cssText = `
                    flex: 1;
                    height: 16px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    font-size: 8px;
                    padding: 0;
                    border-radius: 2px;
                `;
                increaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    onOpacityChange(i, 10);
                };
                
                opacityRow.appendChild(decreaseBtn);
                opacityRow.appendChild(increaseBtn);
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
            this.mainContent.appendChild(panel);
            
            return { panel, layers };
        }
        
        /**
         * レイヤーパネルのヘッダーを更新
         */
        updateLayerPanelHeader(frameIndex) {
            if (this.layerPanelHeaderElement) {
                this.layerPanelHeaderElement.textContent = `F${frameIndex + 1}のレイヤー`;
            }
        }
        
        /**
         * レイヤーサムネイルを更新
         */
        updateLayerThumbnail(layerCanvas, imageData) {
            const layerCtx = layerCanvas.getContext('2d', {
                willReadFrequently: true
            });
            layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
            
            // チェック柄背景
            this.drawCheckeredBackground(layerCtx, layerCanvas.width, layerCanvas.height);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            layerCtx.drawImage(
                tempCanvas,
                0, 0,
                layerCanvas.width,
                layerCanvas.height
            );
        }
        
        /**
         * レイヤーパネルのハイライト
         */
        highlightLayerPanel(layers, activeIndex) {
            layers.forEach((layer, i) => {
                layer.item.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                layer.item.style.backgroundColor = (i === activeIndex) ? 
                    'rgba(128, 0, 0, 0.05)' : 'white';
                layer.item.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
            });
        }
        
        /**
         * レイヤーの表示状態を更新
         */
        updateLayerVisibility(layers, layerIndex, visible) {
            layers[layerIndex].visibilityBtn.textContent = visible ? '👁' : '🚫';
            layers[layerIndex].item.style.opacity = visible ? '1' : '0.5';
        }
        
        /**
         * レイヤーの不透明度表示を更新
         */
        updateLayerOpacity(layers, layerIndex, opacity) {
            layers[layerIndex].opacityDisplay.textContent = `${Math.round(opacity * 100)}%`;
        }
        
        /**
         * コントロールパネル作成（新レイアウト）
         */
        createControlPanel(callbacks) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.controlPanelWidth}px;
                background: ${this.config.panelBackground};
                padding: ${this.config.panelPadding}px;
                font-size: 10px;
                color: ${this.config.primary};
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-y: auto;
            `;
            
            // プレビューボタン
            const previewBtn = document.createElement('button');
            previewBtn.id = 'preview-button';
            previewBtn.textContent = 'プレビュー';
            previewBtn.style.cssText = `
                padding: 5px;
                background: ${this.config.primary};
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-weight: bold;
                font-size: 11px;
            `;
            previewBtn.onclick = callbacks.onPreview;
            panel.appendChild(previewBtn);
            
            // カラーパレット（新レイアウト：パレットボタン＋スポイト）
            const paletteSection = this.createColorPaletteNew(callbacks.onColorChange);
            panel.appendChild(paletteSection);
            
            // ツールボタン（ペン・消しゴム・バケツ）
            const toolSection = this.createToolButtonsNew(callbacks.onToolChange);
            panel.appendChild(toolSection);
            
            // ペンスロット（縦置き）
            if (callbacks.penSlots) {
                const penSlotSection = this.createPenSlotsVertical(
                    callbacks.penSlots,
                    callbacks.onPenSlotClick,
                    callbacks.onPenSizeChange
                );
                panel.appendChild(penSlotSection);
            }
            
            // 消しゴムスロット（縦置き）
            if (callbacks.eraserSlots) {
                const eraserSlotSection = this.createEraserSlotsVertical(
                    callbacks.eraserSlots,
                    callbacks.onEraserSlotClick,
                    callbacks.onEraserSizeChange
                );
                panel.appendChild(eraserSlotSection);
            }
            
            // オニオンスキン（スイッチ式）
            const onionSection = this.createOnionSkinSwitch(callbacks.onOnionSkinChange);
            panel.appendChild(onionSection);
            
            // フレーム間隔
            const delaySection = this.createDelaySlider(callbacks.onDelayChange);
            panel.appendChild(delaySection);
            
            this.mainContent.appendChild(panel);
            
            return panel;
        }
        
        /**
         * カラーパレット作成（新レイアウト）
         */
        createColorPaletteNew(onChange) {
            const section = document.createElement('div');
            section.style.cssText = 'position: relative;';
            
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display: flex; gap: 3px; margin-bottom: 3px;';
            
            // パレットボタン
            const paletteBtn = document.createElement('button');
            paletteBtn.textContent = 'パレット';
            paletteBtn.style.cssText = `
                flex: 1;
                padding: 4px;
                background: white;
                border: 2px solid ${this.config.secondary};
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
            `;
            paletteBtn.onclick = () => this.togglePaletteCircle(onChange);
            topRow.appendChild(paletteBtn);
            
            // スポイトボタン
            const eyedropperBtn = document.createElement('button');
            eyedropperBtn.textContent = 'I';
            eyedropperBtn.style.cssText = `
                width: 24px;
                padding: 4px;
                background: white;
                border: 2px solid ${this.config.secondary};
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
            `;
            eyedropperBtn.title = 'スポイト (I)';
            eyedropperBtn.onclick = () => {
                if (this.eyedropperCallback) {
                    this.eyedropperCallback();
                }
            };
            topRow.appendChild(eyedropperBtn);
            
            this.eyedropperBtn = eyedropperBtn;
            
            section.appendChild(topRow);
            
            // カラーサークル（初期は非表示）
            this.paletteCircle = document.createElement('div');
            this.paletteCircle.style.cssText = `
                display: none;
                position: absolute;
                top: 30px;
                left: 0;
                background: white;
                border: 2px solid ${this.config.border};
                border-radius: 4px;
                padding: 4px;
                z-index: 100;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            
            // 2段のカラーパレット
            for (let row = 0; row < 2; row++) {
                const colorRow = document.createElement('div');
                colorRow.style.cssText = 'display: flex; gap: 2px; margin-bottom: 2px;';
                
                this.colorPalette[row].forEach(color => {
                    const btn = document.createElement('button');
                    btn.style.cssText = `
                        width: 16px;
                        height: 16px;
                        background: ${color};
                        border: 1px solid ${this.config.border};
                        border-radius: 2px;
                        cursor: pointer;
                        padding: 0;
                    `;
                    btn.onclick = () => {
                        onChange(color);
                        this.togglePaletteCircle(onChange); // 選択後閉じる
                    };
                    colorRow.appendChild(btn);
                });
                
                this.paletteCircle.appendChild(colorRow);
            }
            
            section.appendChild(this.paletteCircle);
            
            return section;
        }
        
        /**
         * パレットサークルの表示切替
         */
        togglePaletteCircle(onChange) {
            this.isPaletteOpen = !this.isPaletteOpen;
            this.paletteCircle.style.display = this.isPaletteOpen ? 'block' : 'none';
        }
        
        /**
         * ツールボタン作成（新レイアウト：アイコンレス）
         */
        createToolButtonsNew(onChange) {
            const section = document.createElement('div');
            
            const toolsRow = document.createElement('div');
            toolsRow.style.cssText = 'display: flex; gap: 3px;';
            
            const toolButtons = [];
            
            const toolList = [
                { name: 'ペン', tool: 'pen' },
                { name: '消', tool: 'eraser' },
                { name: 'G', tool: 'bucket' }
            ];
            
            toolList.forEach((toolInfo, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    flex: 1;
                    padding: 5px 3px;
                    background: white;
                    border: 2px solid ${this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 9px;
                    transition: all 0.2s;
                    font-weight: bold;
                `;
                btn.textContent = toolInfo.name;
                btn.onclick = () => {
                    onChange(toolInfo.tool);
                    this.highlightToolButton(toolButtons, i);
                };
                
                toolButtons.push(btn);
                toolsRow.appendChild(btn);
            });
            
            this.highlightToolButton(toolButtons, 0);
            this.toolButtons = toolButtons;
            
            section.appendChild(toolsRow);
            return section;
        }
        
        /**
         * ツールボタンのハイライト
         */
        highlightToolButton(buttons, activeIndex) {
            buttons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                btn.style.backgroundColor = (i === activeIndex) ? 
                    'rgba(128, 0, 0, 0.1)' : 'white';
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
            });
        }
        
        /**
         * ペンスロット作成（縦置き）
         */
        createPenSlotsVertical(slots, onSlotClick, onSizeChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.textContent = 'ペン';
            label.style.cssText = 'font-weight: bold; margin-bottom: 3px; font-size: 10px;';
            section.appendChild(label);
            
            // スロット列（縦）
            const slotColumn = document.createElement('div');
            slotColumn.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px;';
            
            this.penSlotButtons = [];
            slots.forEach((slot, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    padding: 4px;
                    background: ${this.config.primary};
                    color: ${this.config.background};
                    border: 2px solid ${slot.active ? this.config.primary : this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 10px;
                    text-align: center;
                    font-weight: bold;
                    transition: all 0.2s;
                `;
                btn.textContent = i + 1;
                btn.onclick = () => onSlotClick(i);
                
                this.penSlotButtons.push(btn);
                slotColumn.appendChild(btn);
            });
            section.appendChild(slotColumn);
            
            // サイズ表示
            const sizeDisplay = document.createElement('div');
            sizeDisplay.id = 'pen-size-display';
            sizeDisplay.style.cssText = `
                text-align: center;
                font-weight: bold;
                font-size: 9px;
                margin-bottom: 2px;
            `;
            sizeDisplay.textContent = `${slots.find(s => s.active).size.toFixed(1)}px`;
            section.appendChild(sizeDisplay);
            
            // ▲ボタン
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.style.cssText = `
                width: 100%;
                height: 16px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 9px;
                border-radius: 2px;
                margin-bottom: 2px;
            `;
            upBtn.onclick = () => onSizeChange(0.5);
            section.appendChild(upBtn);
            
            // スライダー
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '1';
            slider.max = '20';
            slider.step = '0.5';
            slider.value = slots.find(s => s.active).size;
            slider.style.cssText = 'width: 100%; margin-bottom: 2px;';
            slider.oninput = (e) => {
                const newValue = parseFloat(e.target.value);
                const activeSlot = slots.find(s => s.active);
                const delta = newValue - activeSlot.size;
                onSizeChange(delta);
            };
            this.penSlider = slider;
            section.appendChild(slider);
            
            // ▼ボタン
            const downBtn = document.createElement('button');
            downBtn.textContent = '▼';
            downBtn.style.cssText = `
                width: 100%;
                height: 16px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 9px;
                border-radius: 2px;
            `;
            downBtn.onclick = () => onSizeChange(-0.5);
            section.appendChild(downBtn);
            
            return section;
        }
        
        /**
         * ペンスロット更新
         */
        updatePenSlots(slots, activeIndex) {
            this.penSlotButtons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
                btn.style.boxShadow = (i === activeIndex) ? 
                    '0 0 4px rgba(128, 0, 0, 0.5)' : 'none';
            });
            
            if (this.penSlider) {
                this.penSlider.value = slots[activeIndex].size;
            }
            
            const sizeDisplay = document.getElementById('pen-size-display');
            if (sizeDisplay) {
                sizeDisplay.textContent = `${slots[activeIndex].size.toFixed(1)}px`;
            }
        }
        
        /**
         * 消しゴムスロット作成（縦置き）
         */
        createEraserSlotsVertical(slots, onSlotClick, onSizeChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.textContent = '消しゴム';
            label.style.cssText = 'font-weight: bold; margin-bottom: 3px; font-size: 10px;';
            section.appendChild(label);
            
            // スロット列（縦）
            const slotColumn = document.createElement('div');
            slotColumn.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px;';
            
            this.eraserSlotButtons = [];
            slots.forEach((slot, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    padding: 4px;
                    background: white;
                    color: ${this.config.primary};
                    border: 2px solid ${slot.active ? this.config.primary : this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 10px;
                    text-align: center;
                    font-weight: bold;
                    transition: all 0.2s;
                `;
                btn.textContent = i + 1;
                btn.onclick = () => onSlotClick(i);
                
                this.eraserSlotButtons.push(btn);
                slotColumn.appendChild(btn);
            });
            section.appendChild(slotColumn);
            
            // サイズ表示
            const sizeDisplay = document.createElement('div');
            sizeDisplay.id = 'eraser-size-display';
            sizeDisplay.style.cssText = `
                text-align: center;
                font-weight: bold;
                font-size: 9px;
                margin-bottom: 2px;
            `;
            sizeDisplay.textContent = `${slots.find(s => s.active).size.toFixed(0)}px`;
            section.appendChild(sizeDisplay);
            
            // ▲ボタン
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.style.cssText = `
                width: 100%;
                height: 16px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 9px;
                border-radius: 2px;
                margin-bottom: 2px;
            `;
            upBtn.onclick = () => onSizeChange(1);
            section.appendChild(upBtn);
            
            // スライダー
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '1';
            slider.max = '50';
            slider.step = '1';
            slider.value = slots.find(s => s.active).size;
            slider.style.cssText = 'width: 100%; margin-bottom: 2px;';
            slider.oninput = (e) => {
                const newValue = parseFloat(e.target.value);
                const activeSlot = slots.find(s => s.active);
                const delta = newValue - activeSlot.size;
                onSizeChange(delta);
            };
            this.eraserSlider = slider;
            section.appendChild(slider);
            
            // ▼ボタン
            const downBtn = document.createElement('button');
            downBtn.textContent = '▼';
            downBtn.style.cssText = `
                width: 100%;
                height: 16px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 9px;
                border-radius: 2px;
            `;
            downBtn.onclick = () => onSizeChange(-1);
            section.appendChild(downBtn);
            
            return section;
        }
        
        /**
         * 消しゴムスロット更新
         */
        updateEraserSlots(slots, activeIndex) {
            this.eraserSlotButtons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
                btn.style.boxShadow = (i === activeIndex) ? 
                    '0 0 4px rgba(128, 0, 0, 0.5)' : 'none';
            });
            
            if (this.eraserSlider) {
                this.eraserSlider.value = slots[activeIndex].size;
            }
            
            const sizeDisplay = document.getElementById('eraser-size-display');
            if (sizeDisplay) {
                sizeDisplay.textContent = `${slots[activeIndex].size.toFixed(0)}px`;
            }
        }
        
        /**
         * オニオンスキン（スイッチ式：0→1→2→3→0）
         */
        createOnionSkinSwitch(onOnionSkinChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.textContent = 'オニオンスキン';
            label.style.cssText = 'font-weight: bold; margin-bottom: 3px; font-size: 10px;';
            section.appendChild(label);
            
            const switchContainer = document.createElement('div');
            switchContainer.style.cssText = 'display: flex; gap: 2px;';
            
            let currentLevel = 0;
            const levels = [0, 1, 2, 3];
            
            levels.forEach((level) => {
                const btn = document.createElement('button');
                btn.textContent = level;
                btn.id = `onion-btn-${level}`;
                btn.style.cssText = `
                    flex: 1;
                    padding: 5px;
                    background: ${level === 0 ? this.config.primary : 'white'};
                    color: ${level === 0 ? 'white' : this.config.primary};
                    border: 2px solid ${level === 0 ? this.config.primary : this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: bold;
                `;
                
                btn.onclick = () => {
                    currentLevel = level;
                    onOnionSkinChange(level);
                    
                    // 全ボタンのスタイルを更新
                    levels.forEach((l) => {
                        const targetBtn = document.getElementById(`onion-btn-${l}`);
                        if (targetBtn) {
                            const isActive = l === currentLevel;
                            targetBtn.style.background = isActive ? this.config.primary : 'white';
                            targetBtn.style.color = isActive ? 'white' : this.config.primary;
                            targetBtn.style.borderColor = isActive ? this.config.primary : this.config.secondary;
                            targetBtn.style.borderWidth = isActive ? '3px' : '2px';
                        }
                    });
                };
                
                switchContainer.appendChild(btn);
            });
            
            section.appendChild(switchContainer);
            return section;
        }
        
        /**
         * フレーム間隔スライダー作成
         */
        createDelaySlider(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 3px; font-weight: bold; font-size: 10px;';
            label.innerHTML = `間隔: <span id="delay-value">200</span>ms`;
            section.appendChild(label);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'delay-slider';
            slider.min = '10';
            slider.max = '2000';
            slider.value = '200';
            slider.step = '10';
            slider.style.cssText = 'width: 100%; margin-bottom: 2px;';
            
            const valueSpan = label.querySelector('#delay-value');
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                valueSpan.textContent = value;
                onChange(value);
            });
            
            const hint = document.createElement('div');
            hint.style.cssText = 'display: flex; justify-content: space-between; font-size: 8px; color: #666;';
            hint.innerHTML = '<span>速い</span><span>遅い</span>';
            section.appendChild(slider);
            section.appendChild(hint);
            
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
            this.layerPanelHeaderElement = null;
            this.penSlotButtons = [];
            this.penSlider = null;
            this.eraserSlotButtons = [];
            this.eraserSlider = null;
            this.paletteCircle = null;
            this.isPaletteOpen = false;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.UIBuilder = UIBuilder;
        console.log('✅ UIBuilder (改修版) loaded');
    }
})();