// Phase 1.5C: OGL統一プロ機能統合ファイル
export class OGLProEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupProFeatures();
    }
    
    // プロ機能初期化
    setupProFeatures() {
        this.setupTextureSystem();
        this.setupLayerBlending();
        this.setupExportSystem();
        this.setupCustomBrushes();
    }
    
    // OGLテクスチャシステム設定
    setupTextureSystem() {
        this.textures = new Map();
        this.currentTexture = null;
        this.textureScale = 1.0;
        this.textureRotation = 0;
        this.textureOpacity = 1.0;
    }
    
    // テクスチャ作成
    createTexture(imageData, id) {
        if (!this.engine.gl || !imageData) return null;
        
        const gl = this.engine.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        
        // テクスチャパラメータ設定
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        this.textures.set(id, texture);
        return texture;
    }
    
    // テクスチャブラシ適用
    applyTextureBrush(stroke) {
        if (!this.currentTexture || !stroke) return stroke;
        
        // テクスチャ情報をストロークに追加
        stroke.textureId = this.currentTexture;
        stroke.textureScale = this.textureScale;
        stroke.textureRotation = this.textureRotation;
        stroke.textureOpacity = this.textureOpacity;
        
        return stroke;
    }
    
    // レイヤーブレンド基盤設定
    setupLayerBlending() {
        this.layers = [];
        this.currentLayer = 0;
        this.blendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
        this.currentBlendMode = 'normal';
    }
    
    // レイヤー作成
    createLayer(id, blendMode = 'normal', opacity = 1.0) {
        const layer = {
            id: id,
            strokes: [],
            blendMode: blendMode,
            opacity: opacity,
            visible: true,
            locked: false
        };
        
        this.layers.push(layer);
        return layer;
    }
    
    // ストロークをレイヤーに追加
    addStrokeToLayer(stroke, layerId = null) {
        const targetLayerId = layerId || this.currentLayer;
        const layer = this.layers.find(l => l.id === targetLayerId);
        
        if (layer && !layer.locked) {
            layer.strokes.push(stroke);
        }
    }
    
    // レイヤーブレンド適用
    applyLayerBlending() {
        if (!this.engine.gl) return;
        
        const gl = this.engine.gl;
        
        // ブレンドモードに応じたGL設定
        switch (this.currentBlendMode) {
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 'screen':
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                break;
            case 'overlay':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'soft-light':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            default: // normal
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }
    
    // エクスポートシステム設定
    setupExportSystem() {
        this.exportFormats = ['png', 'jpeg', 'svg', 'pdf'];
        this.exportQuality = 0.9;
        this.exportDPI = 300;
    }
    
    // PNG/JPEG エクスポート
    exportToRaster(format = 'png', quality = this.exportQuality) {
        if (!this.engine.canvas) return null;
        
        try {
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            return this.engine.canvas.toDataURL(mimeType, quality);
        } catch (error) {
            console.error('Export failed:', error);
            return null;
        }
    }
    
    // SVG エクスポート（基本実装）
    exportToSVG() {
        const width = this.engine.canvas.width;
        const height = this.engine.canvas.height;
        
        let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
        
        // ストロークをSVGパスに変換（簡易実装）
        this.engine.strokes.forEach((stroke, index) => {
            if (stroke.points && stroke.points.length > 1) {
                let pathData = `M ${stroke.points[0].x + width/2} ${-stroke.points[0].y + height/2}`;
                
                for (let i = 1; i < stroke.points.length; i++) {
                    const point = stroke.points[i];
                    pathData += ` L ${point.x + width/2} ${-point.y + height/2}`;
                }
                
                svgContent += `  <path d="${pathData}" stroke="rgb(128,0,0)" stroke-width="${stroke.baseSize}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}"/>\n`;
            }
        });
        
        svgContent += '</svg>';
        return svgContent;
    }
    
    // カスタムブラシ設定
    setupCustomBrushes() {
        this.brushes = new Map();
        this.currentBrush = 'default';
        this.setupDefaultBrushes();
    }
    
    // デフォルトブラシ設定
    setupDefaultBrushes() {
        // デフォルトブラシ
        this.brushes.set('default', {
            name: 'Default Pen',
            size: 3,
            opacity: 1.0,
            hardness: 1.0,
            spacing: 1.0,
            pressureSize: true,
            pressureOpacity: false
        });
        
        // マーカーブラシ
        this.brushes.set('marker', {
            name: 'Marker',
            size: 8,
            opacity: 0.7,
            hardness: 0.3,
            spacing: 0.5,
            pressureSize: false,
            pressureOpacity: true
        });
        
        // 鉛筆ブラシ
        this.brushes.set('pencil', {
            name: 'Pencil',
            size: 2,
            opacity: 0.8,
            hardness: 0.8,
            spacing: 0.8,
            pressureSize: true,
            pressureOpacity: true
        });
    }
    
    // ブラシ切り替え
    setBrush(brushId) {
        if (this.brushes.has(brushId)) {
            this.currentBrush = brushId;
            const brush = this.brushes.get(brushId);
            
            // エンジンのペン設定を更新
            this.engine.setPenSize(brush.size);
            this.engine.setOpacity(brush.opacity * 100);
            
            return true;
        }
        return false;
    }
    
    // カスタムブラシ作成
    createCustomBrush(id, settings) {
        const brush = {
            name: settings.name || 'Custom Brush',
            size: settings.size || 3,
            opacity: settings.opacity || 1.0,
            hardness: settings.hardness || 1.0,
            spacing: settings.spacing || 1.0,
            pressureSize: settings.pressureSize || true,
            pressureOpacity: settings.pressureOpacity || false,
            texture: settings.texture || null
        };
        
        this.brushes.set(id, brush);
        return brush;
    }
    
    // プロ設定更新
    updateProSettings(settings) {
        if (settings.textureScale !== undefined) {
            this.textureScale = Math.max(0.1, Math.min(5.0, settings.textureScale));
        }
        
        if (settings.blendMode !== undefined && this.blendModes.includes(settings.blendMode)) {
            this.currentBlendMode = settings.blendMode;
            this.applyLayerBlending();
        }
        
        if (settings.exportQuality !== undefined) {
            this.exportQuality = Math.max(0.1, Math.min(1.0, settings.exportQuality));
        }
    }
    
    // プロ機能状態取得
    getProState() {
        return {
            currentBrush: this.currentBrush,
            availableBrushes: Array.from(this.brushes.keys()),
            currentBlendMode: this.currentBlendMode,
            availableBlendModes: this.blendModes,
            layerCount: this.layers.length,
            textureCount: this.textures.size
        };
    }
    
    // リソースクリーンアップ
    cleanup() {
        // WebGLテクスチャのクリーンアップ
        if (this.engine.gl) {
            this.textures.forEach(texture => {
                this.engine.gl.deleteTexture(texture);
            });
        }
        
        this.textures.clear();
        this.layers = [];
    }
}