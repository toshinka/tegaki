// ========================================
// UIBuilder.js - UI生成・レイアウト
// スロット機能 + レイアウト改修版
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
            slots.forEach((slot, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    flex: 1;
                    padding: 4px 2px;
                    background: white;
                    border: 2px solid ${slot.active ? this.config.primary : this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 9px;
                    text-align: center;
                    line-height: 1.2;
                `;
                btn.innerHTML = `✏️<br>${slot.size.toFixed(1)}`;
                btn.onclick = () => onSlotClick(i);
                
                this.penSlotButtons.push(btn);
                slotRow.appendChild(btn);
            });
            section.appendChild(slotRow);
            
            // ▲ボタン
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.style.cssText = `
                width: 100%;
                height: 18px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 10px;
                border-radius: 2px;
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
            slider.style.cssText = 'width: 100%;';
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
                height: 18px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 10px;
                border-radius: 2px;
            `;
            downBtn.onclick = () => onSizeChange(-0.5);
            section.appendChild(downBtn);
            
            return { section };
        }
        
        /**
         * ペンスロット更新
         */
        updatePenSlots(slots, activeIndex) {
            this.penSlotButtons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
                btn.innerHTML = `✏️<br>${slots[i].size.toFixed(1)}`;
            });
            
            if (this.penSlider) {
                this.penSlider.value = slots[activeIndex].size;
            }
        }
        
        /**
         * 消しゴムスロット作成
         */
        createEraserSlots(slots, onSlotClick, onSizeChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.textContent = '消しゴムサイズ';
            label.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 11px;';
            section.appendChild(label);
            
            // スロット行
            const slotRow = document.createElement('div');
            slotRow.style.cssText = 'display: flex; gap: 3px; margin-bottom: 4px;';
            
            this.eraserSlotButtons = [];
            slots.forEach((slot, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    flex: 1;
                    padding: 4px 2px;
                    background: white;
                    border: 2px solid ${slot.active ? this.config.primary : this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 9px;
                    text-align: center;
                    line-height: 1.2;
                `;
                btn.innerHTML = `🧽<br>${slot.size.toFixed(0)}`;
                btn.onclick = () => onSlotClick(i);
                
                this.eraserSlotButtons.push(btn);
                slotRow.appendChild(btn);
            });
            section.appendChild(slotRow);
            
            // ▲ボタン
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.style.cssText = `
                width: 100%;
                height: 18px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 10px;
                border-radius: 2px;
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
            slider.style.cssText = 'width: 100%;';
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
                height: 18px;
                background: white;
                border: 1px solid ${this.config.border};
                cursor: pointer;
                font-size: 10px;
                border-radius: 2px;
            `;
            downBtn.onclick = () => onSizeChange(-1);
            section.appendChild(downBtn);
            
            return { section };
        }
        
        /**
         * 消しゴムスロット更新
         */
        updateEraserSlots(slots, activeIndex) {
            this.eraserSlotButtons.forEach((btn, i) => {
                btn.style.borderColor = (i === activeIndex) ? 
                    this.config.primary : this.config.secondary;
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
                btn.innerHTML = `🧽<br>${slots[i].size.toFixed(0)}`;
            });
            
            if (this.eraserSlider) {
                this.eraserSlider.value = slots[activeIndex].size;
            }
        }
        
        /**
         * フレーム間隔スライダー作成
         */
        createDelaySlider(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 4px; font-weight: bold; font-size: 11px;';
            label.innerHTML = `間隔: <span id="delay-value">200</span>ms`;
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
            hint.style.cssText = 'display: flex; justify-content: space-between; font-size: 9px; color: #666; margin-top: 2px;';
            hint.innerHTML = '<span>速い</span><span>遅い</span>';
            section.appendChild(slider);
            section.appendChild(hint);
            
            return section;
        }
        
        /**
         * オニオンスキンセクション作成
         */
        createOnionSkinSection(onOnionSkinChange) {
            const section = document.createElement('div');
            
            const onionLabel = document.createElement('label');
            onionLabel.style.cssText = 'display: flex; align-items: center; gap: 5px; font-size: 11px; cursor: pointer;';
            
            const onionCheckbox = document.createElement('input');
            onionCheckbox.type = 'checkbox';
            onionCheckbox.id = 'onion-skin-check';
            onionCheckbox.checked = false;
            onionCheckbox.onchange = (e) => onOnionSkinChange(e.target.checked);
            
            const onionText = document.createElement('span');
            onionText.textContent = 'オニオンスキン';
            
            onionLabel.appendChild(onionCheckbox);
            onionLabel.appendChild(onionText);
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
            this.layerPanelHeaderElement = null;
            this.penSlotButtons = [];
            this.penSlider = null;
            this.eraserSlotButtons = [];
            this.eraserSlider = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.UIBuilder = UIBuilder;
        console.log('✅ UIBuilder loaded');
    }
})();SlotButtons = [];
            this.penSlider = null;
            this.eraserSlotButtons = [];
            this.eraserSlider = null;
            
            // カラースキーム
            this.config = {
                shortcutPanelWidth: 120,
                controlPanelWidth: 150,
                layerPanelWidth: 130,
                thumbnailSize: 60,
                layerThumbnailSize: 60,
                panelGap: 8,
                panelPadding: 8,
                panelBackground: 'transparent',
                panelBorderColor: 'transparent',
                primary: '#800000',
                secondary: '#aa5a56',
                border: '#cf9c97',
                light: '#e9c2ba',
                background: '#f0e0d6',
                white: '#ffffff'
            };
            
            this.colorPalette = [
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
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: #ffffee;
                gap: ${this.config.panelGap}px;
                padding: ${this.config.panelGap}px;
            `;
            
            // タイトルバー
            const titleBar = document.createElement('div');
            titleBar.style.cssText = `
                font-size: 13px;
                font-weight: bold;
                color: ${this.config.primary};
                padding: 4px 8px;
                text-align: center;
                background: rgba(240, 224, 214, 0.3);
                border-radius: 2px;
            `;
            titleBar.textContent = 'めぶがき APNG投稿テスト DEV';
            this.wrapper.appendChild(titleBar);
            
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
                font-size: 11px;
                color: ${this.config.primary};
                overflow-y: auto;
            `;
            
            let shortcutHtml = `
                <h3 style="margin: 0 0 8px 0; font-size: 12px; padding-bottom: 4px; border-bottom: 1px solid ${this.config.border};">
                    ショートカット
                </h3>
                <div style="line-height: 1.6;">
                    <div><b>1-9</b>: フレーム</div>
                    <div><b>Q/W</b>: レイヤー</div>
                    <div><b>P</b>: ペン</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>[ / ]</b>: スロット</div>
                    <div><b>O</b>: オニオン</div>
                    <div><b>V</b>: 移動</div>
                    <div><b>Ctrl+Z</b>: Undo</div>
                    <div><b>Ctrl+Y</b>: Redo</div>
                </div>
                <h3 style="margin: 12px 0 8px 0; font-size: 12px; padding-bottom: 4px; border-bottom: 1px solid ${this.config.border};">
                    使い方
                </h3>
                <div style="line-height: 1.5; font-size: 10px;">
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
            
            // 上部: プレビューボタン
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 8px;
            `;
            
            const previewBtn = document.createElement('button');
            previewBtn.id = 'preview-button';
            previewBtn.textContent = 'プレビュー';
            previewBtn.style.cssText = `
                padding: 6px 16px;
                background: ${this.config.primary};
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
            `;
            topBar.appendChild(previewBtn);
            centerArea.appendChild(topBar);
            
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
                gap: 5px;
            `;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '選択削除';
            deleteBtn.style.cssText = `
                padding: 4px 8px;
                background: #f87171;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            `;
            deleteBtn.onclick = onDelete;
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '選択右にコピー';
            copyBtn.style.cssText = `
                padding: 4px 8px;
                background: #60a5fa;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            `;
            copyBtn.onclick = onCopy;
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '選択右に新規';
            addBtn.style.cssText = `
                padding: 4px 8px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            `;
            addBtn.onclick = onAdd;
            
            buttonRow.appendChild(deleteBtn);
            buttonRow.appendChild(copyBtn);
            buttonRow.appendChild(addBtn);
            container.appendChild(buttonRow);
            
            // サムネイル行
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px;
                background: rgba(240, 224, 214, 0.3);
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
                    font-size: 10px;
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
         * レイヤーパネル作成（横並びレイアウト）
         */
        createLayerPanel(layerCount, currentFrameIndex, onLayerClick, onVisibilityChange, onOpacityChange) {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: ${this.config.layerPanelWidth}px;
                background: ${this.config.panelBackground};
                padding: ${this.config.panelPadding}px;
                font-size: 11px;
                color: ${this.config.primary};
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: bold;
                margin-bottom: 8px;
                padding-bottom: 4px;
                flex-shrink: 0;
                font-size: 12px;
                border-bottom: 1px solid ${this.config.border};
            `;
            header.textContent = `F${currentFrameIndex + 1}のレイヤー`;
            this.layerPanelHeaderElement = header;
            panel.appendChild(header);
            
            const layersContainer = document.createElement('div');
            layersContainer.style.cssText = `
                display: flex;
                flex-direction: column-reverse;
                gap: 6px;
                flex: 1;
            `;
            
            const layers = [];
            
            for (let i = 0; i < layerCount; i++) {
                const layerItem = document.createElement('div');
                layerItem.style.cssText = `
                    border: 2px solid ${this.config.secondary};
                    border-radius: 2px;
                    padding: 4px;
                    transition: all 0.2s;
                    background: white;
                    display: flex;
                    gap: 4px;
                `;
                
                // 左側：情報欄
                const infoColumn = document.createElement('div');
                infoColumn.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 1;
                    min-width: 50px;
                `;
                
                // 表示切替ボタン
                const visibilityBtn = document.createElement('button');
                visibilityBtn.textContent = '👁️';
                visibilityBtn.style.cssText = `
                    width: 100%;
                    height: 20px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 12px;
                    padding: 0;
                `;
                visibilityBtn.title = '表示/非表示切替';
                visibilityBtn.onclick = (e) => {
                    e.stopPropagation();
                    onVisibilityChange(i);
                };
                infoColumn.appendChild(visibilityBtn);
                
                // 不透明度表示
                const opacityDisplay = document.createElement('div');
                opacityDisplay.style.cssText = `
                    text-align: center;
                    font-weight: bold;
                    font-size: 10px;
                `;
                opacityDisplay.textContent = '100%';
                infoColumn.appendChild(opacityDisplay);
                
                // 不透明度調整ボタン
                const opacityRow = document.createElement('div');
                opacityRow.style.cssText = 'display: flex; gap: 2px;';
                
                const decreaseBtn = document.createElement('button');
                decreaseBtn.innerHTML = '◀';
                decreaseBtn.style.cssText = `
                    flex: 1;
                    height: 18px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    font-size: 9px;
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
                    height: 18px;
                    border: 1px solid ${this.config.border};
                    background: white;
                    cursor: pointer;
                    font-size: 9px;
                    padding: 0;
                    border-radius: 2px;
                `;
                increaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    onOpacityChange(i, 10);
                };
                
                opacityRow.appendChild(decreaseBtn);
                opacityRow.appendChild(increaseBtn);
                infoColumn.appendChild(opacityRow);
                
                // レイヤー名
                const layerLabel = document.createElement('div');
                layerLabel.style.cssText = `
                    font-size: 10px;
                    text-align: center;
                    font-weight: bold;
                    cursor: pointer;
                `;
                layerLabel.textContent = i === 0 ? 'L0' : `L${i}`;
                layerLabel.onclick = () => onLayerClick(i);
                infoColumn.appendChild(layerLabel);
                
                // 右側：サムネイル
                const layerCanvas = document.createElement('canvas');
                layerCanvas.width = this.config.layerThumbnailSize;
                layerCanvas.height = this.config.layerThumbnailSize;
                layerCanvas.style.cssText = `
                    display: block;
                    width: ${this.config.layerThumbnailSize}px;
                    height: ${this.config.layerThumbnailSize}px;
                    background: ${this.config.background};
                    cursor: pointer;
                    border: 1px solid ${this.config.border};
                    flex-shrink: 0;
                    border-radius: 2px;
                `;
                layerCanvas.onclick = () => onLayerClick(i);
                
                layerItem.appendChild(infoColumn);
                layerItem.appendChild(layerCanvas);
                
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
            layers[layerIndex].visibilityBtn.textContent = visible ? '👁️' : '🚫';
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
                padding: ${this.config.panelPadding}px;
                font-size: 11px;
                color: ${this.config.primary};
                display: flex;
                flex-direction: column;
                gap: 10px;
                overflow-y: auto;
            `;
            
            // カラーパレット
            const paletteSection = this.createColorPalette(callbacks.onColorChange);
            panel.appendChild(paletteSection);
            
            // ツールボタン
            const toolSection = this.createToolButtons(callbacks.onToolChange);
            panel.appendChild(toolSection.section);
            
            // ペンスロット
            const penSlotSection = this.createPenSlots(
                callbacks.penSlots,
                callbacks.onPenSlotClick,
                callbacks.onPenSizeChange
            );
            panel.appendChild(penSlotSection.section);
            
            // 消しゴムスロット
            const eraserSlotSection = this.createEraserSlots(
                callbacks.eraserSlots,
                callbacks.onEraserSlotClick,
                callbacks.onEraserSizeChange
            );
            panel.appendChild(eraserSlotSection.section);
            
            // フレーム間隔
            const delaySection = this.createDelaySlider(callbacks.onDelayChange);
            panel.appendChild(delaySection);
            
            // オニオンスキン
            const onionSection = this.createOnionSkinSection(callbacks.onOnionSkinChange);
            panel.appendChild(onionSection);
            
            this.mainContent.appendChild(panel);
            
            // プレビューボタンのイベント設定
            const previewBtn = document.getElementById('preview-button');
            if (previewBtn) {
                previewBtn.onclick = callbacks.onPreview;
            }
            
            return panel;
        }
        
        /**
         * カラーパレット作成
         */
        createColorPalette(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 11px;';
            label.textContent = 'パレット';
            section.appendChild(label);
            
            const palette = document.createElement('div');
            palette.style.cssText = `
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 4px;
            `;
            
            const colorButtons = [];
            
            this.colorPalette.forEach((color, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    width: 100%;
                    height: 28px;
                    background: ${color};
                    border: 2px solid ${this.config.secondary};
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
                    this.config.primary : this.config.secondary;
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
            });
        }
        
        /**
         * ツールボタン作成
         */
        createToolButtons(onChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 11px;';
            label.textContent = 'ツール';
            section.appendChild(label);
            
            const tools = document.createElement('div');
            tools.style.cssText = 'display: flex; gap: 4px;';
            
            const toolButtons = [];
            
            const toolList = [
                { name: 'ペン', tool: 'pen' },
                { name: '消しゴム', tool: 'eraser' }
            ];
            
            toolList.forEach((toolInfo, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    flex: 1;
                    padding: 6px;
                    background: white;
                    border: 2px solid ${this.config.secondary};
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: all 0.2s;
                    font-weight: bold;
                `;
                btn.textContent = toolInfo.name;
                btn.onclick = () => {
                    onChange(toolInfo.tool);
                    this.highlightToolButton(toolButtons, i);
                };
                
                toolButtons.push(btn);
                tools.appendChild(btn);
            });
            
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
                    this.config.primary : this.config.secondary;
                btn.style.backgroundColor = (i === activeIndex) ? 
                    'rgba(128, 0, 0, 0.1)' : 'white';
                btn.style.borderWidth = (i === activeIndex) ? '3px' : '2px';
            });
        }
        
        /**
         * ペンスロット作成
         */
        createPenSlots(slots, onSlotClick, onSizeChange) {
            const section = document.createElement('div');
            
            const label = document.createElement('div');
            label.textContent = 'ペンサイズ';
            label.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 11px;';
            section.appendChild(label);
            
            // スロット行
            const slotRow = document.createElement('div');
            slotRow.style.cssText = 'display: flex; gap: 3px; margin-bottom: 4px;';
            
            this.pen