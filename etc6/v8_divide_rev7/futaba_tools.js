/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵かきツール v8rev8
 * Adobe Fresco風レイヤーシステム完成版 - ツール・UI統合ハブ
 */

// ==== LayerManager: Adobe Fresco-style Layer System ====
/**
 * 【目的】Adobe Fresco風レイヤーシステム・スワイプ削除・3状態表示・ポップアップ操作
 * 【入力】LayerBridge インスタンス
 * 【出力】レイヤー作成・削除・並び替え・透明度制御・結合・複製
 * 【副作用】PIXI Container操作、DOM layer-list更新、UNDO通知表示
 */
class LayerManager {
    constructor(layerBridge) {
        this.bridge = layerBridge;
        this.layers = new Map();
        this.layerOrder = []; // 描画順序管理（下から上）
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.ui = null;
        this.undoStack = []; // 削除UNDO用
        this.checkerboardVisible = false; // チェッカーボード表示状態
    }
    
    initialize() {
        // 背景レイヤー作成
        this.createLayer({ name: '背景', isBackground: true, opacity: 1.0 });
        this.updateCheckerboardVisibility();
        log('🎯 LayerManager: Background layer created');
    }
    
    createLayer(options = {}) {
        const { name = null, isBackground = false, opacity = 1.0 } = options;
        
        const layerId = isBackground ? 0 : this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        container.alpha = opacity;
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: "open", // "open" | "closed" | "disabled"
            opacity: opacity,
            isBackground: isBackground,
            paths: []
        };
        
        this.layers.set(layerId, layer);
        
        // 描画順序に追加（背景レイヤーは最下位固定）
        if (isBackground) {
            this.layerOrder.unshift(layerId);
        } else {
            this.layerOrder.push(layerId);
        }
        
        // LayerBridge経由でPIXI Containerを追加
        this.bridge.addContainer(container);
        this.reorderContainers();
        
        if (this.activeLayerId === null || isBackground) {
            this.activeLayerId = layerId;
        }
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
        log(`🎨 Layer created: ${layerName} (ID: ${layerId}, opacity: ${opacity})`);
        return layer;
    }
    
    duplicateLayer(layerId) {
        const sourceLayer = this.layers.get(layerId);
        if (!sourceLayer) return null;
        
        const newLayer = this.createLayer({ 
            name: `${sourceLayer.name} コピー`,
            opacity: sourceLayer.opacity
        });
        
        // Copy all paths from source layer
        sourceLayer.paths.forEach(path => {
            const newPath = this.clonePath(path);
            newLayer.container.addChild(newPath.graphics);
            newLayer.paths.push(newPath);
        });
        
        this.setActiveLayer(newLayer.id);
        log(`📋 Layer duplicated: ${sourceLayer.name} → ${newLayer.name}`);
        return newLayer;
    }
    
    mergeLayerDown(layerId) {
        const layer = this.layers.get(layerId);
        const layerIndex = this.layerOrder.indexOf(layerId);
        
        if (!layer || layerIndex <= 0) return false; // 最下位レイヤーは結合不可
        
        const belowLayerId = this.layerOrder[layerIndex - 1];
        const belowLayer = this.layers.get(belowLayerId);
        
        if (!belowLayer) return false;
        
        // パスを下のレイヤーに移動
        layer.paths.forEach(path => {
            belowLayer.container.addChild(path.graphics);
            belowLayer.paths.push(path);
        });
        
        // 現在のレイヤーを削除
        this.deleteLayer(layerId, false); // UNDO記録しない
        
        log(`🔗 Layer merged: ${layer.name} → ${belowLayer.name}`);
        return true;
    }
    
    deleteLayer(layerId, recordUndo = true) {
        if (layerId === 0) return; // 背景レイヤーは削除不可
        if (this.layers.size <= 1) return; // 最低1つのレイヤーが必要
        
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        // UNDO記録
        if (recordUndo) {
            this.undoStack.push({
                type: 'delete',
                layer: this.serializeLayer(layer),
                order: this.layerOrder.indexOf(layerId),
                timestamp: Date.now()
            });
            this.showUndoNotification('レイヤーを削除しました');
        }
        
        // パスを破棄
        layer.paths.forEach(path => {
            path.graphics.destroy();
        });
        
        // LayerBridge経由でPIXI Containerを削除
        this.bridge.removeContainer(layer.container);
        
        // 順序配列から削除
        const orderIndex = this.layerOrder.indexOf(layerId);
        if (orderIndex !== -1) {
            this.layerOrder.splice(orderIndex, 1);
        }
        
        // レイヤーマップから削除
        this.layers.delete(layerId);
        
        // アクティブレイヤーの調整
        if (this.activeLayerId === layerId) {
            // 削除されたレイヤーの下にあるレイヤーをアクティブにする
            const newActiveIndex = Math.max(0, orderIndex - 1);
            this.activeLayerId = this.layerOrder[newActiveIndex];
        }
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
        log(`🗑️ Layer deleted: ${layer.name} (ID: ${layerId})`);
    }
    
    setActiveLayer(layerId) {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            this.updateLayerUI();
            this.updateStatusDisplay();
            log(`👆 Active layer: ${this.layers.get(layerId).name}`);
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        // 3状態を循環: open → closed → disabled → open
        const states = ["open", "closed", "disabled"];
        const currentIndex = states.indexOf(layer.visible);
        const nextIndex = (currentIndex + 1) % states.length;
        layer.visible = states[nextIndex];
        
        // PIXIコンテナの表示状態を更新
        layer.container.visible = (layer.visible === "open");
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
        log(`👁️ Layer visibility: ${layer.name} → ${layer.visible}`);
    }
    
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        layer.opacity = Math.max(0, Math.min(1, opacity));
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
        
        this.updateLayerUI();
        log(`🔅 Layer opacity: ${layer.name} → ${Math.round(layer.opacity * 100)}%`);
    }
    
    reorderLayers(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layerOrder.length ||
            toIndex < 0 || toIndex >= this.layerOrder.length ||
            fromIndex === toIndex) return;
        
        // 背景レイヤー（位置0）は移動不可
        const fromLayerId = this.layerOrder[fromIndex];
        const toLayerId = this.layerOrder[toIndex];
        
        if (fromLayerId === 0 || toLayerId === 0) return;
        
        // 順序配列を更新
        const layerId = this.layerOrder.splice(fromIndex, 1)[0];
        this.layerOrder.splice(toIndex, 0, layerId);
        
        // PIXIコンテナの順序を更新
        this.reorderContainers();
        this.updateLayerUI();
        
        log(`🔄 Layer reordered: ${fromIndex} → ${toIndex}`);
    }
    
    reorderContainers() {
        // layerOrderに基づいてPIXIコンテナを並び替え
        this.layerOrder.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            if (layer) {
                this.bridge.reorderContainer(layer.container, index);
            }
        });
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    addPathToActiveLayer(path) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.paths.push(path);
            activeLayer.container.addChild(path.graphics);
        }
    }
    
    clearAllLayers() {
        this.layers.forEach(layer => {
            layer.paths = [];
            layer.container.removeChildren();
        });
    }
    
    // チェッカーボード表示管理
    updateCheckerboardVisibility() {
        const backgroundLayer = this.layers.get(0);
        const shouldShow = !backgroundLayer || 
                           backgroundLayer.visible !== "open" || 
                           backgroundLayer.opacity < 1.0;
        
        if (shouldShow !== this.checkerboardVisible) {
            this.checkerboardVisible = shouldShow;
            const overlay = document.querySelector('.checkerboard-overlay');
            if (overlay) {
                overlay.style.opacity = shouldShow ? '1' : '0';
                overlay.style.pointerEvents = shouldShow ? 'none' : 'none';
            }
        }
    }
    
    // SVGアイコン取得
    getLayerVisibilityIcon(state) {
        const icons = {
            open: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                     <circle cx="12" cy="12" r="3"/>
                   </svg>`,
            closed: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <path d="m15 18-.722-3.25"/>
                       <path d="m2 8 1.669 1.125"/>
                       <path d="m4.5 11.5-.208 1"/>
                       <path d="m22 8-1.669 1.125"/>
                       <path d="m19.5 11.5.208 1"/>
                       <path d="M9 21h6"/>
                       <path d="M12 3C7.336 3 1 7.336 1 12s6.336 9 11 9c.34 0 .677-.020 1-.057"/>
                       <circle cx="12" cy="12" r="3" fill="currentColor"/>
                     </svg>`,
            disabled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                         <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                         <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68"/>
                         <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61"/>
                         <line x1="2" y1="2" x2="22" y2="22"/>
                       </svg>`
        };
        return icons[state] || icons.open;
    }
    
    // レイヤーのシリアライズ（UNDO用）
    serializeLayer(layer) {
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            isBackground: layer.isBackground,
            paths: layer.paths.map(path => this.serializePath(path))
        };
    }
    
    serializePath(path) {
        return {
            id: path.id,
            points: [...path.points],
            color: path.color,
            size: path.size,
            opacity: path.opacity,
            isComplete: path.isComplete
        };
    }
    
    clonePath(originalPath) {
        const clonedGraphics = new PIXI.Graphics();
        
        originalPath.points.forEach((point, index) => {
            clonedGraphics.circle(point.x, point.y, point.size / 2);
            clonedGraphics.fill({ 
                color: originalPath.color, 
                alpha: originalPath.opacity 
            });
        });
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: clonedGraphics,
            points: [...originalPath.points],
            color: originalPath.color,
            size: originalPath.size,
            opacity: originalPath.opacity,
            isComplete: originalPath.isComplete
        };
    }
    
    showUndoNotification(message) {
        const notification = document.getElementById('undo-notification');
        if (notification) {
            notification.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }
    
    updateLayerUI() {
        if (!this.ui) return;
        
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        // レイヤーを上から下の順で表示（UI表示順序）
        const displayOrder = [...this.layerOrder].reverse();
        
        // レイヤーパネルの動的高さ調整
        this.adjustLayerPanelHeight(displayOrder.length);
        
        displayOrder.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layerId === this.activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layerId;
            layerItem.dataset.layerIndex = index;
            
            // SVGアイコンを使用
            const eyeIcon = this.getLayerVisibilityIcon(layer.visible);
            
            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible}" data-action="toggle-visibility">
                    ${eyeIcon}
                </div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-opacity">${Math.round(layer.opacity * 100)}%</div>
            `;
            
            // イベントハンドラー
            layerItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    this.toggleLayerVisibility(layerId);
                } else {
                    this.setActiveLayer(layerId);
                }
            });
            
            // 右クリック（レイヤーポップアップ）
            layerItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (this.ui) {
                    this.ui.showLayerPopup(layerId, e.clientX, e.clientY);
                }
            });
            
            // スワイプ削除機能（背景レイヤー以外）
            if (layerId !== 0) {
                this.setupLayerSwipe(layerItem, layerId);
            }
            
            layerList.appendChild(layerItem);
        });
    }
    
    // レイヤーパネルの動的高さ調整
    adjustLayerPanelHeight(layerCount) {
        const panel = document.getElementById('layer-panel');
        const layerList = document.getElementById('layer-list');
        if (!panel || !layerList) return;
        
        const itemHeight = 30; // layer-item高さ + gap
        const headerHeight = 36; // layer-header高さ
        const padding = 12; // 内部パディング
        const maxViewportHeight = Math.min(window.innerHeight * 0.8, 600);
        
        const requiredHeight = headerHeight + (layerCount * itemHeight) + padding;
        const finalHeight = Math.min(requiredHeight, maxViewportHeight);
        
        panel.style.height = finalHeight + 'px';
        
        // リストがオーバーフローする場合のスクロール
        const availableListHeight = finalHeight - headerHeight - padding;
        layerList.style.maxHeight = availableListHeight + 'px';
        layerList.style.overflowY = requiredHeight > maxViewportHeight ? 'auto' : 'visible';
        
        // パネル位置調整（上方向に拡張）
        const currentTop = parseInt(panel.style.top) || 60;
        const screenHeight = window.innerHeight;
        
        if (currentTop + finalHeight > screenHeight - 20) {
            const newTop = Math.max(20, screenHeight - finalHeight - 20);
            panel.style.top = newTop + 'px';
        }
    }
    
    setupLayerSwipe(layerItem, layerId) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const swipeThreshold = 80;
        
        const onPointerStart = (e) => {
            if (e.target.closest('[data-action]')) return; // アイコンクリックは無視
            
            startX = e.clientX;
            currentX = e.clientX;
            isDragging = true;
            layerItem.style.transition = 'none';
            e.preventDefault();
        };
        
        const onPointerMove = (e) => {
            if (!isDragging) return;
            
            currentX = e.clientX;
            const deltaX = currentX - startX;
            
            if (Math.abs(deltaX) > 10) { // 10px以上でスワイプ開始
                layerItem.style.transform = `translateX(${deltaX}px)`;
                
                if (Math.abs(deltaX) > swipeThreshold) {
                    layerItem.classList.add(deltaX > 0 ? 'swipe-right' : 'swipe-left');
                } else {
                    layerItem.classList.remove('swipe-right', 'swipe-left');
                }
            }
        };
        
        const onPointerEnd = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            layerItem.style.transition = '';
            
            const deltaX = currentX - startX;
            
            if (Math.abs(deltaX) > swipeThreshold) {
                // スワイプ削除実行
                layerItem.style.transform = `translateX(${deltaX > 0 ? '100%' : '-100%'})`;
                layerItem.style.opacity = '0';
                
                setTimeout(() => {
                    this.deleteLayer(layerId);
                }, 200);
            } else {
                // スワイプキャンセル
                layerItem.style.transform = '';
                layerItem.classList.remove('swipe-right', 'swipe-left');
            }
        };
        
        layerItem.addEventListener('pointerdown', onPointerStart);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerEnd);
        document.addEventListener('pointercancel', onPointerEnd);
    }
    
    updateStatusDisplay() {
        const activeLayer = this.getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
}

// ==== DrawingTools: Tool Management ====
class DrawingTools {
    constructor(drawingEngine, layerManager) {
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.drawing = { active: false, path: null, lastPoint: null };
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        log(`🔧 Tool selected: ${tool}`);
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    startDrawing(x, y, isPanning) {
        if (isPanning) return false;
        
        // アクティブレイヤーの表示状態をチェック
        const activeLayer = this.layers.getActiveLayer();
        if (!activeLayer || activeLayer.visible !== "open") {
            log('⚠️ Cannot draw on inactive or hidden layer');
            return false;
        }
        
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
        const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;
        
        this.drawing.path = this.engine.createPath(x, y, this.brushSize, color, alpha);
        log(`🎨 Drawing started at (${Math.round(x)}, ${Math.round(y)})`);
        return true;
    }
    
    continueDrawing(x, y, isPanning) {
        if (!this.drawing.active || !this.drawing.path || isPanning) return;
        
        this.engine.extendPath(this.drawing.path, x, y);
        this.drawing.lastPoint = { x, y };
    }
    
    stopDrawing() {
        if (this.drawing.path) {
            this.drawing.path.isComplete = true;
            log('🎨 Drawing completed');
        }
        this.drawing = { active: false, path: null, lastPoint: null };
    }
}

// ==== InterfaceManager: Adobe Fresco-style UI Control ====
class InterfaceManager {
    constructor(drawingTools, drawingEngine, layerManager) {
        this.tools = drawingTools;
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.activePopup = null;
        this.layerPopup = null;
        this.sliders = new Map();
        this.dragState = { active: false, offset: { x: 0, y: 0 } };
    }
    
    initialize() {
        log('🚂 InterfaceManager: Initializing Adobe Fresco-style UI');
        this.layers.ui = this;
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupResize();
        this.setupLayerControls();
        this.setupLayerPopup();
        this.updateCanvasInfo();
        
        // 初期ツール設定
        this.activateTool('pen');
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        
        if (toolId === 'pen-tool') {
            this.activateTool('pen');
            this.togglePopup('pen-settings');
        } else if (toolId === 'eraser-tool') {
            this.activateTool('eraser');
            this.closeAllPopups();
        } else if (toolId === 'resize-tool') {
            this.togglePopup('resize-settings');
        } else if (toolId === 'layer-tool') {
            this.toggleLayerPanel();
        }
    }
    
    activateTool(tool) {
        this.tools.selectTool(tool);
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
        
        const canvas = this.engine.app.canvas;
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
    
    toggleLayerPanel() {
        const panel = document.getElementById('layer-panel');
        if (!panel) return;
        
        panel.classList.toggle('hidden');
        
        const button = document.getElementById('layer-tool');
        if (button) {
            button.classList.toggle('active', !panel.classList.contains('hidden'));
        }
        
        log(`🎯 Layer panel: ${panel.classList.contains('hidden') ? 'hidden' : 'visible'}`);
    }
    
    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const addFileBtn = document.getElementById('add-file-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                const newLayer = this.layers.createLayer({ opacity: 1.0 });
                this.layers.setActiveLayer(newLayer.id);
            });
        }
        
        if (addFileBtn) {
            addFileBtn.addEventListener('click', () => {
                // ファイル追加は将来実装
                log('📁 File adding feature - coming soon');
            });
        }
    }
    
    setupLayerPopup() {
        this.layerPopup = document.getElementById('layer-popup');
        if (!this.layerPopup) return;
        
        // レイヤー不透明度スライダー
        this.createSlider('layer-opacity-slider', 0, 100, 100, (value) => {
            const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
            if (currentLayerId) {
                this.layers.setLayerOpacity(currentLayerId, value / 100);
            }
            return Math.round(value) + '%';
        });
        
        // ボタンイベント
        const mergeBtn = document.getElementById('merge-layer-btn');
        const duplicateBtn = document.getElementById('duplicate-layer-btn');
        
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
                if (currentLayerId) {
                    this.layers.mergeLayerDown(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
        
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
                if (currentLayerId) {
                    this.layers.duplicateLayer(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
        
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (this.layerPopup.classList.contains('show') && 
                !this.layerPopup.contains(e.target) && 
                !e.target.closest('.layer-item')) {
                this.hideLayerPopup();
            }
        });
    }
    
    showLayerPopup(layerId, x, y) {
        if (!this.layerPopup) return;
        
        const layer = this.layers.layers.get(layerId);
        if (!layer) return;
        
        // ポップアップの位置調整
        const maxX = window.innerWidth - 240; // ポップアップ幅 + マージン
        const maxY = window.innerHeight - 200; // ポップアップ高さ + マージン
        
        this.layerPopup.style.left = Math.min(x, maxX) + 'px';
        this.layerPopup.style.top = Math.min(y, maxY) + 'px';
        
        // レイヤー情報を設定
        this.layerPopup.dataset.layerId = layerId;
        
        // タイトル更新
        const title = this.layerPopup.querySelector('.popup-title');
        if (title) {
            title.textContent = `${layer.name} の設定`;
        }
        
        // 不透明度スライダーの値を更新
        const opacitySlider = this.sliders.get('layer-opacity-slider');
        if (opacitySlider) {
            const value = layer.opacity * 100;
            const percentage = value;
            
            opacitySlider.track.style.width = percentage + '%';
            opacitySlider.handle.style.left = percentage + '%';
            opacitySlider.valueDisplay.textContent = Math.round(value) + '%';
            opacitySlider.value = value;
        }
        
        // 結合ボタンの状態制御
        const mergeBtn = document.getElementById('merge-layer-btn');
        if (mergeBtn) {
            const canMerge = this.layers.layerOrder.indexOf(layerId) > 0; // 最下位以外
            mergeBtn.style.opacity = canMerge ? '1' : '0.5';
            mergeBtn.style.pointerEvents = canMerge ? 'auto' : 'none';
        }
        
        this.layerPopup.classList.add('show');
    }
    
    hideLayerPopup() {
        if (this.layerPopup) {
            this.layerPopup.classList.remove('show');
            delete this.layerPopup.dataset.layerId;
        }
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    setupPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (title) {
                title.style.cursor = 'move';
                title.addEventListener('mousedown', (e) => this.startDrag(e, popup));
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel') &&
                !e.target.closest('.layer-popup')) {
                this.closeAllPopups();
            }
        });
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
    }
    
    startDrag(e, popup) {
        this.dragState.active = popup;
        const rect = popup.getBoundingClientRect();
        this.dragState.offset.x = e.clientX - rect.left;
        this.dragState.offset.y = e.clientY - rect.top;
        e.preventDefault();
    }
    
    onDrag(e) {
        if (!this.dragState.active) return;
        
        const x = Math.max(0, Math.min(e.clientX - this.dragState.offset.x, 
            window.innerWidth - this.dragState.active.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - this.dragState.offset.y, 
            window.innerHeight - this.dragState.active.offsetHeight));
        
        this.dragState.active.style.left = x + 'px';
        this.dragState.active.style.top = y + 'px';
    }
    
    stopDrag() {
        this.dragState.active = false;
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.tools.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.tools.setOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const slider = {
            value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
        };
        
        this.sliders.set(sliderId, slider);
        
        const update = (value) => {
            slider.value = Math.max(min, Math.min(max, value));
            const percentage = ((slider.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(slider.value);
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            slider.dragging = true;
            update(getValue(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (slider.dragging) update(getValue(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            slider.dragging = false;
        });
        
        update(initial);
    }
    
    setupResize() {
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize());
        }
    }
    
    applyResize() {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                this.engine.resize(width, height);
                this.updateCanvasInfo();
                this.closeAllPopups();
            }
        }
    }
    
    updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element && window.APP_CONFIG && window.APP_CONFIG.canvas) {
            element.textContent = `${window.APP_CONFIG.canvas.width}×${window.APP_CONFIG.canvas.height}px`;
        }
    }
    
    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.hideLayerPopup();
        this.activePopup = null;
    }
}

// ==== Tools Integration and Initialization ====
function initializeToolsSystem() {
    if (!window.futabaApp) {
        console.error('❌ futaba_main.html not loaded');
        return;
    }
    
    const app = window.futabaApp;
    const engine = app.engine;
    
    if (!engine.layerBridge) {
        console.error('❌ LayerBridge not found');
        return;
    }
    
    // システム初期化
    const layerManager = new LayerManager(engine.layerBridge);
    const drawingTools = new DrawingTools(engine, layerManager);
    const interfaceManager = new InterfaceManager(drawingTools, engine, layerManager);
    
    // LayerManager初期化
    layerManager.initialize();
    
    // InterfaceManager初期化
    interfaceManager.initialize();
    
    // AppController に接続
    app.setTools(drawingTools, interfaceManager, layerManager);
    
    log('🎨 Adobe Fresco-style tools system initialized successfully');
    
    console.log('🎨 Futaba Drawing Tool v8rev8 - Adobe Fresco Style Complete!');
    console.log('📋 Adobe Fresco Style Features:');
    console.log('  ✅ Adobe Fresco風レイヤーパネル');
    console.log('  👁️ 3状態SVGアイコン (open/closed/disabled)');
    console.log('  📱 レイヤースワイプ削除 (左右スワイプ)');
    console.log('  🎛️ レイヤーポップアップ (右クリック)');
    console.log('  🔅 不透明度スライダー (0-100%)');
    console.log('  🔗 下のレイヤーと結合機能');
    console.log('  📋 レイヤー複製機能');
    console.log('  🗑️ UNDO通知システム');
    console.log('  🎨 動的チェッカーボード表示');
    console.log('  🛡️ 背景レイヤー保護');
    console.log('  📐 動的高さ調整 (上方向拡張)');
    console.log('  🎪 半透明ガラス効果');
    
    // ショートカット表示
    console.log('🎮 Layer Controls:');
    console.log('  👆 Click: レイヤー選択');
    console.log('  👁️ Eye Click: 表示状態切替 (3状態)');
    console.log('  🖱️ Right Click: レイヤー設定ポップアップ');
    console.log('  📱 Swipe: レイヤー削除 (背景以外)');
    console.log('  ➕ Plus Button: 新規レイヤー追加');
    console.log('  📁 File Button: ファイル追加 (将来実装)');
}

// ==== Auto-initialization ====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToolsSystem);
} else {
    setTimeout(initializeToolsSystem, 10);
}

// ==== Global Access ====
if (typeof window !== 'undefined') {
    window.FutabaTools = {
        LayerManager,
        DrawingTools,
        InterfaceManager,
        initializeToolsSystem,
        version: '8.0.8-fresco-complete'
    };
}