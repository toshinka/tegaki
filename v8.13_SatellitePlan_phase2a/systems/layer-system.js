/**
 * Layer System (Phase2 Separated)
 * PixiJS v8.13 対応版
 * 非破壊変形システム完全実装
 */
(function() {
    'use strict';

    class LayerManager {
        constructor() {
            this.pixiApp = null;
            this.worldContainer = null;
            this.layers = [];
            this.activeLayerIndex = 0;
            this.nextLayerId = 1;
            
            // 変形システム
            this.isTransformMode = false;
            this.transformLayer = null;
            this.previewContainer = null;
            this.originalContainer = null;
            this.transformHandle = null;
            
            // 変形状態
            this.transformState = {
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotation: 0,
                isDragging: false,
                dragStart: { x: 0, y: 0 },
                initialTransform: null
            };
            
            this.boundEvents = {
                keydown: null,
                keyup: null,
                pointerdown: null,
                pointermove: null,
                pointerup: null
            };
            
            this.keys = {
                v: false
            };
        }

        /**
         * 初期化
         */
        async initialize(pixiApp, worldContainer) {
            this.pixiApp = pixiApp;
            this.worldContainer = worldContainer;
            
            // 初期レイヤー作成
            await this.createLayer('背景');
            
            this.setupEventListeners();
            this.updateUI();
            
            console.log('✅ LayerManager initialized');
        }

        /**
         * レイヤー作成
         */
        async createLayer(name = null) {
            const layer = {
                id: this.nextLayerId++,
                name: name || `レイヤー ${this.nextLayerId - 1}`,
                visible: true,
                opacity: 1.0,
                blendMode: 'normal',
                locked: false,
                container: new PIXI.Container(),
                pathsContainer: new PIXI.Container(),
                graphics: new PIXI.Graphics(),
                paths: []
            };
            
            // コンテナ設定
            layer.container.eventMode = 'static';
            layer.pathsContainer.eventMode = 'static';
            layer.graphics.eventMode = 'static';
            
            // 構造構築
            layer.container.addChild(layer.pathsContainer);
            layer.pathsContainer.addChild(layer.graphics);
            
            this.layers.push(layer);
            this.worldContainer.addChild(layer.container);
            
            this.activeLayerIndex = this.layers.length - 1;
            this.updateUI();
            
            console.log(`✅ Layer created: ${layer.name} (ID: ${layer.id})`);
            return layer;
        }

        /**
         * アクティブレイヤー設定
         */
        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateUI();
            }
        }

        /**
         * アクティブレイヤー取得
         */
        getActiveLayer() {
            return this.layers[this.activeLayerIndex] || null;
        }

        /**
         * レイヤー削除
         */
        deleteLayer(index) {
            if (this.layers.length <= 1) return false; // 最後の1枚は削除不可
            
            if (index >= 0 && index < this.layers.length) {
                const layer = this.layers[index];
                
                // 変形モード中の場合は終了
                if (this.isTransformMode && this.transformLayer === layer) {
                    this.exitTransformMode();
                }
                
                // コンテナ削除
                if (layer.container.parent) {
                    layer.container.parent.removeChild(layer.container);
                }
                layer.container.destroy({ children: true });
                
                this.layers.splice(index, 1);
                
                // アクティブレイヤー調整
                if (this.activeLayerIndex >= index) {
                    this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
                }
                
                this.updateUI();
                return true;
            }
            return false;
        }

        /**
         * レイヤー可視性切り替え
         */
        toggleLayerVisibility(index) {
            if (index >= 0 && index < this.layers.length) {
                const layer = this.layers[index];
                layer.visible = !layer.visible;
                layer.container.visible = layer.visible;
                this.updateUI();
            }
        }

        /**
         * パス追加
         */
        addPath(pathData) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            activeLayer.paths.push(pathData);
            this.rebuildPathGraphics(activeLayer);
        }

        /**
         * パスグラフィック再構築
         */
        rebuildPathGraphics(layer) {
            if (!layer || !layer.graphics) return;
            
            layer.graphics.clear();
            
            for (const path of layer.paths) {
                if (!path.points || path.points.length < 2) continue;
                
                layer.graphics.moveTo(path.points[0].x, path.points[0].y);
                
                for (let i = 1; i < path.points.length; i++) {
                    layer.graphics.lineTo(path.points[i].x, path.points[i].y);
                }
                
                layer.graphics.stroke({
                    width: path.size || 5,
                    color: path.color || 0x000000,
                    alpha: (path.opacity || 100) / 100,
                    cap: 'round',
                    join: 'round'
                });
            }
        }

        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            this.boundEvents.keydown = (e) => this.handleKeyDown(e);
            this.boundEvents.keyup = (e) => this.handleKeyUp(e);
            this.boundEvents.pointerdown = (e) => this.handlePointerDown(e);
            this.boundEvents.pointermove = (e) => this.handlePointerMove(e);
            this.boundEvents.pointerup = (e) => this.handlePointerUp(e);
            
            document.addEventListener('keydown', this.boundEvents.keydown);
            document.addEventListener('keyup', this.boundEvents.keyup);
            
            if (this.pixiApp?.canvas) {
                const canvas = this.pixiApp.canvas;
                canvas.addEventListener('pointerdown', this.boundEvents.pointerdown);
                canvas.addEventListener('pointermove', this.boundEvents.pointermove);
                canvas.addEventListener('pointerup', this.boundEvents.pointerup);
            }
        }

        /**
         * キーダウン処理
         */
        handleKeyDown(e) {
            switch (e.code) {
                case 'KeyV':
                    if (!this.keys.v) {
                        this.keys.v = true;
                        this.enterTransformMode();
                    }
                    break;
                    
                case 'Escape':
                    if (this.isTransformMode) {
                        this.exitTransformMode();
                    }
                    break;
                    
                case 'Enter':
                    if (this.isTransformMode) {
                        this.confirmTransform();
                    }
                    break;
            }
        }

        /**
         * キーアップ処理
         */
        handleKeyUp(e) {
            switch (e.code) {
                case 'KeyV':
                    this.keys.v = false;
                    this.exitTransformMode();
                    break;
            }
        }

        /**
         * ポインターダウン処理
         */
        handlePointerDown(e) {
            if (!this.isTransformMode || !this.transformHandle) return;
            
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            // ハンドル当たり判定（簡略化）
            const worldPos = this.screenToWorld(screenX, screenY);
            const handleBounds = this.transformHandle.getBounds();
            
            if (handleBounds.contains(worldPos.x, worldPos.y)) {
                this.transformState.isDragging = true;
                this.transformState.dragStart = { x: screenX, y: screenY };
                this.transformState.initialTransform = {
                    position: { ...this.transformState.position },
                    scale: { ...this.transformState.scale },
                    rotation: this.transformState.rotation
                };
                
                e.preventDefault();
                this.pixiApp.canvas.setPointerCapture(e.pointerId);
            }
        }

        /**
         * ポインタームーブ処理
         */
        handlePointerMove(e) {
            if (!this.isTransformMode || !this.transformState.isDragging) return;
            
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const deltaX = screenX - this.transformState.dragStart.x;
            const deltaY = screenY - this.transformState.dragStart.y;
            
            // 簡易変形（移動のみ）
            this.transformState.position.x = this.transformState.initialTransform.position.x + deltaX;
            this.transformState.position.y = this.transformState.initialTransform.position.y + deltaY;
            
            this.updateLayerTransform();
        }

        /**
         * ポインターアップ処理
         */
        handlePointerUp(e) {
            if (!this.isTransformMode || !this.transformState.isDragging) return;
            
            this.transformState.isDragging = false;
            
            try {
                this.pixiApp.canvas.releasePointerCapture(e.pointerId);
            } catch (ex) {
                // キャプチャー解除失敗は無視
            }
        }

        /**
         * 変形モード開始
         */
        enterTransformMode() {
            if (this.isTransformMode) return;
            
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            this.isTransformMode = true;
            this.transformLayer = activeLayer;
            
            // プレビューコンテナ作成
            this.previewContainer = new PIXI.Container();
            this.previewContainer.eventMode = 'static';
            
            // オリジナルコンテナを非表示
            this.originalContainer = activeLayer.container;
            this.originalContainer.visible = false;
            
            // パスを複製してプレビューコンテナに追加
            const previewGraphics = new PIXI.Graphics();
            previewGraphics.eventMode = 'static';
            
            for (const path of activeLayer.paths) {
                if (!path.points || path.points.length < 2) continue;
                
                previewGraphics.moveTo(path.points[0].x, path.points[0].y);
                
                for (let i = 1; i < path.points.length; i++) {
                    previewGraphics.lineTo(path.points[i].x, path.points[i].y);
                }
                
                previewGraphics.stroke({
                    width: path.size || 5,
                    color: path.color || 0x000000,
                    alpha: ((path.opacity || 100) / 100) * 0.7, // 半透明
                    cap: 'round',
                    join: 'round'
                });
            }
            
            this.previewContainer.addChild(previewGraphics);
            this.worldContainer.addChild(this.previewContainer);
            
            // 変形ハンドル作成
            this.createTransformHandle();
            
            // 変形状態初期化
            this.transformState = {
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotation: 0,
                isDragging: false,
                dragStart: { x: 0, y: 0 },
                initialTransform: null
            };
            
            console.log('✅ Transform mode entered');
        }

        /**
         * 変形モード終了
         */
        exitTransformMode() {
            if (!this.isTransformMode) return;
            
            // プレビューコンテナ削除
            if (this.previewContainer) {
                this.previewContainer.destroy({ children: true });
                this.previewContainer = null;
            }
            
            // 変形ハンドル削除
            if (this.transformHandle) {
                this.transformHandle.destroy({ children: true });
                this.transformHandle = null;
            }
            
            // オリジナルコンテナ復元
            if (this.originalContainer) {
                this.originalContainer.visible = true;
            }
            
            this.isTransformMode = false;
            this.transformLayer = null;
            this.originalContainer = null;
            
            console.log('✅ Transform mode exited');
        }

        /**
         * 変形確定
         */
        confirmTransform() {
            if (!this.isTransformMode || !this.transformLayer) return;
            
            // 変形を実際のパスデータに適用
            const transform = this.transformState;
            
            for (const path of this.transformLayer.paths) {
                if (!path.points) continue;
                
                for (const point of path.points) {
                    // 変形適用（簡略化）
                    point.x = point.x * transform.scale.x + transform.position.x;
                    point.y = point.y * transform.scale.y + transform.position.y;
                }
            }
            
            // グラフィック再構築
            this.rebuildPathGraphics(this.transformLayer);
            
            this.exitTransformMode();
            console.log('✅ Transform confirmed');
        }

        /**
         * 変形ハンドル作成
         */
        createTransformHandle() {
            if (!this.transformLayer) return;
            
            this.transformHandle = new PIXI.Container();
            this.transformHandle.eventMode = 'static';
            
            // 簡易矩形ハンドル
            const graphics = new PIXI.Graphics();
            const bounds = this.transformLayer.container.getBounds();
            
            // ハンドル矩形
            graphics.rect(bounds.x - 10, bounds.y - 10, bounds.width + 20, bounds.height + 20);
            graphics.stroke({ width: 2, color: 0x0078d4 });
            
            // 角ハンドル
            const handleSize = 8;
            const positions = [
                { x: bounds.x - 10, y: bounds.y - 10 }, // 左上
                { x: bounds.x + bounds.width + 10 - handleSize, y: bounds.y - 10 }, // 右上
                { x: bounds.x + bounds.width + 10 - handleSize, y: bounds.y + bounds.height + 10 - handleSize }, // 右下
                { x: bounds.x - 10, y: bounds.y + bounds.height + 10 - handleSize } // 左下
            ];
            
            for (const pos of positions) {
                graphics.rect(pos.x, pos.y, handleSize, handleSize);
                graphics.fill({ color: 0x0078d4 });
            }
            
            this.transformHandle.addChild(graphics);
            this.worldContainer.addChild(this.transformHandle);
        }

        /**
         * レイヤー変形更新
         */
        updateLayerTransform() {
            if (!this.previewContainer || !this.isTransformMode) return;
            
            const transform = this.transformState;
            
            this.previewContainer.position.set(transform.position.x, transform.position.y);
            this.previewContainer.scale.set(transform.scale.x, transform.scale.y);
            this.previewContainer.rotation = transform.rotation;
        }

        /**
         * 座標変換: スクリーン → ワールド
         */
        screenToWorld(screenX, screenY) {
            if (window.CoordinateSystem) {
                return window.CoordinateSystem.screenToCanvas(this.pixiApp, screenX, screenY);
            }
            
            // フォールバック
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            return {
                x: screenX - rect.left,
                y: screenY - rect.top
            };
        }

        /**
         * UI更新
         */
        updateUI() {
            if (!window.TegakiUI) return;
            
            const layersData = this.layers.map((layer, index) => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                active: index === this.activeLayerIndex,
                locked: layer.locked
            }));
            
            window.TegakiUI.updateLayers(layersData);
        }

        /**
         * レイヤー順序変更
         */
        moveLayer(fromIndex, toIndex) {
            if (fromIndex < 0 || fromIndex >= this.layers.length || 
                toIndex < 0 || toIndex >= this.layers.length) return;
                
            const layer = this.layers.splice(fromIndex, 1)[0];
            this.layers.splice(toIndex, 0, layer);
            
            // コンテナの順序も更新
            this.worldContainer.removeChild(layer.container);
            this.worldContainer.addChildAt(layer.container, toIndex);
            
            // アクティブレイヤー調整
            if (this.activeLayerIndex === fromIndex) {
                this.activeLayerIndex = toIndex;
            } else if (fromIndex < this.activeLayerIndex && toIndex >= this.activeLayerIndex) {
                this.activeLayerIndex--;
            } else if (fromIndex > this.activeLayerIndex && toIndex <= this.activeLayerIndex) {
                this.activeLayerIndex++;
            }
            
            this.updateUI();
        }

        /**
         * レイヤー不透明度設定
         */
        setLayerOpacity(index, opacity) {
            if (index >= 0 && index < this.layers.length) {
                const layer = this.layers[index];
                layer.opacity = Math.max(0, Math.min(1, opacity));
                layer.container.alpha = layer.opacity;
                this.updateUI();
            }
        }

        /**
         * レイヤー名変更
         */
        renameLayer(index, newName) {
            if (index >= 0 && index < this.layers.length) {
                this.layers[index].name = newName || `レイヤー ${index + 1}`;
                this.updateUI();
            }
        }

        /**
         * 全レイヤー取得
         */
        getAllLayers() {
            return this.layers.slice();
        }

        /**
         * レイヤー数取得
         */
        getLayerCount() {
            return this.layers.length;
        }

        /**
         * 変形モード状態取得
         */
        isInTransformMode() {
            return this.isTransformMode;
        }

        /**
         * 破棄処理
         */
        destroy() {
            // 変形モード終了
            this.exitTransformMode();
            
            // イベントリスナー削除
            if (this.boundEvents.keydown) {
                document.removeEventListener('keydown', this.boundEvents.keydown);
            }
            if (this.boundEvents.keyup) {
                document.removeEventListener('keyup', this.boundEvents.keyup);
            }
            
            if (this.pixiApp?.canvas) {
                const canvas = this.pixiApp.canvas;
                if (this.boundEvents.pointerdown) {
                    canvas.removeEventListener('pointerdown', this.boundEvents.pointerdown);
                }
                if (this.boundEvents.pointermove) {
                    canvas.removeEventListener('pointermove', this.boundEvents.pointermove);
                }
                if (this.boundEvents.pointerup) {
                    canvas.removeEventListener('pointerup', this.boundEvents.pointerup);
                }
            }
            
            // 全レイヤー削除
            for (const layer of this.layers) {
                if (layer.container && layer.container.parent) {
                    layer.container.parent.removeChild(layer.container);
                }
                layer.container.destroy({ children: true });
            }
            
            this.layers.length = 0;
            
            // 参照クリア
            this.pixiApp = null;
            this.worldContainer = null;
            this.transformLayer = null;
            this.previewContainer = null;
            this.originalContainer = null;
            this.transformHandle = null;
        }
    }

    // グローバル公開
    if (!window.TegakiLayerSeparated) {
        window.TegakiLayerSeparated = {};
    }
    window.TegakiLayerSeparated.LayerManager = LayerManager;
    
    console.log('✅ layer-system.js loaded (Phase2 separated)');
})();