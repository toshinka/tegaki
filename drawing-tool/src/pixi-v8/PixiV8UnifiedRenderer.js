/**
 * PixiJS v8統一レンダラー・WebGPU対応
 * モダンお絵かきツール v3.3 - Phase1基盤レンダリングシステム
 * 
 * 機能:
 * - PixiJS v8統一描画処理・WebGPU活用
 * - Container階層管理・非破壊ベクター保持
 * - Chrome API統合・高速レンダリング
 * - ふたば色統合・GPU最適化
 * - 座標系統一・干渉問題根絶
 */

import { Container, Graphics, Text, Sprite, RenderTexture, Point } from 'pixi.js';

/**
 * PixiJS v8統一レンダラー
 * WebGPU優先・非破壊ベクター・Container階層管理
 */
class PixiV8UnifiedRenderer {
    constructor(pixiApp) {
        this.app = pixiApp;
        this.renderer = pixiApp.renderer;
        this.stage = pixiApp.stage;
        
        // Container階層管理（PixiJS v8統一構造）
        this.backgroundLayer = new Container();
        this.drawingLayers = new Container();
        this.uiLayer = new Container();
        this.overlayLayer = new Container();
        
        // 描画状態管理
        this.currentLayer = null;
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        
        // PixiJS v8最適化設定
        this.renderSettings = {
            antialias: true,
            powerPreference: 'high-performance',
            webgpu: this.renderer.type === 'webgpu'
        };
        
        // ふたば色パレット（v3.3統合）
        this.futabaColors = {
            maroon: 0x800000,
            lightMaroon: 0xaa5a56,
            medium: 0xcf9c97,
            lightMedium: 0xe9c2ba,
            cream: 0xf0e0d6,
            background: 0xffffee
        };
        
        this.initializeContainerHierarchy();
        this.setupRenderOptimizations();
        
        console.log(`✅ PixiV8UnifiedRenderer初期化完了 - ${this.renderSettings.webgpu ? 'WebGPU' : 'WebGL2'}`);
    }
    
    /**
     * Container階層初期化
     * PixiJS v8統一構造・レイヤー管理
     */
    initializeContainerHierarchy() {
        // 階層順序設定（背景→描画→UI→オーバーレイ）
        this.stage.addChild(
            this.backgroundLayer,    // z-index: 0
            this.drawingLayers,      // z-index: 1
            this.uiLayer,           // z-index: 2
            this.overlayLayer       // z-index: 3
        );
        
        // 背景レイヤー初期化（ふたば背景色）
        const background = new Graphics();
        background
            .rect(0, 0, this.app.screen.width, this.app.screen.height)
            .fill({ color: this.futabaColors.background });
        this.backgroundLayer.addChild(background);
        
        // デフォルト描画レイヤー作成
        this.currentLayer = new Container();
        this.currentLayer.name = 'layer-1';
        this.drawingLayers.addChild(this.currentLayer);
        
        console.log('📐 Container階層初期化完了 - PixiJS v8統一構造');
    }
    
    /**
     * レンダリング最適化設定
     * WebGPU・Chrome API活用・GPU加速
     */
    setupRenderOptimizations() {
        // WebGPU最適化設定
        if (this.renderSettings.webgpu) {
            console.log('🚀 WebGPU最適化設定適用');
            
            // WebGPU専用最適化
            this.renderer.batch.setMaxTextures(32);
            this.renderer.batch.size = 4096;
        }
        
        // Chrome API最適化
        if (typeof OffscreenCanvas !== 'undefined') {
            console.log('⚡ OffscreenCanvas対応確認');
        }
        
        // アンチエイリアス・高品質設定
        this.renderer.antialias = true;
        
        // GPU加速Container設定
        this.drawingLayers.cullable = true;
        this.uiLayer.cullable = false; // UI要素は常時描画
        
        console.log('⚡ レンダリング最適化設定完了');
    }
    
    /**
     * 描画開始処理
     * PixiJS v8統一・非破壊ベクター開始
     */
    beginDrawing(event) {
        if (this.isDrawing) return;
        
        this.isDrawing = true;
        this.strokePoints = [];
        
        // 新しいストローク作成（PixiJS v8 Graphics）
        this.currentStroke = new Graphics();
        
        // 描画設定適用
        const toolConfig = event.toolConfig || {
            size: 2,
            color: this.futabaColors.maroon,
            opacity: 1.0,
            tool: 'pen'
        };
        
        this.currentStroke.lineStyle({
            width: toolConfig.size,
            color: toolConfig.color,
            alpha: toolConfig.opacity,
            cap: 'round',
            join: 'round'
        });
        
        // 初期点追加
        const point = new Point(event.x, event.y);
        this.strokePoints.push(point);
        this.currentStroke.moveTo(point.x, point.y);
        
        // 現在レイヤーに追加
        this.currentLayer.addChild(this.currentStroke);
        
        console.log(`🖌️ 描画開始 - 座標: (${event.x}, ${event.y})`);
    }
    
    /**
     * 描画更新処理
     * PixiJS v8統一・スムージング・リアルタイム描画
     */
    updateDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const point = new Point(event.x, event.y);
        this.strokePoints.push(point);
        
        // スムージング描画（ベジエ曲線）
        if (this.strokePoints.length >= 3) {
            const len = this.strokePoints.length;
            const prevPoint = this.strokePoints[len - 2];
            const currentPoint = this.strokePoints[len - 1];
            
            // 中点計算
            const midX = (prevPoint.x + currentPoint.x) / 2;
            const midY = (prevPoint.y + currentPoint.y) / 2;
            
            // 二次ベジエ曲線描画
            this.currentStroke.quadraticCurveTo(
                prevPoint.x, prevPoint.y,
                midX, midY
            );
        }
        
        // 即座レンダリング（WebGPU活用）
        this.renderer.render(this.stage);
    }
    
    /**
     * 描画終了処理
     * PixiJS v8統一・ベクターデータ確定・非破壊保持
     */
    endDrawing(event) {
        if (!this.isDrawing) return;
        
        // 最終点まで描画
        if (this.strokePoints.length > 1) {
            const lastPoint = this.strokePoints[this.strokePoints.length - 1];
            this.currentStroke.lineTo(lastPoint.x, lastPoint.y);
        }
        
        // ベクターデータメタ情報保存（非破壊性保証）
        this.currentStroke.vectorData = {
            points: [...this.strokePoints], // 元データ保持
            timestamp: Date.now(),
            tool: event.toolConfig?.tool || 'pen',
            settings: { ...event.toolConfig }
        };
        
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        
        console.log('✅ 描画終了 - ベクターデータ保存完了');
    }
    
    /**
     * レイヤー作成
     * PixiJS v8 Container・階層管理
     */
    createLayer(name = null) {
        const layerName = name || `layer-${this.drawingLayers.children.length + 1}`;
        const newLayer = new Container();
        newLayer.name = layerName;
        
        // レイヤーメタデータ
        newLayer.layerData = {
            id: this.generateLayerId(),
            name: layerName,
            visible: true,
            opacity: 1.0,
            blendMode: 'normal',
            created: Date.now()
        };
        
        this.drawingLayers.addChild(newLayer);
        console.log(`📄 レイヤー作成: ${layerName}`);
        
        return newLayer;
    }
    
    /**
     * レイヤー切り替え
     * PixiJS v8統一・アクティブレイヤー管理
     */
    setActiveLayer(layer) {
        if (layer && layer.parent === this.drawingLayers) {
            this.currentLayer = layer;
            console.log(`🎯 アクティブレイヤー切り替え: ${layer.name}`);
            return true;
        }
        return false;
    }
    
    /**
     * レイヤーサムネイル生成
     * PixiJS v8 RenderTexture・高速処理
     */
    generateLayerThumbnail(layer, size = 64) {
        if (!layer || layer.children.length === 0) {
            return this.createEmptyThumbnail(size);
        }
        
        // RenderTexture作成（PixiJS v8）
        const renderTexture = RenderTexture.create({
            width: size,
            height: size
        });
        
        // レイヤーを一時的にスケール調整
        const originalScale = layer.scale.clone();
        const bounds = layer.getBounds();
        
        if (bounds.width > 0 && bounds.height > 0) {
            const scale = Math.min(
                size / bounds.width,
                size / bounds.height
            );
            layer.scale.set(scale);
            layer.position.set(-bounds.x * scale, -bounds.y * scale);
        }
        
        // レンダリング実行
        this.renderer.render(layer, { renderTexture });
        
        // 元のスケール・位置復元
        layer.scale.copyFrom(originalScale);
        layer.position.set(0, 0);
        
        return renderTexture;
    }
    
    /**
     * 空サムネイル作成
     * ふたば色・統一デザイン
     */
    createEmptyThumbnail(size) {
        const renderTexture = RenderTexture.create({
            width: size,
            height: size
        });
        
        const graphics = new Graphics();
        graphics
            .rect(0, 0, size, size)
            .fill({ color: this.futabaColors.background })
            .stroke({ width: 1, color: this.futabaColors.maroon, alpha: 0.3 });
        
        this.renderer.render(graphics, { renderTexture });
        graphics.destroy();
        
        return renderTexture;
    }
    
    /**
     * Canvas全体クリア
     * PixiJS v8統一・選択的クリア
     */
    clearCanvas() {
        this.drawingLayers.removeChildren();
        
        // デフォルトレイヤー再作成
        this.currentLayer = this.createLayer('layer-1');
        
        console.log('🗑️ Canvas全体クリア完了');
    }
    
    /**
     * レイヤークリア
     * PixiJS v8統一・非破壊性保証
     */
    clearLayer(layer = null) {
        const targetLayer = layer || this.currentLayer;
        if (!targetLayer) return;
        
        targetLayer.removeChildren();
        console.log(`🗑️ レイヤークリア完了: ${targetLayer.name}`);
    }
    
    /**
     * リサイズハンドリング
     * PixiJS v8統一・座標系維持
     */
    handleCanvasResize(width, height) {
        this.renderer.resize(width, height);
        
        // 背景サイズ更新
        if (this.backgroundLayer.children.length > 0) {
            const background = this.backgroundLayer.children[0];
            background.clear();
            background
                .rect(0, 0, width, height)
                .fill({ color: this.futabaColors.background });
        }
        
        console.log(`📐 Canvas リサイズ: ${width}x${height}`);
    }
    
    /**
     * UI要素描画
     * PixiJS v8 Text・Sprite統一
     */
    drawUIText(text, x, y, style = {}) {
        const textStyle = {
            fontFamily: 'Arial, sans-serif',
            fontSize: style.fontSize || 12,
            fill: style.color || this.futabaColors.cream,
            ...style
        };
        
        const pixiText = new Text({ text, style: textStyle });
        pixiText.x = x;
        pixiText.y = y;
        
        this.uiLayer.addChild(pixiText);
        return pixiText;
    }
    
    /**
     * アイコンスプライト描画
     * PixiJS v8 Sprite・Phosphor Icons統合
     */
    drawUIIcon(iconTexture, x, y, size = 44) {
        const sprite = new Sprite(iconTexture);
        sprite.x = x;
        sprite.y = y;
        sprite.width = size;
        sprite.height = size;
        sprite.anchor.set(0.5);
        
        this.uiLayer.addChild(sprite);
        return sprite;
    }
    
    /**
     * ユーティリティ: レイヤーID生成
     */
    generateLayerId() {
        return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            webgpu: this.renderSettings.webgpu,
            rendererType: this.renderer.type,
            layerCount: this.drawingLayers.children.length,
            activeLayer: this.currentLayer?.name || 'none',
            isDrawing: this.isDrawing,
            strokePoints: this.strokePoints.length,
            containers: {
                background: this.backgroundLayer.children.length,
                drawing: this.drawingLayers.children.length,
                ui: this.uiLayer.children.length,
                overlay: this.overlayLayer.children.length
            }
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        this.backgroundLayer.destroy();
        this.drawingLayers.destroy();
        this.uiLayer.destroy();
        this.overlayLayer.destroy();
        
        console.log('🗑️ PixiV8UnifiedRenderer リソース解放完了');
    }
}

export default PixiV8UnifiedRenderer;