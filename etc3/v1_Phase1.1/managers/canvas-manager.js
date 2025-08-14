/**
 * 🖼️ CanvasManager - キャンバス移動・変形制御
 * 責務:
 * - 無限キャンバス管理（pixi-viewport活用）
 * - ズーム・パン制御
 * - 座標変換管理
 * - ビュー制御
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス制御専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, pixi-viewport
 * 📋 VIEWPORT_PLAN: pixi-viewport活用で無限キャンバス実現
 */

class CanvasManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.viewport = null;
        this.canvasSize = { width: 400, height: 400 };
        this.background = null;
        this.drawingContainer = null;
        this.isInitialized = false;
        
        // 座標変換キャッシュ
        this.transformCache = {
            scale: 1,
            x: 0,
            y: 0,
            isDirty: true
        };
    }
    
    async init() {
        console.log('🖼️ CanvasManager 初期化開始...');
        
        try {
            await this.setupViewport();
            await this.setupDrawingContainer();
            await this.setupControls();
            await this.setupBackground();
            
            this.isInitialized = true;
            console.log('✅ CanvasManager 初期化完了');
        } catch (error) {
            console.error('❌ CanvasManager 初期化失敗:', error);
            throw error;
        }
    }
    
    async setupViewport() {
        if (this.extensions.isAvailable('Viewport')) {
            // pixi-viewport使用
            const Viewport = this.extensions.getExtension('Viewport').Viewport;
            
            this.viewport = new Viewport({
                screenWidth: window.innerWidth - 50, // サイドバー分引く
                screenHeight: window.innerHeight,
                worldWidth: 4000,
                worldHeight: 4000,
                interaction: this.appCore.app.renderer.plugins.interaction
            });
            
            // ドラッグ、ピンチ、ホイール、ディセル機能を追加
            this.viewport
                .drag({
                    wheel: false, // ホイールはズームに専念
                    mouseButtons: 'middle' // 中ボタンでドラッグ
                })
                .pinch()
                .wheel({
                    smooth: 3,
                    percent: 0.1
                })
                .decelerate({
                    friction: 0.9
                })
                .clampZoom({
                    minScale: 0.1,
                    maxScale: 5
                });
                
            // 中央に配置
            this.viewport.moveCenter(2000, 2000);
            
            this.appCore.stage.addChild(this.viewport);
            this.drawingContainer = this.viewport;
            
            console.log('✅ pixi-viewport 無限キャンバス有効化');
        } else {
            // フォールバック: 既存実装
            await this.setupFallbackTransform();
        }
    }
    
    async setupDrawingContainer() {
        // 描画専用コンテナ
        if (!this.drawingContainer) {
            this.drawingContainer = new PIXI.Container();
            this.appCore.stage.addChild(this.drawingContainer);
        }
        
        // キャンバス領域の視覚的境界
        await this.createCanvasBounds();
    }
    
    async createCanvasBounds() {
        // キャンバス境界の矩形
        const bounds = new PIXI.Graphics();
        bounds.lineStyle(2, 0xCF9C97, 1); // futaba-medium色
        bounds.drawRect(
            -this.canvasSize.width / 2,
            -this.canvasSize.height / 2,
            this.canvasSize.width,
            this.canvasSize.height
        );
        bounds.name = 'canvas-bounds';
        
        this.drawingContainer.addChild(bounds);
    }
    
    async setupBackground() {
        // 背景（格子模様）
        const bg = new PIXI.Graphics();
        const gridSize = 20;
        const gridColor = 0xF0E0D6; // futaba-cream色
        
        // 格子パターン描画
        bg.lineStyle(1, gridColor, 0.5);
        
        const worldSize = 4000;
        for (let x = -worldSize/2; x <= worldSize/2; x += gridSize) {
            bg.moveTo(x, -worldSize/2);
            bg.lineTo(x, worldSize/2);
        }
        for (let y = -worldSize/2; y <= worldSize/2; y += gridSize) {
            bg.moveTo(-worldSize/2, y);
            bg.lineTo(worldSize/2, y);
        }
        
        bg.name = 'grid-background';
        this.drawingContainer.addChildAt(bg, 0); // 最背面
        this.background = bg;
    }
    
    async setupControls() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.resetView();
            } else if (e.key === 'Home') {
                this.centerCanvas();
            } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.resetZoom();
            }
        });
        
        // リサイズ対応
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // マウス座標追跡（ステータスバー用）
        this.setupMouseTracking();
    }
    
    setupMouseTracking() {
        const canvas = this.appCore.app.view;
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // ワールド座標に変換
            let worldPos = { x, y };
            if (this.viewport) {
                worldPos = this.viewport.toWorld(x, y);
            }
            
            // ステータスバー更新
            this.updateCoordinateDisplay(Math.round(worldPos.x), Math.round(worldPos.y));
        });
    }
    
    updateCoordinateDisplay(x, y) {
        const coordElement = document.getElementById('coordinates');
        if (coordElement) {
            coordElement.textContent = `x: ${x}, y: ${y}`;
        }
    }
    
    async setupFallbackTransform() {
        console.log('⚠️ pixi-viewport未検出: 独自変形システム使用');
        
        // 既存transform-manager.jsとの連携
        this.drawingContainer = new PIXI.Container();
        this.appCore.stage.addChild(this.drawingContainer);
        
        // 基本的なパン・ズーム機能を独自実装
        this.setupBasicTransform();
    }
    
    setupBasicTransform() {
        let isDragging = false;
        let lastPos = { x: 0, y: 0 };
        
        const canvas = this.appCore.app.view;
        
        // 中ボタンドラッグでパン
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // 中ボタン
                isDragging = true;
                lastPos = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastPos.x;
                const dy = e.clientY - lastPos.y;
                
                this.drawingContainer.x += dx;
                this.drawingContainer.y += dy;
                
                lastPos = { x: e.clientX, y: e.clientY };
            }
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                isDragging = false;
            }
        });
        
        // ホイールでズーム
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.1, Math.min(5, this.drawingContainer.scale.x * scaleFactor));
            
            this.drawingContainer.scale.set(newScale);
        });
    }
    
    resetView() {
        if (this.viewport) {
            if (this.extensions.isAvailable('GSAP')) {
                // GSAP でスムーズアニメーション
                this.extensions.getExtension('GSAP').gsap.to(this.viewport, {
                    duration: 0.5,
                    ease: "power2.out",
                    onUpdate: () => {
                        this.viewport.moveCenter(2000, 2000);
                        this.viewport.setZoom(1);
                    }
                });
            } else {
                this.viewport.moveCenter(2000, 2000);
                this.viewport.setZoom(1);
            }
        } else if (this.drawingContainer) {
            this.drawingContainer.position.set(0, 0);
            this.drawingContainer.scale.set(1);
        }
        
        console.log('🔄 ビューリセット');
    }
    
    centerCanvas() {
        if (this.viewport) {
            this.viewport.moveCenter(2000, 2000);
        } else if (this.drawingContainer) {
            this.drawingContainer.position.set(
                (window.innerWidth - 50) / 2,
                window.innerHeight / 2
            );
        }
        console.log('🎯 キャンバス中央揃え');
    }
    
    resetZoom() {
        if (this.viewport) {
            this.viewport.setZoom(1);
        } else if (this.drawingContainer) {
            this.drawingContainer.scale.set(1);
        }
        console.log('🔍 ズームリセット');
    }
    
    handleResize() {
        const newWidth = window.innerWidth - 50;
        const newHeight = window.innerHeight;
        
        if (this.viewport) {
            this.viewport.resize(newWidth, newHeight);
        }
        
        console.log(`📐 リサイズ対応: ${newWidth}x${newHeight}`);
    }
    
    getDrawingContainer() {
        return this.drawingContainer || this.appCore.stage;
    }
    
    setCanvasSize(width, height) {
        this.canvasSize = { width, height };
        
        // 境界矩形更新
        const bounds = this.drawingContainer.getChildByName('canvas-bounds');
        if (bounds) {
            bounds.clear();
            bounds.lineStyle(2, 0xCF9C97, 1);
            bounds.drawRect(-width / 2, -height / 2, width, height);
        }
        
        // ステータスバー更新
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${width}×${height}px`;
        }
        
        console.log(`📐 キャンバスサイズ変更: ${width}x${height}`);
    }
    
    getCanvasSize() {
        return { ...this.canvasSize };
    }
    
    // 座標変換ユーティリティ
    screenToWorld(screenX, screenY) {
        if (this.viewport) {
            return this.viewport.toWorld(screenX, screenY);
        }
        
        // フォールバック実装
        const scale = this.drawingContainer.scale.x;
        const worldX = (screenX - this.drawingContainer.x) / scale;
        const worldY = (screenY - this.drawingContainer.y) / scale;
        
        return { x: worldX, y: worldY };
    }
    
    worldToScreen(worldX, worldY) {
        if (this.viewport) {
            return this.viewport.toScreen(worldX, worldY);
        }
        
        // フォールバック実装
        const scale = this.drawingContainer.scale.x;
        const screenX = worldX * scale + this.drawingContainer.x;
        const screenY = worldY * scale + this.drawingContainer.y;
        
        return { x: screenX, y: screenY };
    }
    
    getCurrentZoom() {
        if (this.viewport) {
            return this.viewport.scale.x;
        }
        return this.drawingContainer ? this.drawingContainer.scale.x : 1;
    }
    
    getCurrentCenter() {
        if (this.viewport) {
            return this.viewport.center;
        }
        return { x: 0, y: 0 };
    }
    
    // ビューポート状態の保存・復元（設定管理用）
    getViewportState() {
        return {
            zoom: this.getCurrentZoom(),
            center: this.getCurrentCenter(),
            canvasSize: this.getCanvasSize()
        };
    }
    
    setViewportState(state) {
        if (state.canvasSize) {
            this.setCanvasSize(state.canvasSize.width, state.canvasSize.height);
        }
        
        if (this.viewport && state.center) {
            this.viewport.moveCenter(state.center.x, state.center.y);
            if (state.zoom) {
                this.viewport.setZoom(state.zoom);
            }
        }
    }
    
    // 開発用デバッグメソッド
    debugViewport() {
        const info = {
            initialized: this.isInitialized,
            hasViewport: !!this.viewport,
            canvasSize: this.canvasSize,
            zoom: this.getCurrentZoom(),
            center: this.getCurrentCenter()
        };
        
        console.table(info);
        return info;
    }
}