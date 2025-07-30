// Phase 1.5C: OGL統一プロ機能統合ファイル (Stage 2: lodash-es統合最適化版)
import { debounce, throttle, clamp, merge, pick, omit, memoize } from 'lodash-es';

export class OGLProEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.eventBus = oglEngine.eventBus; // mitt統合イベントバス活用
        
        // lodash-es統合による最適化された処理関数
        this.debouncedTextureUpdate = debounce(this.updateTextureMesh.bind(this), 50);
        this.throttledLayerRender = throttle(this.renderLayers.bind(this), 16); // 60fps
        this.memoizedBrushConfig = memoize(this.computeBrushConfig.bind(this), 
            (brushId, settings) => `${brushId}-${JSON.stringify(settings)}`
        );
        
        this.setupProFeatures();
        this.setupEventBusIntegration();
    }
    
    // プロ機能初期化（効率化・バッチ処理）
    setupProFeatures() {
        const features = [
            'TextureSystem',
            'LayerBlending', 
            'ExportSystem',
            'CustomBrushes'
        ];
        
        // バッチで機能初期化（効率化）
        features.forEach(feature => {
            const setupMethod = `setup${feature}`;
            if (this[setupMethod]) {
                this[setupMethod]();
            }
        });
    }
    
    // mittイベントバス統合設定（新規）
    setupEventBusIntegration() {
        // 描画更新の監視・テクスチャ適用
        this.eventBus.on('drawing.update', this.onDrawingUpdate.bind(this));
        
        // 設定変更の監視
        this.eventBus.on('settings.changed', this.onSettingsChanged.bind(this));
        
        // プロ機能状態通知設定
        this.setupProEventEmission();
    }
    
    // プロ機能状態通知設定（新規・mitt活用）
    setupProEventEmission() {
        this.notifyTextureChange = debounce((textureData) => {
            this.eventBus.emit('pro.texture.changed', textureData);
        }, 100);
        
        this.notifyLayerChange = debounce((layerData) => {
            this.eventBus.emit('pro.layer.changed', layerData);
        }, 50);
        
        this.notifyBrushChange = (brushData) => {
            this.eventBus.emit('pro.brush.changed', brushData);
        };
    }
    
    // 描画更新時の処理（mitt連携・効率化）
    onDrawingUpdate(data) {
        // テクスチャブラシ適用（現在のテクスチャがある場合のみ）
        if (this.currentTexture && data.stroke) {
            data.stroke = this.applyTextureBrush(data.stroke);
        }
        
        // アクティブレイヤーにストローク追加
        if (data.stroke && this.layers.length > 0) {
            this.addStrokeToLayer(data.stroke);
        }
    }
    
    // 設定変更時の処理（mitt連携）
    onSettingsChanged(data) {
        if (data.type === 'pro') {
            this.updateProSettings(data.settings);
        }
    }
    
    // OGLテクスチャシステム設定（効率化）
    setupTextureSystem() {
        this.textures = new Map();
        this.currentTexture = null;
        
        // lodash-es merge活用による設定統合
        this.textureConfig = merge({
            scale: 1.0,
            rotation: 0,
            opacity: 1.0,
            wrapS: 'repeat',
            wrapT: 'repeat',
            minFilter: 'linear',
            magFilter: 'linear'
        }, this.engine.settingsManager?.get('pro.texture') || {});
    }
    
    // テクスチャ作成（効率化・エラーハンドリング強化）
    createTexture(imageData, id) {
        if (!this.engine.gl || !imageData) return null;
        
        try {
            const gl = this.engine.gl;
            const texture = gl.createTexture();
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
            
            // lodash-es pick活用による設定適用（効率化）
            const wrapModes = { repeat: gl.REPEAT, clamp: gl.CLAMP_TO_EDGE };
            const filterModes = { linear: gl.LINEAR, nearest: gl.NEAREST };
            
            const config = pick(this.textureConfig, ['wrapS', 'wrapT', 'minFilter', 'magFilter']);
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapModes[config.wrapS] || gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapModes[config.wrapT] || gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterModes[config.minFilter] || gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterModes[config.magFilter] || gl.LINEAR);
            
            this.textures.set(id, texture);
            
            // テクスチャ変更通知（mitt・debounce）
            this.notifyTextureChange({
                id: id,
                config: config,
                textureCount: this.textures.size
            });
            
            return texture;
        } catch (error) {
            console.error('Texture creation failed:', error);
            return null;
        }
    }
    
    // テクスチャブラシ適用（lodash-es merge活用・効率化）
    applyTextureBrush(stroke) {
        if (!this.currentTexture || !stroke) return stroke;
        
        // lodash-es merge活用による設定統合
        const textureData = merge({
            textureId: this.currentTexture,
            scale: this.textureConfig.scale,
            rotation: this.textureConfig.rotation,
            opacity: this.textureConfig.opacity
        }, pick(this.textureConfig, ['blendMode', 'tiling']));
        
        return merge(stroke, textureData);
    }
    
    // テクスチャメッシュ更新（lodash-es debounce活用・効率化）
    updateTextureMesh() {
        // debounce適用により高頻度更新を自動制御
        if (!this.currentTexture) return;
        
        // テクスチャメッシュの更新処理
        this.engine.strokes.forEach(stroke => {
            if (stroke.textureId === this.currentTexture && stroke.mesh) {
                this.applyTextureToMesh(stroke.mesh, stroke);
            }
        });
        
        this.engine.render();
    }
    
    // レイヤーブレンド基盤設定（効率化・構造最適化）
    setupLayerBlending() {
        this.layers = [];
        this.currentLayer = 0;
        this.blendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
        this.currentBlendMode = 'normal';
        
        // デフォルトレイヤー作成
        this.createLayer('default', 'normal', 1.0);
    }
    
    // レイヤー作成（lodash-es merge活用・効率化）
    createLayer(id, blendMode = 'normal', opacity = 1.0) {
        // lodash-es merge活用による設定統合
        const defaultLayer = {
            id: id,
            strokes: [],
            blendMode: 'normal',
            opacity: 1.0,
            visible: true,
            locked: false,
            zIndex: this.layers.length
        };
        
        const layer = merge(defaultLayer, { 
            id, blendMode, opacity,
            createdAt: performance.now()
        });
        
        this.layers.push(layer);
        
        // レイヤー変更通知（mitt・debounce）
        this.notifyLayerChange({
            action: 'create',
            layer: pick(layer, ['id', 'blendMode', 'opacity', 'visible']),
            layerCount: this.layers.length
        });
        
        return layer;
    }
    
    // ストロークをレイヤーに追加（lodash-es clamp活用・効率化）
    addStrokeToLayer(stroke, layerId = null) {
        const targetLayerId = layerId || this.currentLayer;
        const layerIndex = clamp(targetLayerId, 0, this.layers.length - 1);
        const layer = this.layers[layerIndex];
        
        if (layer && !layer.locked) {
            layer.strokes.push(stroke);
            
            // throttle適用によるレイヤーレンダリング最適化
            this.throttledLayerRender();
        }
    }
    
    // レイヤーレンダリング（lodash-es throttle適用・効率化）
    renderLayers() {
        // throttle機能により60fps制御を自動実現
        if (!this.engine.gl) return;
        
        // 可視レイヤーのみをフィルタリング・描画
        const visibleLayers = this.layers.filter(layer => layer.visible);
        
        visibleLayers.forEach(layer => {
            this.applyLayerBlending(layer.blendMode);
            this.renderLayerStrokes(layer);
        });
    }
    
    // レイヤーブレンド適用（効率化・設定マップ化）
    applyLayerBlending(blendMode = this.currentBlendMode) {
        if (!this.engine.gl) return;
        
        const gl = this.engine.gl;
        
        // ブレンドモード設定マップ（効率化）
        const blendConfigs = {
            multiply: [gl.DST_COLOR, gl.ZERO],
            screen: [gl.ONE, gl.ONE_MINUS_SRC_COLOR],
            overlay: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA],
            'soft-light': [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA],
            normal: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA]
        };
        
        const config = blendConfigs[blendMode] || blendConfigs.normal;
        gl.blendFunc(config[0], config[1]);
    }
    
    // エクスポートシステム設定（lodash-es merge活用・効率化）
    setupExportSystem() {
        // lodash-es merge活用による設定統合
        this.exportConfig = merge({
            formats: ['png', 'jpeg', 'svg', 'pdf'],
            quality: 0.9,
            dpi: 300,
            compression: 'lossless',
            colorSpace: 'sRGB'
        }, this.engine.settingsManager?.get('pro.export') || {});
    }
    
    // PNG/JPEG エクスポート（エラーハンドリング強化・効率化）
    exportToRaster(format = 'png', quality = this.exportConfig.quality) {
        if (!this.engine.canvas) return null;
        
        try {
            // lodash-es clamp活用による品質値制限
            const clampedQuality = clamp(quality, 0.1, 1.0);
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            
            return this.engine.canvas.toDataURL(mimeType, clampedQuality);
        } catch (error) {
            console.error('Export failed:', error);
            return null;
        }
    }
    
    // SVG エクスポート（lodash-es活用・効率化・機能強化）
    exportToSVG() {
        const { width, height } = this.engine.canvas;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // SVGヘッダー生成（テンプレート化）
        const svgHeader = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
        
        // ストロークをSVGパスに変換（lodash-es活用・効率化）
        const svgPaths = this.engine.strokes
            .filter(stroke => stroke.points && stroke.points.length > 1)
            .map((stroke, index) => this.generateSVGPath(stroke, centerX, centerY))
            .join('\n');
        
        return `${svgHeader}${svgPaths}\n</svg>`;
    }
    
    // SVGパス生成（独立メソッド化・効率化）
    generateSVGPath(stroke, centerX, centerY) {
        const points = stroke.points;
        const startPoint = points[0];
        
        // 開始点設定
        let pathData = `M ${startPoint.x + centerX} ${-startPoint.y + centerY}`;
        
        // 残りの点をライン追加（効率化）
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            pathData += ` L ${point.x + centerX} ${-point.y + centerY}`;
        }
        
        // スタイル設定（lodash-es pick活用）
        const style = pick(stroke, ['baseSize', 'opacity']);
        const strokeWidth = style.baseSize || 3;
        const opacity = style.opacity || 1;
        
        return `  <path d="${pathData}" stroke="rgb(128,0,0)" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
    }
    
    // カスタムブラシ設定（効率化・設定統合）
    setupCustomBrushes() {
        this.brushes = new Map();
        this.currentBrush = 'default';
        this.setupDefaultBrushes();
    }
    
    // デフォルトブラシ設定（lodash-es merge活用・効率化）
    setupDefaultBrushes() {
        const defaultBrushConfig = {
            size: 3,
            opacity: 1.0,
            hardness: 1.0,
            spacing: 1.0,
            pressureSize: true,
            pressureOpacity: false
        };
        
        // ブラシ設定配列（効率化・バッチ作成）
        const brushConfigs = [
            { id: 'default', name: 'Default Pen', ...defaultBrushConfig },
            { id: 'marker', name: 'Marker', size: 8, opacity: 0.7, hardness: 0.3, spacing: 0.5, pressureOpacity: true },
            { id: 'pencil', name: 'Pencil', size: 2, opacity: 0.8, hardness: 0.8, spacing: 0.8, pressureSize: true, pressureOpacity: true }
        ];
        
        // バッチでブラシ作成（lodash-es merge活用）
        brushConfigs.forEach(config => {
            const { id, ...settings } = config;
            const brush = merge({}, defaultBrushConfig, settings);
            this.brushes.set(id, brush);
        });
    }
    
    // ブラシ切り替え（効率化・設定連携）
    setBrush(brushId) {
        if (!this.brushes.has(brushId)) return false;
        
        this.currentBrush = brushId;
        const brush = this.brushes.get(brushId);
        
        // エンジンのペン設定を更新（lodash-es pick活用）
        const engineSettings = pick(brush, ['size', 'opacity']);
        this.engine.setPenSize(engineSettings.size);
        this.engine.setOpacity(engineSettings.opacity * 100);
        
        // ブラシ変更通知（mitt）
        this.notifyBrushChange({
            brushId: brushId,
            brush: omit(brush, ['texture']), // lodash-es omit活用
            timestamp: performance.now()
        });
        
        return true;
    }
    
    // カスタムブラシ作成（lodash-es merge活用・memoize最適化）
    createCustomBrush(id, settings) {
        // lodash-es memoize活用による設定計算最適化
        const brush = this.memoizedBrushConfig(id, settings);
        
        this.brushes.set(id, brush);
        
        // ブラシ作成通知（mitt）
        this.notifyBrushChange({
            action: 'create',
            brushId: id,
            brush: omit(brush, ['texture']),
            brushCount: this.brushes.size
        });
        
        return brush;
    }
    
    // ブラシ設定計算（memoize対象・効率化）
    computeBrushConfig(id, settings) {
        const defaultBrush = {
            name: 'Custom Brush',
            size: 3,
            opacity: 1.0,
            hardness: 1.0,
            spacing: 1.0,
            pressureSize: true,
            pressureOpacity: false,
            texture: null
        };
        
        // lodash-es merge活用による深い統合
        return merge({}, defaultBrush, settings, {
            id: id,
            createdAt: performance.now()
        });
    }
    
    // 現在のブラシ適用（効率化）
    applyCurrentBrush(stroke) {
        if (!this.currentBrush || !this.brushes.has(this.currentBrush)) {
            return stroke;
        }
        
        const brush = this.brushes.get(this.currentBrush);
        
        // lodash-es merge活用によるストローク拡張
        return merge(stroke, {
            brushId: this.currentBrush,
            brushSettings: pick(brush, ['hardness', 'spacing', 'pressureSize', 'pressureOpacity'])
        });
    }
    
    // プロ設定更新（lodash-es活用・効率化・エラーハンドリング）
    updateProSettings(settings) {
        const updates = {};
        
        // テクスチャ設定更新（lodash-es clamp活用）
        if (settings.textureScale !== undefined) {
            this.textureConfig.scale = clamp(settings.textureScale, 0.1, 5.0);
            updates.textureScale = this.textureConfig.scale;
        }
        
        // ブレンドモード更新
        if (settings.blendMode !== undefined && this.blendModes.includes(settings.blendMode)) {
            this.currentBlendMode = settings.blendMode;
            this.applyLayerBlending();
            updates.blendMode = this.currentBlendMode;
        }
        
        // エクスポート品質更新（lodash-es clamp活用）
        if (settings.exportQuality !== undefined) {
            this.exportConfig.quality = clamp(settings.exportQuality, 0.1, 1.0);
            updates.exportQuality = this.exportConfig.quality;
        }
        
        // 更新通知（mitt・変更があった場合のみ）
        if (Object.keys(updates).length > 0) {
            this.eventBus.emit('pro.settings.updated', {
                updates: updates,
                timestamp: performance.now()
            });
        }
    }
    
    // プロ機能状態取得（lodash-es pick活用・効率化）
    getProState() {
        return {
            currentBrush: this.currentBrush,
            availableBrushes: Array.from(this.brushes.keys()),
            currentBlendMode: this.currentBlendMode,
            availableBlendModes: [...this.blendModes],
            layerCount: this.layers.length,
            textureCount: this.textures.size,
            config: {
                texture: pick(this.textureConfig, ['scale', 'rotation', 'opacity']),
                export: pick(this.exportConfig, ['quality', 'dpi', 'formats'])
            }
        };
    }
    
    // テクスチャをメッシュに適用（新規・効率化）
    applyTextureToMesh(mesh, stroke) {
        if (!mesh.program || !stroke.textureId) return;
        
        // テクスチャユニフォーム更新
        const uniforms = mesh.program.uniforms;
        if (uniforms.uTexture) {
            uniforms.uTexture.value = this.textures.get(stroke.textureId);
        }
        if (uniforms.uTextureScale) {
            uniforms.uTextureScale.value = stroke.scale || 1.0;
        }
        if (uniforms.uTextureRotation) {
            uniforms.uTextureRotation.value = stroke.rotation || 0;
        }
    }
    
    // レイヤーストローク描画（新規・効率化）
    renderLayerStrokes(layer) {
        if (!layer.strokes || layer.strokes.length === 0) return;
        
        // 不透明度適用
        const originalOpacity = this.engine.opacity;
        this.engine.opacity = originalOpacity * layer.opacity;
        
        // ストローク描画
        layer.strokes.forEach(stroke => {
            if (stroke.mesh) {
                stroke.mesh.program.uniforms.uOpacity.value = this.engine.opacity;
            }
        });
        
        // 不透明度復元
        this.engine.opacity = originalOpacity;
    }
    
    // リソースクリーンアップ（lodash-es活用・メモリリーク対策強化）
    cleanup() {
        // WebGLテクスチャのクリーンアップ
        if (this.engine.gl) {
            this.textures.forEach(texture => {
                this.engine.gl.deleteTexture(texture);
            });
        }
        
        // lodash-es関数のクリーンアップ
        if (this.debouncedTextureUpdate.cancel) this.debouncedTextureUpdate.cancel();
        if (this.throttledLayerRender.cancel) this.throttledLayerRender.cancel();
        if (this.memoizedBrushConfig.cache) this.memoizedBrushConfig.cache.clear();
        
        // mittイベントリスナー削除
        if (this.eventBus) {
            this.eventBus.off('drawing.update', this.onDrawingUpdate);
            this.eventBus.off('settings.changed', this.onSettingsChanged);
        }
        
        // リソースクリア
        this.textures.clear();
        this.brushes.clear();
        this.layers.length = 0;
    }
}