        this.container.addChild(this.colorWheel);
        
        // クリックイベント
        this.colorWheel.on('pointerdown', this.onColorWheelClick.bind(this));
    }
    
    drawHighQualityColorWheel(size, centerX, centerY) {
        const radius = size / 2 - 10;
        const steps = 360; // 1度刻み
        
        for (let i = 0; i < steps; i++) {
            const hue = (i / steps) * 360;
            const color = chroma.hsl(hue, 1, 0.5).hex();
            
            this.colorWheel.beginFill(color);
            this.colorWheel.arc(centerX, centerY, radius - 5, radius, 
                (i * Math.PI * 2) / steps, 
                ((i + 1) * Math.PI * 2) / steps
            );
            this.colorWheel.endFill();
        }
        
        // 中央の彩度・明度エリア
        const gradient = this.createSaturationGradient(radius - 5);
        this.colorWheel.addChild(gradient);
    }
    
    drawBasicColorWheel(size, centerX, centerY) {
        const colors = [
            0xFF0000, 0xFF8000, 0xFFFF00, 0x80FF00, 
            0x00FF00, 0x00FF80, 0x00FFFF, 0x0080FF,
            0x0000FF, 0x8000FF, 0xFF00FF, 0xFF0080
        ];
        
        const angleStep = (Math.PI * 2) / colors.length;
        const radius = size / 2 - 10;
        
        colors.forEach((color, index) => {
            this.colorWheel.beginFill(color);
            this.colorWheel.arc(centerX, centerY, radius - 5, radius,
                index * angleStep, (index + 1) * angleStep
            );
            this.colorWheel.endFill();
        });
    }
    
    createSaturationGradient(radius) {
        // 彩度・明度の2D表示エリア
        const saturationArea = new PIXI.Graphics();
        
        if (this.hasChromaLib) {
            // 高品質グラデーション
            const resolution = 50;
            for (let x = 0; x < resolution; x++) {
                for (let y = 0; y < resolution; y++) {
                    const saturation = x / resolution;
                    const value = 1 - (y / resolution);
                    const color = chroma.hsv(this.currentColor.h, saturation, value).hex();
                    
                    const pixelSize = (radius * 2) / resolution;
                    saturationArea.beginFill(color);
                    saturationArea.drawRect(
                        -radius + x * pixelSize, 
                        -radius + y * pixelSize, 
                        pixelSize, pixelSize
                    );
                    saturationArea.endFill();
                }
            }
        } else {
            // 基本グラデーション
            saturationArea.beginFill(0xFFFFFF, 0.5);
            saturationArea.drawCircle(0, 0, radius);
            saturationArea.endFill();
        }
        
        saturationArea.interactive = true;
        saturationArea.on('pointerdown', this.onSaturationClick.bind(this));
        
        return saturationArea;
    }
    
    async createSaturationBar() {
        const width = 20;
        const height = 200;
        
        this.saturationBar = new PIXI.Graphics();
        
        // 縦方向のグラデーション
        for (let i = 0; i < height; i++) {
            const value = 1 - (i / height);
            let color;
            
            if (this.hasChromaLib) {
                color = chroma.hsv(this.currentColor.h, this.currentColor.s / 100, value).num();
            } else {
                // 基本的な明度計算
                color = Math.floor(value * 255);
                color = (color << 16) | (color << 8) | color;
            }
            
            this.saturationBar.beginFill(color);
            this.saturationBar.drawRect(0, i, width, 1);
            this.saturationBar.endFill();
        }
        
        this.saturationBar.interactive = true;
        this.saturationBar.on('pointerdown', this.onSaturationBarClick.bind(this));
        
        this.container.addChild(this.saturationBar);
    }
    
    async createPreviewArea() {
        const previewSize = 60;
        
        this.previewColor = new PIXI.Graphics();
        this.previewColor.beginFill(this.getCurrentColor());
        this.previewColor.drawRect(0, 0, previewSize, previewSize);
        this.previewColor.endFill();
        
        // 枠線
        this.previewColor.lineStyle(1, 0x808080);
        this.previewColor.drawRect(0, 0, previewSize, previewSize);
        
        this.container.addChild(this.previewColor);
    }
    
    async createColorPalette() {
        // デフォルトパレット
        const defaultColors = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#800000',
            '#008000', '#000080', '#808000', '#800080', '#008080'
        ];
        
        const paletteContainer = new PIXI.Container();
        const swatchSize = 24;
        const cols = 5;
        
        defaultColors.forEach((color, index) => {
            const swatch = this.createColorSwatch(color, swatchSize);
            swatch.x = (index % cols) * (swatchSize + 2);
            swatch.y = Math.floor(index / cols) * (swatchSize + 2);
            paletteContainer.addChild(swatch);
        });
        
        this.container.addChild(paletteContainer);
    }
    
    createColorSwatch(color, size) {
        const swatch = new PIXI.Graphics();
        const colorNum = typeof color === 'string' 
            ? parseInt(color.replace('#', ''), 16) 
            : color;
        
        swatch.beginFill(colorNum);
        swatch.drawRect(0, 0, size, size);
        swatch.endFill();
        
        // 枠線
        swatch.lineStyle(1, 0x808080);
        swatch.drawRect(0, 0, size, size);
        
        // クリックイベント
        swatch.interactive = true;
        swatch.buttonMode = true;
        swatch.on('pointerdown', () => {
            this.setColor(color);
        });
        
        return swatch;
    }
    
    layoutComponents() {
        // カラーピッカーのレイアウト調整
        this.colorWheel.x = 10;
        this.colorWheel.y = 10;
        
        this.saturationBar.x = this.colorWheel.x + 220;
        this.saturationBar.y = this.colorWheel.y;
        
        this.previewColor.x = this.saturationBar.x + 30;
        this.previewColor.y = this.colorWheel.y;
        
        // パレットは下部に配置
        const palette = this.container.children[this.container.children.length - 1];
        palette.x = 10;
        palette.y = this.colorWheel.y + 220;
    }
    
    onColorWheelClick(event) {
        const localPos = event.data.getLocalPosition(this.colorWheel);
        const centerX = 100;
        const centerY = 100;
        
        // 角度から色相を計算
        const angle = Math.atan2(localPos.y - centerY, localPos.x - centerX);
        const hue = ((angle * 180 / Math.PI) + 360) % 360;
        
        this.currentColor.h = hue;
        this.updateColor();
    }
    
    onSaturationClick(event) {
        const localPos = event.data.getLocalPosition(event.currentTarget);
        const centerX = 0;
        const centerY = 0;
        const radius = 95;
        
        // 中心からの距離で彩度を計算
        const distance = Math.sqrt(
            Math.pow(localPos.x - centerX, 2) + 
            Math.pow(localPos.y - centerY, 2)
        );
        
        this.currentColor.s = Math.min(100, (distance / radius) * 100);
        this.updateColor();
    }
    
    onSaturationBarClick(event) {
        const localPos = event.data.getLocalPosition(this.saturationBar);
        const value = 1 - (localPos.y / 200);
        
        this.currentColor.v = Math.max(0, Math.min(100, value * 100));
        this.updateColor();
    }
    
    updateColor() {
        // プレビュー更新
        this.previewColor.clear();
        this.previewColor.beginFill(this.getCurrentColor());
        this.previewColor.drawRect(0, 0, 60, 60);
        this.previewColor.endFill();
        
        // 彩度バー更新
        this.updateSaturationBar();
        
        // 外部に通知
        this.notifyColorChange();
    }
    
    updateSaturationBar() {
        // 彩度バーを現在の色相で再描画
        this.saturationBar.clear();
        
        for (let i = 0; i < 200; i++) {
            const value = 1 - (i / 200);
            let color;
            
            if (this.hasChromaLib) {
                color = chroma.hsv(this.currentColor.h, this.currentColor.s / 100, value).num();
            } else {
                color = Math.floor(value * 255);
                color = (color << 16) | (color << 8) | color;
            }
            
            this.saturationBar.beginFill(color);
            this.saturationBar.drawRect(0, i, 20, 1);
            this.saturationBar.endFill();
        }
    }
    
    getCurrentColor() {
        if (this.hasChromaLib) {
            return chroma.hsv(
                this.currentColor.h, 
                this.currentColor.s / 100, 
                this.currentColor.v / 100
            ).num();
        } else {
            // 基本HSV→RGB変換
            return this.hsvToRgb(
                this.currentColor.h, 
                this.currentColor.s, 
                this.currentColor.v
            );
        }
    }
    
    hsvToRgb(h, s, v) {
        h = h / 360;
        s = s / 100;
        v = v / 100;
        
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    }
    
    setColor(color) {
        if (typeof color === 'string') {
            if (this.hasChromaLib) {
                const chromaColor = chroma(color).hsv();
                this.currentColor = {
                    h: chromaColor[0] || 0,
                    s: chromaColor[1] * 100,
                    v: chromaColor[2] * 100
                };
            } else {
                // 基本的な色変換
                const rgb = parseInt(color.replace('#', ''), 16);
                this.currentColor = this.rgbToHsv(
                    (rgb >> 16) & 255,
                    (rgb >> 8) & 255,
                    rgb & 255
                );
            }
        }
        
        this.updateColor();
        this.addToHistory(color);
    }
    
    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        let h = 0;
        if (diff !== 0) {
            if (max === r) h = (60 * ((g - b) / diff) + 360) % 360;
            else if (max === g) h = 60 * ((b - r) / diff) + 120;
            else h = 60 * ((r - g) / diff) + 240;
        }
        
        const s = max === 0 ? 0 : (diff / max) * 100;
        const v = max * 100;
        
        return { h, s, v };
    }
    
    addToHistory(color) {
        // カラー履歴に追加（重複除去）
        const colorStr = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`;
        
        if (!this.colorHistory.includes(colorStr)) {
            this.colorHistory.unshift(colorStr);
            
            // 履歴の上限管理
            if (this.colorHistory.length > 20) {
                this.colorHistory = this.colorHistory.slice(0, 20);
            }
        }
    }
    
    notifyColorChange() {
        // 現在のツールに色変更を通知
        const toolManager = this.appCore.getManager('tool');
        const currentTool = toolManager.getCurrentTool();
        
        if (currentTool && typeof currentTool.onColorChange === 'function') {
            currentTool.onColorChange(this.getCurrentColor());
        }
        
        // UI更新
        this.appCore.getManager('ui').updateCurrentColor(this.getCurrentColor());
    }
    
    setupEvents() {
        // カラーピッカー表示/非表示
        document.addEventListener('colorpicker:toggle', () => {
            this.container.visible = !this.container.visible;
        });
        
        // 外部からの色設定
        document.addEventListener('colorpicker:setcolor', (event) => {
            this.setColor(event.detail.color);
        });
    }
    
    show() {
        this.container.visible = true;
    }
    
    hide() {
        this.container.visible = false;
    }
    
    getColorHistory() {
        return [...this.colorHistory];
    }
    
    getHexColor() {
        const color = this.getCurrentColor();
        return `#${color.toString(16).padStart(6, '0')}`;
    }
}
```

## 🔧 Phase2.5: エクスポート・インポート強化

### managers/export-manager.js
```javascript
/**
 * 📤 ExportManager - 高度エクスポート・インポート
 * 責務:
 * - 複数形式エクスポート（PNG, SVG, PDF, PSD互換）
 * - レイヤー保持エクスポート
 * - プロジェクトファイル管理
 * - クラウド連携準備
 */

class ExportManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        
        // エクスポート形式
        this.supportedFormats = ['png', 'jpg', 'svg', 'pdf', 'tegaki'];
        this.exportOptions = {
            quality: 1.0,
            scale: 1.0,
            backgroundColor: '#ffffff',
            transparentBackground: false,
            includeHiddenLayers: false,
            flattenLayers: true
        };
        
        // ライブラリ確認
        this.hasFileSaver = typeof saveAs !== 'undefined';
        this.hasJSZip = typeof JSZip !== 'undefined';
        
        this.isInitialized = false;
    }
    
    async init() {
        await this.setupExportSystem();
        this.setupEvents();
        
        this.isInitialized = true;
        console.log('📤 ExportManager 初期化完了');
    }
    
    async setupExportSystem() {
        console.log('📦 エクスポートライブラリ状態:');
        console.log(`  FileSaver.js: ${this.hasFileSaver ? '✅' : '❌'}`);
        console.log(`  JSZip: ${this.hasJSZip ? '✅' : '❌'}`);
    }
    
    async exportImage(format = 'png', options = {}) {
        const finalOptions = { ...this.exportOptions, ...options };
        
        try {
            switch (format.toLowerCase()) {
                case 'png':
                    return await this.exportPNG(finalOptions);
                case 'jpg':
                case 'jpeg':
                    return await this.exportJPEG(finalOptions);
                case 'svg':
                    return await this.exportSVG(finalOptions);
                case 'tegaki':
                    return await this.exportTegakiProject(finalOptions);
                default:
                    throw new Error(`未対応形式: ${format}`);
            }
        } catch (error) {
            console.error(`❌ エクスポート失敗 (${format}):`, error);
            throw error;
        }
    }
    
    async exportPNG(options) {
        const { scale, backgroundColor, transparentBackground } = options;
        
        // レンダーテクスチャ作成
        const renderTexture = this.createRenderTexture(scale);
        
        // 背景設定
        if (!transparentBackground && backgroundColor) {
            this.drawBackground(backgroundColor);
        }
        
        // レイヤー描画
        const layerManager = this.appCore.getManager('layer');
        const layers = layerManager.getLayerHierarchy();
        
        for (const layer of layers) {
            if (!layer.visible && !options.includeHiddenLayers) continue;
            await this.renderLayer(layer, renderTexture);
        }
        
        // PNG生成
        const canvas = this.appCore.app.renderer.extract.canvas(renderTexture);
        
        if (this.hasFileSaver) {
            canvas.toBlob((blob) => {
                saveAs(blob, `tegaki-export-${Date.now()}.png`);
            });
        } else {
            // フォールバック: ダウンロードリンク作成
            this.downloadCanvas(canvas, 'png');
        }
        
        renderTexture.destroy();
        console.log('✅ PNG エクスポート完了');
    }
    
    async exportJPEG(options) {
        const { scale, backgroundColor, quality } = options;
        
        const renderTexture = this.createRenderTexture(scale);
        
        // JPEG は背景必須
        this.drawBackground(backgroundColor || '#ffffff');
        
        // レイヤー描画
        const layerManager = this.appCore.getManager('layer');
        const layers = layerManager.getLayerHierarchy();
        
        for (const layer of layers) {
            if (!layer.visible && !options.includeHiddenLayers) continue;
            await this.renderLayer(layer, renderTexture);
        }
        
        // JPEG生成
        const canvas = this.appCore.app.renderer.extract.canvas(renderTexture);
        
        if (this.hasFileSaver) {
            canvas.toBlob((blob) => {
                saveAs(blob, `tegaki-export-${Date.now()}.jpg`);
            }, 'image/jpeg', quality);
        } else {
            this.downloadCanvas(canvas, 'jpeg', quality);
        }
        
        renderTexture.destroy();
        console.log('✅ JPEG エクスポート完了');
    }
    
    async exportSVG(options) {
        // SVG エクスポート（ベクター情報を保持）
        const svgData = await this.generateSVGData(options);
        
        if (this.hasFileSaver) {
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            saveAs(blob, `tegaki-export-${Date.now()}.svg`);
        } else {
            this.downloadText(svgData, 'svg');
        }
        
        console.log('✅ SVG エクスポート完了');
    }
    
    async exportTegakiProject(options) {
        // プロジェクトファイル形式（独自形式）
        if (!this.hasJSZip) {
            console.warn('⚠️ JSZip未検出: プロジェクト形式エクスポート不可');
            return;
        }
        
        const zip = new JSZip();
        
        // プロジェクト情報
        const projectData = await this.generateProjectData(options);
        zip.file('project.json', JSON.stringify(projectData, null, 2));
        
        // レイヤー別PNG
        const layerManager = this.appCore.getManager('layer');
        const layers = layerManager.getLayerHierarchy();
        
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.visible && !options.includeHiddenLayers) continue;
            
            const layerCanvas = await this.renderLayerToCanvas(layer);
            const layerBlob = await this.canvasToBlob(layerCanvas);
            
            zip.file(`layers/layer-${i}-${layer.name}.png`, layerBlob);
        }
        
        // プリビュー画像
        const previewCanvas = await this.generatePreviewImage();
        const previewBlob = await this.canvasToBlob(previewCanvas);
        zip.file('preview.png', previewBlob);
        
        // ZIP生成・ダウンロード
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        if (this.hasFileSaver) {
            saveAs(zipBlob, `tegaki-project-${Date.now()}.tegaki`);
        } else {
            this.downloadBlob(zipBlob, 'tegaki');
        }
        
        console.log('✅ Tegakiプロジェクト エクスポート完了');
    }
    
    async generateProjectData(options) {
        const layerManager = this.appCore.getManager('layer');
        const settingsManager = this.appCore.getManager('settings');
        
        return {
            version: '2.0',
            created: new Date().toISOString(),
            canvas: {
                width: this.appCore.app.screen.width,
                height: this.appCore.app.screen.height,
                backgroundColor: options.backgroundColor
            },
            layers: layerManager.getLayerHierarchy(),
            settings: settingsManager.getAllSettings(),
            metadata: {
                toolUsed: 'Tegaki',
                exportOptions: options
            }
        };
    }
    
    async generateSVGData(options) {
        const { width, height } = this.appCore.app.screen;
        const layerManager = this.appCore.getManager('layer');
        
        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        
        if (options.backgroundColor && !options.transparentBackground) {
            svgContent += `
  <rect width="100%" height="100%" fill="${options.backgroundColor}"/>`;
        }
        
        // レイヤー別SVG変換
        const layers = layerManager.getLayerHierarchy();
        for (const layer of layers) {
            if (!layer.visible && !options.includeHiddenLayers) continue;
            
            const layerSVG = await this.convertLayerToSVG(layer);
            svgContent += `
  <g id="${layer.name}" opacity="${layer.opacity}">
    ${layerSVG}
  </g>`;
        }
        
        svgContent += `
</svg>`;
        
        return svgContent;
    }
    
    createRenderTexture(scale = 1) {
        const { width, height } = this.appCore.app.screen;
        return PIXI.RenderTexture.create({
            width: width * scale,
            height: height * scale,
            resolution: scale
        });
    }
    
    drawBackground(backgroundColor) {
        const bg = new PIXI.Graphics();
        const color = typeof backgroundColor === 'string' 
            ? parseInt(backgroundColor.replace('#', ''), 16)
            : backgroundColor;
        
        bg.beginFill(color);
        bg.drawRect(0, 0, this.appCore.app.screen.width, this.appCore.app.screen.height);
        bg.endFill();
        
        return bg;
    }
    
    async renderLayer(layer, renderTexture) {
        // レイヤー別レンダリング処理
        const layerManager = this.appCore.getManager('layer');
        const layerData = layerManager.getLayer(layer.id);
        
        if (layerData && layerData.container) {
            this.appCore.app.renderer.render(layerData.container, { renderTexture, clear: false });
        }
    }
    
    downloadCanvas(canvas, format, quality = 0.9) {
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const link = document.createElement('a');
        
        link.download = `tegaki-export-${Date.now()}.${format}`;
        link.href = canvas.toDataURL(mimeType, quality);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    downloadText(content, extension) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `tegaki-export-${Date.now()}.${extension}`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
    
    setupEvents() {
        // エクスポートイベント
        document.addEventListener('export:image', (event) => {
            const { format, options } = event.detail;
            this.exportImage(format, options);
        });
        
        // インポートイベント
        document.addEventListener('import:file', (event) => {
            this.importFile(event.detail.file);
        });
    }
    
    async importFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        try {
            switch (extension) {
                case 'tegaki':
                    await this.importTegakiProject(file);
                    break;
                case 'png':
                case 'jpg':
                case 'jpeg':
                    await this.importImage(file);
                    break;
                default:
                    throw new Error(`未対応形式: ${extension}`);
            }
        } catch (error) {
            console.error(`❌ インポート失敗:`, error);
            throw error;
        }
    }
    
    async importTegakiProject(file) {
        if (!this.hasJSZip) {
            console.warn('⚠️ JSZip未検出: プロジェクト形式インポート不可');
            return;
        }
        
        const zip = await JSZip.loadAsync(file);
        
        // プロジェクトデータ読み込み
        const projectFile = zip.file('project.json');
        if (!projectFile) {
            throw new Error('プロジェクトファイルが見つかりません');
        }
        
        const projectData = JSON.parse(await projectFile.async('text'));
        
        // キャンバス設定
        this.appCore.app.renderer.resize(projectData.canvas.width, projectData.canvas.height);
        
        // レイヤー復元
        const layerManager = this.appCore.getManager('layer');
        await layerManager.clearAllLayers();
        
        for (const layerData of projectData.layers) {
            const layer = await layerManager.createLayer({
                name: layerData.name,
                type: layerData.type,
                visible: layerData.visible,
                opacity: layerData.opacity
            });
            
            // レイヤー画像読み込み
            const layerImageFile = zip.file(`layers/layer-${layerData.id}-${layerData.name}.png`);
            if (layerImageFile) {
                const imageBlob = await layerImageFile.async('blob');
                await this.loadImageToLayer(file, layer);
        
        console.log('✅ 画像インポート完了');
    }
    
    async loadImageToLayer(imageFile, layer) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                const texture = PIXI.Texture.from(img);
                const sprite = new PIXI.Sprite(texture);
                
                // レイヤーに追加
                const layerContainer = layer.container;
                layerContainer.addChild(sprite);
                
                resolve();
            };
            
            img.onerror = reject;
            
            if (imageFile instanceof Blob) {
                img.src = URL.createObjectURL(imageFile);
            } else {
                img.src = imageFile;
            }
        });
    }
    
    // 外部API
    getSupportedFormats() {
        return [...this.supportedFormats];
    }
    
    setExportOptions(options) {
        Object.assign(this.exportOptions, options);
    }
    
    getExportOptions() {
        return { ...this.exportOptions };
    }
}
```

## 🚀 Phase2 実装スケジュール

### 週次スケジュール（2週間完成目標）

#### 第1週: コア機能実装
**月曜日: レイヤーシステム基盤**
- [ ] LayerManager実装
- [ ] 基本レイヤー作成・削除・移動
- [ ] レイヤーパネルUI作成
- [ ] 既存描画システムとの統合

**火曜日: ツール分割・基底システム**
- [ ] BaseTool抽象クラス実装
- [ ] 既存ツールの分割移行
- [ ] tools/*.js ファイル作成
- [ ] ToolManager統括機能強化

**水曜日: ベジェ曲線・図形ツール**
- [ ] BezierTool実装（Bezier.js活用）
- [ ] ShapeTool実装（基本図形）
- [ ] ベジェ制御点編集機能
- [ ] 図形プロパティ調整

**木曜日: 非破壊変形システム**
- [ ] TransformManager実装
- [ ] 選択・変形ハンドル作成
- [ ] スケール・回転・移動機能
- [ ] オブジェクト選択システム

**金曜日: 統合テスト・調整**
- [ ] Phase2新機能の統合テスト
- [ ] パフォーマンス確認・最適化
- [ ] UI/UX調整
- [ ] バグ修正・安定性向上

#### 第2週: 高度機能・完成
**月曜日: カラーピッカー・UI強化**
- [ ] ColorPicker実装（Chroma.js活用）
- [ ] 高度カラー選択機能
- [ ] カラーパレット・履歴
- [ ] UI統合・レイアウト調整

**火曜日: エフェクト・フィルターシステム**
- [ ] FilterManager実装
- [ ] pixi-filtersフル活用
- [ ] フィルタープリセット作成
- [ ] リアルタイムエフェクト適用

**水曜日: エクスポート・インポート強化**
- [ ] ExportManager実装
- [ ] 複数形式対応（PNG, SVG, Tegakiプロジェクト）
- [ ] レイヤー保持エクスポート
- [ ] プロジェクトファイル管理

**木曜日: 高度UIコンポーネント**
- [ ] レイヤーパネル完成
- [ ] ツールオプションパネル
- [ ] グリッド・ルーラーシステム
- [ ] ショートカット・設定UI

**金曜日: Phase2完成・品質保証**
- [ ] 全機能統合テスト
- [ ] パフォーマンス最適化
- [ ] ドキュメント更新
- [ ] Phase3準備

## 🎯 Phase2 成功基準

### 必達項目
- ✅ **レイヤーシステム**: 10層以上対応、非破壊編集
- ✅ **高度描画ツール**: ベジェ曲線、図形、テキスト
- ✅ **非破壊変形**: 選択・スケール・回転・移動
- ✅ **エフェクト**: 20種類以上のフィルター
- ✅ **エクスポート**: PNG, SVG, プロジェクト形式対応

### 品質項目
- ✅ **パフォーマンス**: 60FPS維持（レイヤー10層時）
- ✅ **メモリ管理**: メモリリーク無し
- ✅ **UI/UX**: 直感的な操作性
- ✅ **安定性**: 継続使用でクラッシュ無し
- ✅ **拡張性**: Phase3機能追加に対応

### 発展項目
- ✅ **ショートカット**: 全機能キーボード対応
- ✅ **プリセット**: ツール・エフェクト設定保存
- ✅ **履歴**: 高度なアンドゥ・リドゥ（50ステップ）
- ✅ **TypeScript準備**: 型定義ファイル作成開始

## 📋 Phase3 計画概要

### Phase3 主要機能
**コラボレーション機能**
- リアルタイム共同編集
- ユーザー管理・権限制御
- チャット・コメント機能
- 変更履歴・マージ機能

**クラウド連携**
- 作品クラウド保存・同期
- 共有・公開機能
- アカウント管理
- バックアップ・バージョン管理

**高度エフェクト・AI機能**
- WebGPUコンピュートシェーダー活用
- AI支援描画機能
- 高度フィルター（blur, glow, distortion等）
- パフォーマンス最適化

**プロフェッショナル機能**
- カスタムブラシエンジン
- アニメーション機能
- 3D変形・遠近法
- プラグインシステム

### Phase3 技術スタック追加
```html
<!-- Phase3 追加予定ライブラリ -->

<!-- WebRTC（リアルタイム通信） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/simple-peer/9.11.1/simplepeer.min.js"></script>

<!-- WebSocket（リアルタイム同期） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>

<!-- データベース（IndexedDB） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dexie/3.2.4/dexie.min.js"></script>

<!-- AI/ML（TensorFlow.js） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.10.0/tf.min.js"></script>

<!-- 3D数学（gl-matrix） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gl-matrix/3.4.3/gl-matrix.min.js"></script>
```

## 🔧 Phase2 トラブルシューティング

### よくある問題と対策

**問題: レイヤー大量作成時のパフォーマンス低下**
- 対策: レイヤー仮想化、オフスクリーンレンダリング活用
- 監視: メモリ使用量、FPS監視強化

**問題: ベジェ曲線の制御点操作が重い**
- 対策: 制御点表示の最適化、Bezier.jsの効率的活用
- 代案: 制御点数の制限、プレビュー品質調整

**問題: 変形ハンドルの当たり判定が不安定**
- 対策: ハンドルサイズの動的調整、高DPI対応
- 改善: カーソルフィードバック強化

**問題: カラーピッカーの色変換精度**
- 対策: Chroma.js活用、高精度HSV変換
- フォールバック: 基本色変換アルゴリズムの改良

**問題: エクスポート時のメモリ不足**
- 対策: 段階的レンダリング、テクスチャ使い回し
- 最適化: ガベージコレクション強制実行

## 📝 Phase2 完了後の確認項目

### 機能確認テスト
```javascript
// Phase2完了確認テスト

console.log('🧪 Phase2機能テスト開始...');

// 1. レイヤーシステムテスト
const layerManager = futabaApp.getManager('layer');
console.log(`レイヤー管理: ${layerManager.isInitialized ? '✅' : '❌'}`);

// 2. 高度ツールテスト
const toolManager = futabaApp.getManager('tool');
const advancedTools = ['bezier', 'shape', 'text', 'transform'];
advancedTools.forEach(tool => {
    const hasTools = toolManager.hasTool(tool);
    console.log(`${tool}ツール: ${hasTools ? '✅' : '❌'}`);
});

// 3. エフェクトシステムテスト
const effectManager = futabaApp.getManager('effect');
console.log(`エフェクト数: ${effectManager.getAvailableFilters().length}`);

// 4. エクスポート機能テスト
const exportManager = futabaApp.getManager('export');
console.log(`エクスポート形式: ${exportManager.getSupportedFormats().join(', ')}`);

// 5. パフォーマンステスト
const stats = futabaApp.getStats();
console.log(`FPS: ${stats.fps.toFixed(1)} | メモリ: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);

console.log('✅ Phase2機能テスト完了');
```

Phase2計画書の作成が完了しました。Phase1の基盤の上に、本格的なデジタルアート制作ツールとしての機能を構築する内容になっています。

実装上のポイント：
1. **段階的機能追加**: Phase1との互換性維持
2. **ライブラリ最大活用**: CDNライブラリで車輪の再発明回避
3. **パフォーマンス重視**: 60FPS維持を最優先
4. **拡張性確保**: Phase3への準備を含む設計

何か修正や追加したい点はございますか？dImageToLayer(imageBlob, layer);
            }
        }
        
        console.log('✅ Tegakiプロジェクト インポート完了');
    }
    
    async importImage(file) {
        const layerManager = this.appCore.getManager('layer');
        
        // 新しい画像レイヤーを作成
        const layer = await layerManager.createLayer({
            name: `インポート画像 ${Date.now()}`,
            type: 'drawing'
        });
        
        await this.loa# Tegaki Phase 2 - 高度描画機能実装計画

## 🎯 Phase2 目標
- **高度描画ツール**: ベジェ曲線、図形ツール、テキストツール
- **レイヤーシステム**: 非破壊編集対応レイヤー管理
- **非破壊変形**: オブジェクト選択・変形・回転システム  
- **高度UI**: カラーピッカー、グリッド、ルーラー
- **ファイル分割**: tools/*.js、layers/*.js分割
- **エフェクトシステム**: pixi-filtersフル活用

## 📚 Phase2 追加CDNライブラリ

### 新規追加ライブラリ
```html
<!-- Phase2 追加ライブラリ -->

<!-- カラー処理 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js"></script>

<!-- 数学計算（ベジェ曲線など） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/bezier-js/6.1.4/bezier.min.js"></script>

<!-- 2D幾何学計算 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js"></script>

<!-- ファイル処理（インポート・エクスポート強化） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

<!-- フォント処理（テキストツール用） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js"></script>
```

## 🏗️ Phase2 フォルダ構造拡張

```
v1_Phase2/
├─ index.html                     // Phase2ライブラリ追加
├─ styles.css                     // UI拡張対応
├─ app-core.js                    // Phase1軽量版維持
├─ main.js                        // Phase1連携版維持
│
├─ managers/                      // Phase1Manager継続
│  ├─ ui-manager.js              // Phase2 UI拡張
│  ├─ tool-manager.js            // tools/*.js統括
│  ├─ canvas-manager.js          // レイヤー統括追加
│  ├─ memory-manager.js          // 非破壊履歴拡張
│  ├─ settings-manager.js        // Phase2設定追加
│  ├─ extension-loader.js        // Phase2ライブラリ追加
│  ├─ layer-manager.js           // 新規: レイヤーシステム
│  ├─ transform-manager.js       // 新規: 非破壊変形システム
│  └─ export-manager.js          // 新規: 高度エクスポート
│
├─ tools/                        // 新規: ツール分割
│  ├─ base-tool.js               // ツール基底クラス
│  ├─ pen-tool.js                // ペンツール（Phase1から分割）
│  ├─ brush-tool.js              // ブラシツール強化
│  ├─ eraser-tool.js             // 消しゴムツール（Phase1から分割）
│  ├─ bezier-tool.js             // 新規: ベジェ曲線ツール
│  ├─ shape-tool.js              // 新規: 図形ツール
│  ├─ text-tool.js               // 新規: テキストツール
│  ├─ bucket-tool.js             // 新規: バケツツール
│  ├─ selection-tool.js          // 新規: 選択ツール
│  └─ transform-tool.js          // 新規: 変形ツール
│
├─ layers/                       // 新規: レイヤーシステム
│  ├─ base-layer.js              // レイヤー基底クラス
│  ├─ drawing-layer.js           // 描画レイヤー
│  ├─ text-layer.js              // テキストレイヤー
│  ├─ adjustment-layer.js        // 調整レイヤー
│  └─ group-layer.js             // グループレイヤー
│
├─ effects/                      // 新規: エフェクトシステム
│  ├─ filter-manager.js          // フィルター管理
│  ├─ blend-modes.js             // ブレンドモード
│  └─ filter-presets.js          // フィルタープリセット
│
├─ ui/                          // 新規: 高度UIコンポーネント
│  ├─ color-picker.js           // カラーピッカー
│  ├─ layer-panel.js            // レイヤーパネル
│  ├─ tool-options.js           // ツールオプション
│  ├─ grid-system.js            // グリッド・ガイド
│  └─ ruler-system.js           // ルーラー
│
└─ legacy/                      // Phase1ファイル移行
   ├─ history-manager.js        // Phase1から移行
   ├─ transform-manager.js      // Phase1から移行（名前変更）
   ├─ drawing-tools.js          // Phase1から移行（分割済み）
   └─ ui-manager.js             // Phase1から移行（削除予定）
```

## 🔧 Phase2.1: レイヤーシステム実装

### managers/layer-manager.js
```javascript
/**
 * 🎨 LayerManager - レイヤーシステム統括
 * 責務:
 * - 複数レイヤー管理
 * - レイヤー順序制御
 * - 非破壊編集対応
 * - レイヤー効果・ブレンド管理
 */

class LayerManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.layerContainer = new PIXI.Container();
        this.isInitialized = false;
    }
    
    async init() {
        await this.setupLayerContainer();
        await this.createDefaultLayer();
        await this.setupLayerEvents();
        
        this.isInitialized = true;
        console.log('🎨 LayerManager 初期化完了');
    }
    
    async setupLayerContainer() {
        // キャンバスマネージャーからDrawingContainerを取得
        const drawingContainer = this.appCore.getManager('canvas').getDrawingContainer();
        drawingContainer.addChild(this.layerContainer);
        
        // レイヤーコンテナの設定
        this.layerContainer.sortableChildren = true;
    }
    
    async createDefaultLayer() {
        const defaultLayer = await this.createLayer({
            name: 'レイヤー 1',
            type: 'drawing',
            visible: true,
            opacity: 1.0,
            blendMode: PIXI.BLEND_MODES.NORMAL
        });
        
        this.setActiveLayer(defaultLayer.id);
    }
    
    async createLayer(options = {}) {
        const layerId = this.generateLayerId();
        const layerData = {
            id: layerId,
            name: options.name || `レイヤー ${this.layers.size + 1}`,
            type: options.type || 'drawing',
            visible: options.visible !== false,
            opacity: options.opacity || 1.0,
            blendMode: options.blendMode || PIXI.BLEND_MODES.NORMAL,
            locked: options.locked || false,
            container: new PIXI.Container(),
            created: Date.now()
        };
        
        // レイヤータイプ別の初期化
        await this.initializeLayerType(layerData, options);
        
        // レイヤーコンテナに追加
        this.layerContainer.addChild(layerData.container);
        layerData.container.zIndex = this.layerOrder.length;
        
        // 管理配列に追加
        this.layers.set(layerId, layerData);
        this.layerOrder.push(layerId);
        
        // UI更新
        this.appCore.getManager('ui').updateLayerPanel();
        
        console.log(`➕ レイヤー作成: ${layerData.name} (${layerData.type})`);
        return layerData;
    }
    
    async initializeLayerType(layerData, options) {
        switch (layerData.type) {
            case 'drawing':
                // 描画レイヤー用Graphics作成
                layerData.graphics = new PIXI.Graphics();
                layerData.container.addChild(layerData.graphics);
                break;
                
            case 'text':
                // テキストレイヤー用Text作成
                layerData.textContainer = new PIXI.Container();
                layerData.container.addChild(layerData.textContainer);
                break;
                
            case 'adjustment':
                // 調整レイヤー（フィルター専用）
                layerData.filters = [];
                break;
                
            case 'group':
                // グループレイヤー（子レイヤー管理）
                layerData.children = [];
                break;
        }
    }
    
    deleteLayer(layerId) {
        if (this.layers.size <= 1) {
            console.warn('⚠️ 最後のレイヤーは削除できません');
            return false;
        }
        
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        // コンテナから削除
        this.layerContainer.removeChild(layer.container);
        layer.container.destroy();
        
        // 管理配列から削除
        this.layers.delete(layerId);
        this.layerOrder = this.layerOrder.filter(id => id !== layerId);
        
        // アクティブレイヤーの調整
        if (this.activeLayerId === layerId) {
            this.setActiveLayer(this.layerOrder[0]);
        }
        
        // Z-Index再計算
        this.updateLayerOrder();
        
        // UI更新
        this.appCore.getManager('ui').updateLayerPanel();
        
        console.log(`➖ レイヤー削除: ${layer.name}`);
        return true;
    }
    
    moveLayer(layerId, newIndex) {
        const currentIndex = this.layerOrder.indexOf(layerId);
        if (currentIndex === -1) return false;
        
        // 配列から削除して新しい位置に挿入
        this.layerOrder.splice(currentIndex, 1);
        this.layerOrder.splice(newIndex, 0, layerId);
        
        this.updateLayerOrder();
        this.appCore.getManager('ui').updateLayerPanel();
        
        return true;
    }
    
    updateLayerOrder() {
        this.layerOrder.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.container.zIndex = index;
            }
        });
    }
    
    setActiveLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        this.activeLayerId = layerId;
        
        // UI更新
        this.appCore.getManager('ui').updateActiveLayer(layerId);
        
        console.log(`👆 アクティブレイヤー: ${layer.name}`);
        return true;
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    getActiveDrawingTarget() {
        const activeLayer = this.getActiveLayer();
        if (!activeLayer) return null;
        
        switch (activeLayer.type) {
            case 'drawing':
                return activeLayer.graphics;
            case 'text':
                return activeLayer.textContainer;
            default:
                return null;
        }
    }
    
    setLayerProperty(layerId, property, value) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        switch (property) {
            case 'visible':
                layer.visible = value;
                layer.container.visible = value;
                break;
                
            case 'opacity':
                layer.opacity = Math.max(0, Math.min(1, value));
                layer.container.alpha = layer.opacity;
                break;
                
            case 'blendMode':
                layer.blendMode = value;
                layer.container.blendMode = value;
                break;
                
            case 'name':
                layer.name = value;
                break;
                
            case 'locked':
                layer.locked = value;
                break;
        }
        
        // UI更新
        this.appCore.getManager('ui').updateLayerPanel();
        
        return true;
    }
    
    duplicateLayer(layerId) {
        const sourceLayer = this.layers.get(layerId);
        if (!sourceLayer) return null;
        
        const newLayer = await this.createLayer({
            name: `${sourceLayer.name} のコピー`,
            type: sourceLayer.type,
            visible: sourceLayer.visible,
            opacity: sourceLayer.opacity,
            blendMode: sourceLayer.blendMode
        });
        
        // コンテンツをコピー
        await this.copyLayerContent(sourceLayer, newLayer);
        
        return newLayer;
    }
    
    async copyLayerContent(sourceLayer, targetLayer) {
        switch (sourceLayer.type) {
            case 'drawing':
                // Graphics内容をコピー
                const sourceData = sourceLayer.graphics.geometry.graphicsData;
                targetLayer.graphics.geometry.graphicsData = [...sourceData];
                targetLayer.graphics.geometry.invalidate();
                break;
                
            case 'text':
                // テキスト内容をコピー
                sourceLayer.textContainer.children.forEach(child => {
                    if (child instanceof PIXI.Text) {
                        const newText = child.clone();
                        targetLayer.textContainer.addChild(newText);
                    }
                });
                break;
        }
    }
    
    generateLayerId() {
        return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    setupLayerEvents() {
        // レイヤーパネルからのイベント処理
        document.addEventListener('layer:create', (e) => {
            this.createLayer(e.detail);
        });
        
        document.addEventListener('layer:delete', (e) => {
            this.deleteLayer(e.detail.layerId);
        });
        
        document.addEventListener('layer:move', (e) => {
            this.moveLayer(e.detail.layerId, e.detail.newIndex);
        });
        
        document.addEventListener('layer:property', (e) => {
            this.setLayerProperty(e.detail.layerId, e.detail.property, e.detail.value);
        });
    }
    
    // エクスポート用
    getLayerHierarchy() {
        return this.layerOrder.map(layerId => {
            const layer = this.layers.get(layerId);
            return {
                id: layer.id,
                name: layer.name,
                type: layer.type,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                locked: layer.locked
            };
        });
    }
}
```

## 🔧 Phase2.2: 高度描画ツール実装

### tools/base-tool.js（基底クラス）
```javascript
/**
 * 🛠️ BaseTool - ツール基底クラス
 * 責務:
 * - 共通ツールインターフェース定義
 * - イベント処理の標準化
 * - カーソル管理
 * - 設定管理
 */

class BaseTool {
    constructor(name, options = {}) {
        this.name = name;
        this.displayName = options.displayName || name;
        this.cursor = options.cursor || 'default';
        this.shortcut = options.shortcut || null;
        this.category = options.category || 'basic';
        
        // ツール状態
        this.isActive = false;
        this.isDrawing = false;
        this.settings = { ...options.settings };
        
        // イベント管理
        this.eventListeners = new Map();
        
        // AppCore参照（初期化時に設定）
        this.appCore = null;
    }
    
    // 初期化（継承クラスでオーバーライド）
    async init(appCore) {
        this.appCore = appCore;
        await this.setupTool();
    }
    
    async setupTool() {
        // 継承クラスでオーバーライド
    }
    
    // ツール有効化
    activate() {
        this.isActive = true;
        this.onActivate();
        this.updateCursor();
        console.log(`🛠️ ツール有効化: ${this.displayName}`);
    }
    
    // ツール無効化
    deactivate() {
        this.isActive = false;
        this.isDrawing = false;
        this.onDeactivate();
        console.log(`🛠️ ツール無効化: ${this.displayName}`);
    }
    
    // イベントハンドラー（継承クラスでオーバーライド）
    onPointerDown(event) {
        if (!this.isActive) return;
        this.isDrawing = true;
        this.handleStart(event);
    }
    
    onPointerMove(event) {
        if (!this.isActive) return;
        
        if (this.isDrawing) {
            this.handleMove(event);
        } else {
            this.handleHover(event);
        }
    }
    
    onPointerUp(event) {
        if (!this.isActive || !this.isDrawing) return;
        this.isDrawing = false;
        this.handleEnd(event);
    }
    
    // 抽象メソッド（継承クラスで実装必須）
    handleStart(event) {
        throw new Error('handleStart() must be implemented');
    }
    
    handleMove(event) {
        throw new Error('handleMove() must be implemented');
    }
    
    handleEnd(event) {
        throw new Error('handleEnd() must be implemented');
    }
    
    handleHover(event) {
        // オプション: ホバー処理
    }
    
    onActivate() {
        // オプション: 有効化時処理
    }
    
    onDeactivate() {
        // オプション: 無効化時処理
    }
    
    // ユーティリティメソッド
    updateCursor() {
        if (this.appCore?.app?.view) {
            this.appCore.app.view.style.cursor = this.cursor;
        }
    }
    
    getLocalPosition(event) {
        return this.appCore.getLocalPointerPosition(event);
    }
    
    getActiveLayer() {
        return this.appCore.getManager('layer').getActiveLayer();
    }
    
    getDrawingTarget() {
        return this.appCore.getManager('layer').getActiveDrawingTarget();
    }
    
    saveToHistory() {
        this.appCore.getManager('memory').saveState();
    }
    
    // 設定管理
    getSetting(key) {
        return this.settings[key];
    }
    
    setSetting(key, value) {
        this.settings[key] = value;
        this.onSettingChanged(key, value);
    }
    
    onSettingChanged(key, value) {
        // オプション: 設定変更時処理
    }
    
    // プリセット管理
    getPreset() {
        return { ...this.settings };
    }
    
    loadPreset(preset) {
        Object.assign(this.settings, preset);
        this.onPresetLoaded(preset);
    }
    
    onPresetLoaded(preset) {
        // オプション: プリセット読み込み時処理
    }
}
```

### tools/bezier-tool.js（ベジェ曲線ツール）
```javascript
/**
 * 🎨 BezierTool - ベジェ曲線描画ツール
 * 責務:
 * - ベジェ曲線の描画
 * - 制御点の編集
 * - パスの作成・編集
 */

class BezierTool extends BaseTool {
    constructor() {
        super('bezier', {
            displayName: 'ベジェ曲線',
            cursor: 'crosshair',
            shortcut: 'V',
            category: 'vector',
            settings: {
                strokeWidth: 2,
                strokeColor: '#000000',
                fillColor: '#transparent',
                showControlPoints: true,
                smoothing: 0.5
            }
        });
        
        // ベジェ曲線状態
        this.currentPath = null;
        this.controlPoints = [];
        this.isEditMode = false;
        this.selectedPoint = null;
    }
    
    async setupTool() {
        // Bezier.jsライブラリの確認
        if (typeof Bezier === 'undefined') {
            console.warn('⚠️ Bezier.js未検出: 基本ベジェ機能のみ');
            this.hasBezierLib = false;
        } else {
            this.hasBezierLib = true;
            console.log('✅ Bezier.js検出: 高度ベジェ機能有効');
        }
    }
    
    handleStart(event) {
        const position = this.getLocalPosition(event);
        const drawingTarget = this.getDrawingTarget();
        
        if (!drawingTarget) {
            console.warn('⚠️ 描画対象レイヤーがありません');
            return;
        }
        
        if (!this.currentPath) {
            // 新しいパス開始
            this.startNewPath(position, drawingTarget);
        } else {
            // 既存パスに点を追加
            this.addPointToPath(position);
        }
    }
    
    startNewPath(startPosition, drawingTarget) {
        this.currentPath = {
            points: [startPosition],
            controlPoints: [],
            graphics: new PIXI.Graphics(),
            settings: { ...this.settings }
        };
        
        drawingTarget.addChild(this.currentPath.graphics);
        this.drawPath();
        
        console.log('🎨 ベジェパス開始');
    }
    
    addPointToPath(position) {
        this.currentPath.points.push(position);
        
        // 制御点の自動計算
        if (this.currentPath.points.length >= 2) {
            this.calculateControlPoints();
        }
        
        this.drawPath();
    }
    
    handleMove(event) {
        if (!this.currentPath || !this.isDrawing) return;
        
        const position = this.getLocalPosition(event);
        
        // プレビュー表示
        this.drawPreview(position);
    }
    
    handleEnd(event) {
        // パス完了確認（ダブルクリックまたはEscキー）
    }
    
    calculateControlPoints() {
        const points = this.currentPath.points;
        const smoothing = this.getSetting('smoothing');
        
        if (this.hasBezierLib) {
            // Bezier.jsを使用した高精度計算
            this.calculateWithBezierLib(points, smoothing);
        } else {
            // 基本的な制御点計算
            this.calculateBasicControlPoints(points, smoothing);
        }
    }
    
    calculateWithBezierLib(points, smoothing) {
        // Bezier.jsライブラリを活用した制御点計算
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // カーブの自然な制御点を計算
            const bezier = new Bezier([prev, curr, next]);
            const tangent = bezier.derivative(0.5);
            
            this.currentPath.controlPoints[i] = {
                cp1: {
                    x: curr.x - tangent.x * smoothing,
                    y: curr.y - tangent.y * smoothing
                },
                cp2: {
                    x: curr.x + tangent.x * smoothing,
                    y: curr.y + tangent.y * smoothing
                }
            };
        }
    }
    
    calculateBasicControlPoints(points, smoothing) {
        // 基本的な制御点計算（Bezier.js無し）
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // 簡単な接線ベクトル計算
            const dx = (next.x - prev.x) * smoothing * 0.3;
            const dy = (next.y - prev.y) * smoothing * 0.3;
            
            this.currentPath.controlPoints[i] = {
                cp1: { x: curr.x - dx, y: curr.y - dy },
                cp2: { x: curr.x + dx, y: curr.y + dy }
            };
        }
    }
    
    drawPath() {
        const graphics = this.currentPath.graphics;
        const points = this.currentPath.points;
        const controlPoints = this.currentPath.controlPoints;
        
        graphics.clear();
        
        // パス描画設定
        graphics.lineStyle(
            this.getSetting('strokeWidth'),
            this.getSetting('strokeColor'),
            1
        );
        
        if (points.length === 1) {
            // 単一点
            graphics.drawCircle(points[0].x, points[0].y, 2);
        } else if (points.length === 2) {
            // 直線
            graphics.moveTo(points[0].x, points[0].y);
            graphics.lineTo(points[1].x, points[1].y);
        } else {
            // ベジェ曲線
            this.drawBezierCurve(graphics, points, controlPoints);
        }
        
        // 制御点表示
        if (this.getSetting('showControlPoints')) {
            this.drawControlPoints(graphics, points, controlPoints);
        }
    }
    
    drawBezierCurve(graphics, points, controlPoints) {
        graphics.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            const curr = points[i];
            const control = controlPoints[i - 1];
            
            if (control) {
                graphics.bezierCurveTo(
                    control.cp1.x, control.cp1.y,
                    control.cp2.x, control.cp2.y,
                    curr.x, curr.y
                );
            } else {
                graphics.lineTo(curr.x, curr.y);
            }
        }
    }
    
    drawControlPoints(graphics, points, controlPoints) {
        // アンカーポイント描画
        graphics.lineStyle(0);
        graphics.beginFill(0xFF0000, 0.8);
        
        points.forEach(point => {
            graphics.drawCircle(point.x, point.y, 3);
        });
        
        graphics.endFill();
        
        // 制御点描画
        graphics.lineStyle(1, 0x0080FF, 0.6);
        graphics.beginFill(0x0080FF, 0.6);
        
        controlPoints.forEach((control, index) => {
            if (control) {
                const anchor = points[index + 1];
                
                // 制御線
                graphics.moveTo(anchor.x, anchor.y);
                graphics.lineTo(control.cp1.x, control.cp1.y);
                graphics.moveTo(anchor.x, anchor.y);
                graphics.lineTo(control.cp2.x, control.cp2.y);
                
                // 制御点
                graphics.drawCircle(control.cp1.x, control.cp1.y, 2);
                graphics.drawCircle(control.cp2.x, control.cp2.y, 2);
            }
        });
        
        graphics.endFill();
    }
    
    drawPreview(position) {
        // 次の点のプレビュー表示
        if (!this.currentPath || this.currentPath.points.length === 0) return;
        
        const graphics = this.currentPath.graphics;
        const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
        
        // 一時的にプレビューライン描画
        graphics.lineStyle(1, 0x808080, 0.5);
        graphics.moveTo(lastPoint.x, lastPoint.y);
        graphics.lineTo(position.x, position.y);
    }
    
    finishPath() {
        if (!this.currentPath) return;
        
        // 履歴保存
        this.saveToHistory();
        
        // パス完了処理
        console.log(`✅ ベジェパス完了: ${this.currentPath.points.length}点`);
        this.currentPath = null;
    }
    
    onActivate() {
        // ベジェツール固有の初期化
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    onDeactivate() {
        // 未完成パスの処理
        if (this.currentPath) {
            this.finishPath();
        }
        
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    handleKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                if (this.currentPath) {
                    this.finishPath();
                }
                break;
            case 'Enter':
                if (this.currentPath) {
                    this.finishPath();
                }
                break;
        }
    }
}
```

### tools/shape-tool.js（図形ツール）
```javascript
/**
 * 🔷 ShapeTool - 図形描画ツール
 * 責務:
 * - 基本図形の描画（矩形、円、多角形）
 * - 図形の変形・調整
 * - 正確な寸法制御
 */

class ShapeTool extends BaseTool {
    constructor() {
        super('shape', {
            displayName: '図形',
            cursor: 'crosshair',
            shortcut: 'U',
            category: 'vector',
            settings: {
                shapeType: 'rectangle', // rectangle, ellipse, polygon, star
                strokeWidth: 2,
                strokeColor: '#000000',
                fillColor: '#transparent',
                fillEnabled: false,
                sides: 6, // 多角形の辺数
                starInnerRadius: 0.5, // 星形の内径比
                cornerRadius: 0, // 角丸半径
                constrainProportions: false, // 比例制約
                fromCenter: false // 中心から描画
            }
        });
        
        // 描画状態
        this.startPoint = null;
        this.currentShape = null;
        this.previewShape = null;
    }
    
    async setupTool() {
        console.log('🔷 図形ツール初期化完了');
    }
    
    handleStart(event) {
        const position = this.getLocalPosition(event);
        const drawingTarget = this.getDrawingTarget();
        
        if (!drawingTarget) {
            console.warn('⚠️ 描画対象レイヤーがありません');
            return;
        }
        
        this.startPoint = position;
        
        // プレビュー図形作成
        this.previewShape = new PIXI.Graphics();
        drawingTarget.addChild(this.previewShape);
        
        console.log(`🔷 図形描画開始: ${this.getSetting('shapeType')}`);
    }
    
    handleMove(event) {
        if (!this.startPoint || !this.previewShape) return;
        
        const currentPoint = this.getLocalPosition(event);
        this.drawShapePreview(this.startPoint, currentPoint);
    }
    
    handleEnd(event) {
        if (!this.startPoint || !this.previewShape) return;
        
        const endPoint = this.getLocalPosition(event);
        
        // 最終図形作成
        this.createFinalShape(this.startPoint, endPoint);
        
        // プレビュー削除
        this.previewShape.parent.removeChild(this.previewShape);
        this.previewShape.destroy();
        this.previewShape = null;
        this.startPoint = null;
        
        // 履歴保存
        this.saveToHistory();
        
        console.log('✅ 図形描画完了');
    }
    
    drawShapePreview(startPoint, endPoint) {
        const graphics = this.previewShape;
        graphics.clear();
        
        // 描画スタイル設定
        this.applyShapeStyle(graphics, true); // プレビュー用
        
        // 図形タイプ別描画
        const bounds = this.calculateBounds(startPoint, endPoint);
        this.drawShape(graphics, bounds);
    }
    
    createFinalShape(startPoint, endPoint) {
        const drawingTarget = this.getDrawingTarget();
        const finalShape = new PIXI.Graphics();
        
        // 描画スタイル設定
        this.applyShapeStyle(finalShape, false); // 最終版
        
        // 図形描画
        const bounds = this.calculateBounds(startPoint, endPoint);
        this.drawShape(finalShape, bounds);
        
        drawingTarget.addChild(finalShape);
        this.currentShape = finalShape;
    }
    
    calculateBounds(startPoint, endPoint) {
        let { x: x1, y: y1 } = startPoint;
        let { x: x2, y: y2 } = endPoint;
        
        // 中心から描画の場合
        if (this.getSetting('fromCenter')) {
            const centerX = x1;
            const centerY = y1;
            const deltaX = Math.abs(x2 - x1);
            const deltaY = Math.abs(y2 - y1);
            
            x1 = centerX - deltaX;
            y1 = centerY - deltaY;
            x2 = centerX + deltaX;
            y2 = centerY + deltaY;
        }
        
        // 比例制約
        if (this.getSetting('constrainProportions')) {
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);
            const size = Math.min(width, height);
            
            if (x2 < x1) x2 = x1 - size;
            else x2 = x1 + size;
            
            if (y2 < y1) y2 = y1 - size;
            else y2 = y1 + size;
        }
        
        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
            centerX: (x1 + x2) / 2,
            centerY: (y1 + y2) / 2
        };
    }
    
    applyShapeStyle(graphics, isPreview = false) {
        const strokeWidth = this.getSetting('strokeWidth');
        const strokeColor = this.getSetting('strokeColor');
        const fillColor = this.getSetting('fillColor');
        const fillEnabled = this.getSetting('fillEnabled');
        
        // ストローク設定
        if (strokeWidth > 0) {
            const alpha = isPreview ? 0.7 : 1.0;
            graphics.lineStyle(strokeWidth, strokeColor, alpha);
        }
        
        // フィル設定
        if (fillEnabled && fillColor !== '#transparent') {
            const alpha = isPreview ? 0.3 : 1.0;
            const color = typeof fillColor === 'string' 
                ? parseInt(fillColor.replace('#', ''), 16) 
                : fillColor;
            graphics.beginFill(color, alpha);
        }
    }
    
    drawShape(graphics, bounds) {
        const shapeType = this.getSetting('shapeType');
        
        switch (shapeType) {
            case 'rectangle':
                this.drawRectangle(graphics, bounds);
                break;
            case 'ellipse':
                this.drawEllipse(graphics, bounds);
                break;
            case 'polygon':
                this.drawPolygon(graphics, bounds);
                break;
            case 'star':
                this.drawStar(graphics, bounds);
                break;
            default:
                this.drawRectangle(graphics, bounds);
        }
        
        graphics.endFill();
    }
    
    drawRectangle(graphics, bounds) {
        const cornerRadius = this.getSetting('cornerRadius');
        
        if (cornerRadius > 0) {
            // 角丸矩形
            graphics.drawRoundedRect(
                bounds.x, bounds.y, 
                bounds.width, bounds.height, 
                cornerRadius
            );
        } else {
            // 通常の矩形
            graphics.drawRect(
                bounds.x, bounds.y, 
                bounds.width, bounds.height
            );
        }
    }
    
    drawEllipse(graphics, bounds) {
        graphics.drawEllipse(
            bounds.centerX, bounds.centerY,
            bounds.width / 2, bounds.height / 2
        );
    }
    
    drawPolygon(graphics, bounds) {
        const sides = Math.max(3, this.getSetting('sides'));
        const radius = Math.min(bounds.width, bounds.height) / 2;
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2; // -90度から開始
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            points.push(x, y);
        }
        
        graphics.drawPolygon(points);
    }
    
    drawStar(graphics, bounds) {
        const sides = Math.max(3, this.getSetting('sides'));
        const outerRadius = Math.min(bounds.width, bounds.height) / 2;
        const innerRadius = outerRadius * this.getSetting('starInnerRadius');
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        
        const points = [];
        for (let i = 0; i < sides * 2; i++) {
            const angle = (i * Math.PI) / sides - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            points.push(x, y);
        }
        
        graphics.drawPolygon(points);
    }
    
    onSettingChanged(key, value) {
        // 設定変更時の処理
        switch (key) {
            case 'shapeType':
                console.log(`🔄 図形タイプ変更: ${value}`);
                break;
            case 'sides':
                console.log(`🔄 多角形辺数: ${value}`);
                break;
        }
    }
}
```

## 🔧 Phase2.3: 非破壊変形システム

### managers/transform-manager.js（新規・非破壊変形）
```javascript
/**
 * 🔄 TransformManager - 非破壊変形システム
 * 責務:
 * - オブジェクト選択・変形
 * - 変形ハンドル管理
 * - 座標変換計算
 * - 変形履歴管理
 */

class TransformManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        
        // 選択・変形状態
        this.selectedObjects = new Set();
        this.transformBounds = null;
        this.transformHandles = null;
        this.transformMode = 'select'; // select, move, scale, rotate
        this.isTransforming = false;
        
        // 変形データ
        this.transformData = {
            startBounds: null,
            currentBounds: null,
            pivot: { x: 0, y: 0 },
            angle: 0,
            scaleX: 1,
            scaleY: 1
        };
        
        this.isInitialized = false;
    }
    
    async init() {
        await this.setupTransformSystem();
        await this.createTransformHandles();
        this.setupEvents();
        
        this.isInitialized = true;
        console.log('🔄 TransformManager 初期化完了');
    }
    
    async setupTransformSystem() {
        // 変形用コンテナ作成
        this.transformContainer = new PIXI.Container();
        this.transformContainer.name = 'transform-system';
        
        const drawingContainer = this.appCore.getManager('canvas').getDrawingContainer();
        drawingContainer.addChild(this.transformContainer);
        
        // 選択範囲表示用Graphics
        this.selectionGraphics = new PIXI.Graphics();
        this.transformContainer.addChild(this.selectionGraphics);
    }
    
    async createTransformHandles() {
        // 変形ハンドル作成
        this.transformHandles = {
            container: new PIXI.Container(),
            handles: {},
            visible: false
        };
        
        // 8方向 + 回転ハンドル
        const handleTypes = [
            'nw', 'n', 'ne',
            'w',       'e',
            'sw', 's', 'se',
            'rotate'
        ];
        
        handleTypes.forEach(type => {
            const handle = this.createHandle(type);
            this.transformHandles.handles[type] = handle;
            this.transformHandles.container.addChild(handle);
        });
        
        this.transformContainer.addChild(this.transformHandles.container);
        this.hideTransformHandles();
    }
    
    createHandle(type) {
        const handle = new PIXI.Graphics();
        handle.interactive = true;
        handle.buttonMode = true;
        handle.name = `handle-${type}`;
        
        // ハンドルタイプ別の外観
        if (type === 'rotate') {
            // 回転ハンドル
            handle.lineStyle(2, 0x4080FF);
            handle.beginFill(0xFFFFFF);
            handle.drawCircle(0, 0, 6);
            handle.endFill();
        } else {
            // リサイズハンドル
            handle.lineStyle(1, 0x4080FF);
            handle.beginFill(0xFFFFFF);
            handle.drawRect(-4, -4, 8, 8);
            handle.endFill();
        }
        
        // カーソル設定
        this.setHandleCursor(handle, type);
        
        // イベント設定
        handle.on('pointerdown', (event) => this.handleTransformStart(event, type));
        
        return handle;
    }
    
    setHandleCursor(handle, type) {
        const cursors = {
            'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
            'w': 'w-resize',                    'e': 'e-resize',
            'sw': 'sw-resize', 's': 's-resize', 'se': 'se-resize',
            'rotate': 'grab'
        };
        
        handle.cursor = cursors[type] || 'default';
    }
    
    selectObject(displayObject) {
        if (!displayObject) return false;
        
        // 既存選択をクリア
        if (!this.isMultiSelect()) {
            this.clearSelection();
        }
        
        // オブジェクトを選択に追加
        this.selectedObjects.add(displayObject);
        
        // 選択範囲更新
        this.updateSelectionBounds();
        this.showTransformHandles();
        
        // UI更新
        this.appCore.getManager('ui').updateSelection(Array.from(this.selectedObjects));
        
        console.log(`👆 オブジェクト選択: ${displayObject.name || 'Unnamed'}`);
        return true;
    }
    
    deselectObject(displayObject) {
        if (this.selectedObjects.has(displayObject)) {
            this.selectedObjects.delete(displayObject);
            
            if (this.selectedObjects.size === 0) {
                this.hideTransformHandles();
            } else {
                this.updateSelectionBounds();
            }
            
            return true;
        }
        return false;
    }
    
    clearSelection() {
        this.selectedObjects.clear();
        this.hideTransformHandles();
        this.clearSelectionGraphics();
        
        // UI更新
        this.appCore.getManager('ui').updateSelection([]);
        
        console.log('🔄 選択クリア');
    }
    
    updateSelectionBounds() {
        if (this.selectedObjects.size === 0) return;
        
        // 選択オブジェクトの合成バウンド計算
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.selectedObjects.forEach(obj => {
            const bounds = obj.getBounds();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        this.transformBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
        
        // 選択範囲表示更新
        this.updateSelectionGraphics();
        
        // ハンドル位置更新
        if (this.transformHandles.visible) {
            this.updateHandlePositions();
        }
    }
    
    updateSelectionGraphics() {
        if (!this.transformBounds) return;
        
        this.selectionGraphics.clear();
        this.selectionGraphics.lineStyle(1, 0x4080FF, 0.8);
        this.selectionGraphics.drawRect(
            this.transformBounds.x,
            this.transformBounds.y,
            this.transformBounds.width,
            this.transformBounds.height
        );
    }
    
    clearSelectionGraphics() {
        this.selectionGraphics.clear();
    }
    
    showTransformHandles() {
        if (!this.transformBounds) return;
        
        this.transformHandles.visible = true;
        this.transformHandles.container.visible = true;
        this.updateHandlePositions();
    }
    
    hideTransformHandles() {
        this.transformHandles.visible = false;
        this.transformHandles.container.visible = false;
    }
    
    updateHandlePositions() {
        if (!this.transformBounds || !this.transformHandles.visible) return;
        
        const bounds = this.transformBounds;
        const handles = this.transformHandles.handles;
        
        // 8方向ハンドル配置
        handles.nw.position.set(bounds.x, bounds.y);
        handles.n.position.set(bounds.centerX, bounds.y);
        handles.ne.position.set(bounds.x + bounds.width, bounds.y);
        
        handles.w.position.set(bounds.x, bounds.centerY);
        handles.e.position.set(bounds.x + bounds.width, bounds.centerY);
        
        handles.sw.position.set(bounds.x, bounds.y + bounds.height);
        handles.s.position.set(bounds.centerX, bounds.y + bounds.height);
        handles.se.position.set(bounds.x + bounds.width, bounds.y + bounds.height);
        
        // 回転ハンドル（上部中央から少し離れた位置）
        handles.rotate.position.set(bounds.centerX, bounds.y - 20);
    }
    
    handleTransformStart(event, handleType) {
        if (this.selectedObjects.size === 0) return;
        
        event.stopPropagation();
        
        this.isTransforming = true;
        this.currentHandle = handleType;
        
        // 変形開始データ保存
        this.transformData.startBounds = { ...this.transformBounds };
        this.transformData.startPointer = this.appCore.getLocalPointerPosition(event);
        
        // モード設定
        if (handleType === 'rotate') {
            this.transformMode = 'rotate';
        } else {
            this.transformMode = 'scale';
        }
        
        // グローバルイベント設定
        document.addEventListener('pointermove', this.handleTransformMove.bind(this));
        document.addEventListener('pointerup', this.handleTransformEnd.bind(this));
        
        console.log(`🔄 変形開始: ${handleType}`);
    }
    
    handleTransformMove(event) {
        if (!this.isTransforming) return;
        
        const currentPointer = this.appCore.getLocalPointerPosition(event);
        
        switch (this.transformMode) {
            case 'scale':
                this.handleScale(currentPointer);
                break;
            case 'rotate':
                this.handleRotate(currentPointer);
                break;
        }
        
        this.applyTransform();
        this.updateSelectionBounds();
    }
    
    handleScale(currentPointer) {
        const startBounds = this.transformData.startBounds;
        const startPointer = this.transformData.startPointer;
        
        const deltaX = currentPointer.x - startPointer.x;
        const deltaY = currentPointer.y - startPointer.y;
        
        // ハンドルタイプ別スケール計算
        let scaleX = 1, scaleY = 1;
        
        switch (this.currentHandle) {
            case 'se':
                scaleX = (startBounds.width + deltaX) / startBounds.width;
                scaleY = (startBounds.height + deltaY) / startBounds.height;
                break;
            case 'nw':
                scaleX = (startBounds.width - deltaX) / startBounds.width;
                scaleY = (startBounds.height - deltaY) / startBounds.height;
                break;
            case 'e':
                scaleX = (startBounds.width + deltaX) / startBounds.width;
                break;
            case 'w':
                scaleX = (startBounds.width - deltaX) / startBounds.width;
                break;
            case 's':
                scaleY = (startBounds.height + deltaY) / startBounds.height;
                break;
            case 'n':
                scaleY = (startBounds.height - deltaY) / startBounds.height;
                break;
            // その他のハンドルも実装...
        }
        
        // 比例制約チェック
        if (this.isProportionalScale()) {
            const scale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
            scaleX = scaleX < 0 ? -scale : scale;
            scaleY = scaleY < 0 ? -scale : scale;
        }
        
        this.transformData.scaleX = Math.max(0.01, scaleX);
        this.transformData.scaleY = Math.max(0.01, scaleY);
    }
    
    handleRotate(currentPointer) {
        const bounds = this.transformBounds;
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        
        // 回転角度計算
        const angle = Math.atan2(
            currentPointer.y - centerY,
            currentPointer.x - centerX
        );
        
        this.transformData.angle = angle;
    }
    
    applyTransform() {
        const scaleX = this.transformData.scaleX;
        const scaleY = this.transformData.scaleY;
        const angle = this.transformData.angle;
        const bounds = this.transformBounds;
        
        this.selectedObjects.forEach(obj => {
            // ピボット設定
            obj.pivot.set(
                bounds.centerX - obj.x,
                bounds.centerY - obj.y
            );
            
            // 変形適用
            obj.scale.set(scaleX, scaleY);
            obj.rotation = angle;
            
            // 位置調整
            obj.position.set(bounds.centerX, bounds.centerY);
        });
    }
    
    handleTransformEnd() {
        if (!this.isTransforming) return;
        
        this.isTransforming = false;
        
        // イベント削除
        document.removeEventListener('pointermove', this.handleTransformMove.bind(this));
        document.removeEventListener('pointerup', this.handleTransformEnd.bind(this));
        
        // 履歴保存
        this.saveToHistory();
        
        // 変形データリセット
        this.transformData.scaleX = 1;
        this.transformData.scaleY = 1;
        this.transformData.angle = 0;
        
        console.log('✅ 変形完了');
    }
    
    saveToHistory() {
        this.appCore.getManager('memory').saveState();
    }
    
    isMultiSelect() {
        return this.appCore.extensions.isAvailable('Keyboard') 
            ? this.appCore.extensions.Keyboard.isPressed('Control')
            : false;
    }
    
    isProportionalScale() {
        return this.appCore.extensions.isAvailable('Keyboard')
            ? this.appCore.extensions.Keyboard.isPressed('Shift')
            : false;
    }
    
    setupEvents() {
        // 選択解除（空白クリック）
        const drawingContainer = this.appCore.getManager('canvas').getDrawingContainer();
        drawingContainer.interactive = true;
        drawingContainer.on('pointerdown', (event) => {
            if (event.target === drawingContainer) {
                this.clearSelection();
            }
        });
        
        // 削除キー
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Delete' && this.selectedObjects.size > 0) {
                this.deleteSelected();
            }
        });
    }
    
    deleteSelected() {
        this.selectedObjects.forEach(obj => {
            if (obj.parent) {
                obj.parent.removeChild(obj);
                obj.destroy();
            }
        });
        
        this.clearSelection();
        this.saveToHistory();
        
        console.log('🗑️ 選択オブジェクト削除');
    }
    
    // 外部API
    getSelectedObjects() {
        return Array.from(this.selectedObjects);
    }
    
    hasSelection() {
        return this.selectedObjects.size > 0;
    }
}
```

## 🎨 Phase2.4: 高度UIコンポーネント

### ui/color-picker.js
```javascript
/**
 * 🎨 ColorPicker - 高度カラーピッカー
 * 責務:
 * - HSV/RGB/HEX カラー選択
 * - カラーパレット管理
 * - カラー履歴
 * - スウォッチ管理
 */

class ColorPicker {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        
        // カラー状態
        this.currentColor = { h: 0, s: 100, v: 100 };
        this.colorHistory = [];
        this.customPalette = [];
        
        // UI要素
        this.container = null;
        this.colorWheel = null;
        this.saturationBar = null;
        this.previewColor = null;
        
        // Chroma.jsライブラリチェック
        this.hasChromaLib = typeof chroma !== 'undefined';
        if (this.hasChromaLib) {
            console.log('✅ Chroma.js検出: 高度カラー機能有効');
        } else {
            console.warn('⚠️ Chroma.js未検出: 基本カラー機能のみ');
        }
    }
    
    async init() {
        await this.createColorPicker();
        this.setupEvents();
        console.log('🎨 ColorPicker 初期化完了');
    }
    
    async createColorPicker() {
        // UIコンテナ作成
        if (this.extensions.isAvailable('UI')) {
            this.container = new this.extensions.UI.Container();
        } else {
            this.container = new PIXI.Container();
        }
        
        // カラーホイール作成
        await this.createColorWheel();
        
        // 彩度・明度バー作成
        await this.createSaturationBar();
        
        // プレビューエリア作成
        await this.createPreviewArea();
        
        // カラーパレット作成
        await this.createColorPalette();
        
        // レイアウト調整
        this.layoutComponents();
    }
    
    async createColorWheel() {
        const size = 200;
        const centerX = size / 2;
        const centerY = size / 2;
        
        this.colorWheel = new PIXI.Graphics();
        this.colorWheel.interactive = true;
        
        if (this.hasChromaLib) {
            // Chroma.jsを使用した高精度カラーホイール
            this.drawHighQualityColorWheel(size, centerX, centerY);
        } else {
            // 基本カラーホイール
            this.drawBasicColorWheel(size, centerX, centerY);
        }
        
        this.container.addChild(this.color
        