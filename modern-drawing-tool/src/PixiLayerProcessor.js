/**
 * ColorProcessor v3.2 - ふたば色統合・Chroma.js活用カラーシステム
 * PixiJS統一座標対応 + Chrome API最適化色処理
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import chroma from 'chroma-js';
import * as PIXI from 'pixi.js';

/**
 * ふたば色統合カラープロセッサー
 * Chroma.js活用による高度色処理・PixiJS Color統合
 */
export class ColorProcessor {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // カラー状態管理
        this.currentColor = chroma('#800000'); // ふたばマルーン
        this.currentColorMode = 'hex';
        this.colorHistory = [];
        this.colorPalettes = new Map();
        
        // ふたば☆ちゃんねる伝統色定義
        this.futabaColors = {
            maroon: chroma('#800000'),          // ふたばマルーン
            lightMaroon: chroma('#aa5a56'),     // ライトマルーン
            medium: chroma('#cf9c97'),          // ミディアム
            cream: chroma('#f0e0d6'),           // ふたばクリーム
            background: chroma('#ffffee'),      // ふたば背景
            sage: chroma('#117743'),            // ふたばセージ
            red: chroma('#cc1105'),             // ふたばレッド
            blue: chroma('#34345c')             // ふたばブルー
        };
        
        // カラーパレット設定
        this.paletteConfigs = {
            futaba: { name: 'ふたば伝統色', colors: Object.values(this.futabaColors) },
            warm: { name: '暖色系', colors: [] },
            cool: { name: '寒色系', colors: [] },
            monochrome: { name: 'モノクロ', colors: [] },
            custom: { name: 'カスタム', colors: [] }
        };
        
        // HSVカラーピッカー状態
        this.hsvPicker = {
            hue: 0,
            saturation: 1,
            value: 1,
            radius: 80,
            centerX: 100,
            centerY: 100
        };
        
        // カラーサンプリング
        this.eyedropperActive = false;
        this.sampledColors = [];
        
        // パフォーマンス最適化
        this.colorCache = new Map();
        this.conversionCache = new Map();
        
        this.initialize();
    }
    
    /**
     * カラープロセッサー初期化
     */
    initialize() {
        try {
            console.log('🌈 ColorProcessor初期化開始 - ふたば色統合システム');
            
            // デフォルトパレット構築
            this.buildDefaultPalettes();
            
            // カラーヒストリー初期化
            this.initializeColorHistory();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // カラーキャッシュ最適化
            this.setupColorCaching();
            
            console.log('✅ ColorProcessor初期化完了 - ふたば色統合システム稼働');
            
        } catch (error) {
            console.error('❌ ColorProcessor初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * デフォルトパレット構築
     */
    buildDefaultPalettes() {
        // ふたば伝統色パレット
        this.colorPalettes.set('futaba', {
            name: 'ふたば伝統色',
            colors: [
                this.futabaColors.maroon,
                this.futabaColors.lightMaroon,
                this.futabaColors.medium,
                this.futabaColors.cream,
                this.futabaColors.background,
                this.futabaColors.sage,
                this.futabaColors.red,
                this.futabaColors.blue
            ]
        });
        
        // 暖色系パレット（ふたば色ベース）
        const warmBase = this.futabaColors.maroon;
        this.colorPalettes.set('warm', {
            name: '暖色系',
            colors: this.generateColorVariations(warmBase, 'warm', 12)
        });
        
        // 寒色系パレット
        const coolBase = this.futabaColors.blue;
        this.colorPalettes.set('cool', {
            name: '寒色系',
            colors: this.generateColorVariations(coolBase, 'cool', 12)
        });
        
        // モノクロパレット（ふたば色明度ベース）
        this.colorPalettes.set('monochrome', {
            name: 'モノクロ',
            colors: this.generateMonochromePalette()
        });
        
        // カスタムパレット（空）
        this.colorPalettes.set('custom', {
            name: 'カスタム',
            colors: []
        });
        
        console.log('🎨 デフォルトカラーパレット構築完了');
    }
    
    /**
     * 色バリエーション生成
     */
    generateColorVariations(baseColor, type, count) {
        const variations = [];
        
        switch (type) {
            case 'warm':
                // 暖色系バリエーション
                for (let i = 0; i < count; i++) {
                    const hue = (baseColor.get('hsl.h') - 30 + (i * 60 / count)) % 360;
                    const saturation = 0.6 + (i % 3) * 0.15;
                    const lightness = 0.3 + (i % 4) * 0.15;
                    variations.push(chroma.hsl(hue, saturation, lightness));
                }
                break;
                
            case 'cool':
                // 寒色系バリエーション
                for (let i = 0; i < count; i++) {
                    const hue = (baseColor.get('hsl.h') + 180 + (i * 60 / count)) % 360;
                    const saturation = 0.5 + (i % 3) * 0.2;
                    const lightness = 0.2 + (i % 4) * 0.2;
                    variations.push(chroma.hsl(hue, saturation, lightness));
                }
                break;
                
            default:
                // 基本バリエーション
                for (let i = 0; i < count; i++) {
                    const factor = i / (count - 1);
                    variations.push(baseColor.mix(chroma.white, factor * 0.8));
                }
        }
        
        return variations;
    }
    
    /**
     * モノクロパレット生成
     */
    generateMonochromePalette() {
        const monochromes = [];
        
        // ふたば色ベースのグレースケール
        for (let i = 0; i < 16; i++) {
            const lightness = i / 15;
            const baseGray = chroma.mix(this.futabaColors.maroon, chroma.white, lightness);
            monochromes.push(baseGray.desaturate(0.8));
        }
        
        return monochromes;
    }
    
    /**
     * カラーヒストリー初期化
     */
    initializeColorHistory() {
        // ふたば伝統色をヒストリーに追加
        this.colorHistory = [
            this.futabaColors.maroon,
            this.futabaColors.lightMaroon,
            this.futabaColors.cream,
            this.futabaColors.background
        ];
        
        this.maxHistorySize = 20;
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // カラー選択要求
        this.eventStore.on('color:select', (data) => {
            this.selectColor(data.color, data.source);
        });
        
        // カラーピッカー表示要求
        this.eventStore.on('color:picker:show', (data) => {
            this.showColorPicker(data.position, data.mode);
        });
        
        // スポイトツール
        this.eventStore.on('color:eyedropper:start', () => {
            this.startEyedropper();
        });
        
        this.eventStore.on('color:eyedropper:sample', (data) => {
            this.sampleColorAt(data.x, data.y);
        });
        
        // パレット操作
        this.eventStore.on('color:palette:add', (data) => {
            this.addColorToPalette(data.color, data.palette);
        });
        
        this.eventStore.on('color:palette:switch', (data) => {
            this.switchPalette(data.palette);
        });
        
        // カラーモード変更
        this.eventStore.on('color:mode:change', (data) => {
            this.changeColorMode(data.mode);
        });
    }
    
    /**
     * カラーキャッシュ設定
     */
    setupColorCaching() {
        // よく使われる色変換をキャッシュ
        this.colorCache.set('futaba-maroon-pixi', this.chromaToPixi(this.futabaColors.maroon));
        this.colorCache.set('futaba-cream-pixi', this.chromaToPixi(this.futabaColors.cream));
        this.colorCache.set('futaba-background-pixi', this.chromaToPixi(this.futabaColors.background));
        
        // キャッシュサイズ制限
        this.maxCacheSize = 100;
    }
    
    /**
     * カラー選択処理
     */
    selectColor(color, source = 'unknown') {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) {
            console.warn('⚠️ 無効なカラー値:', color);
            return;
        }
        
        this.currentColor = chromaColor;
        this.addToHistory(chromaColor);
        
        // PixiJS Color値生成
        const pixiColor = this.chromaToPixi(chromaColor);
        
        // カラー変更イベント発信
        this.eventStore.emit('color:changed', {
            color: chromaColor,
            pixiColor: pixiColor,
            hex: chromaColor.hex(),
            rgb: chromaColor.rgb(),
            hsl: chromaColor.hsl(),
            hsv: chromaColor.hsv(),
            source: source
        });
        
        console.log(`🎨 カラー選択: ${chromaColor.hex()} (${source})`);
    }
    
    /**
     * カラー解析
     */
    parseColor(color) {
        try {
            if (typeof color === 'string') {
                return chroma(color);
            } else if (typeof color === 'number') {
                // PixiJS色値からChromaへ変換
                const r = (color >> 16) & 0xFF;
                const g = (color >> 8) & 0xFF;
                const b = color & 0xFF;
                return chroma.rgb(r, g, b);
            } else if (color && typeof color === 'object') {
                if (color.r !== undefined) {
                    return chroma.rgb(color.r, color.g, color.b);
                } else if (color.h !== undefined) {
                    return chroma.hsl(color.h, color.s, color.l);
                }
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ カラー解析エラー:', error);
            return null;
        }
    }
    
    /**
     * Chroma色をPixiJS色に変換
     */
    chromaToPixi(chromaColor) {
        const cacheKey = chromaColor.hex();
        if (this.colorCache.has(cacheKey)) {
            return this.colorCache.get(cacheKey);
        }
        
        const rgb = chromaColor.rgb();
        const pixiColor = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
        
        // キャッシュに保存
        if (this.colorCache.size < this.maxCacheSize) {
            this.colorCache.set(cacheKey, pixiColor);
        }
        
        return pixiColor;
    }
    
    /**
     * カラーヒストリーに追加
     */
    addToHistory(color) {
        const colorHex = color.hex();
        
        // 重複削除
        this.colorHistory = this.colorHistory.filter(c => c.hex() !== colorHex);
        
        // 先頭に追加
        this.colorHistory.unshift(color);
        
        // サイズ制限
        if (this.colorHistory.length > this.maxHistorySize) {
            this.colorHistory = this.colorHistory.slice(0, this.maxHistorySize);
        }
        
        this.eventStore.emit('color:history:updated', {
            history: this.colorHistory.map(c => ({
                color: c,
                hex: c.hex(),
                pixi: this.chromaToPixi(c)
            }))
        });
    }
    
    /**
     * カラーピッカー表示
     */
    showColorPicker(position, mode = 'hsv') {
        const pickerData = {
            position: position,
            mode: mode,
            currentColor: this.currentColor,
            palettes: this.getPaletteData(),
            history: this.getHistoryData(),
            hsv: this.hsvPicker
        };
        
        this.eventStore.emit('color:picker:display', pickerData);
    }
    
    /**
     * HSVカラーピッカー値計算
     */
    calculateHSVFromPosition(x, y) {
        const dx = x - this.hsvPicker.centerX;
        const dy = y - this.hsvPicker.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.hsvPicker.radius) {
            return null; // 範囲外
        }
        
        // 色相計算
        let hue = Math.atan2(dy, dx) * 180 / Math.PI;
        if (hue < 0) hue += 360;
        
        // 彩度計算
        const saturation = Math.min(distance / this.hsvPicker.radius, 1);
        
        // 明度は現在値を維持
        const value = this.hsvPicker.value;
        
        return { hue, saturation, value };
    }
    
    /**
     * HSV値からカラー生成
     */
    createColorFromHSV(hue, saturation, value) {
        return chroma.hsv(hue, saturation, value);
    }
    
    /**
     * スポイトツール開始
     */
    startEyedropper() {
        this.eyedropperActive = true;
        this.app.view.style.cursor = 'crosshair';
        
        this.eventStore.emit('color:eyedropper:activated', {
            active: true
        });
        
        console.log('🥄 スポイトツール アクティブ');
    }
    
    /**
     * 指定位置の色をサンプリング
     */
    async sampleColorAt(screenX, screenY) {
        if (!this.eyedropperActive) return;
        
        try {
            // PixiJS座標変換
            const pixiPos = this.coordinate.screenToPixi(screenX, screenY);
            
            // PixiJS RenderTexture使用して色取得
            const sampleTexture = PIXI.RenderTexture.create({
                width: 1,
                height: 1
            });
            
            // 指定位置を1x1でレンダリング
            const tempContainer = new PIXI.Container();
            tempContainer.x = -pixiPos.x;
            tempContainer.y = -pixiPos.y;
            
            // 現在の描画内容をコピー
            this.app.stage.children.forEach(child => {
                if (child.visible) {
                    tempContainer.addChild(child);
                }
            });
            
            this.app.renderer.render(tempContainer, { renderTexture: sampleTexture });
            
            // ピクセルデータ取得
            const pixels = this.app.renderer.extract.pixels(sampleTexture);
            const r = pixels[0];
            const g = pixels[1];
            const b = pixels[2];
            
            // Chroma色生成
            const sampledColor = chroma.rgb(r, g, b);
            
            // サンプリング完了
            this.finishEyedropper(sampledColor);
            
            // テクスチャクリーンアップ
            sampleTexture.destroy(true);
            
        } catch (error) {
            console.error('❌ カラーサンプリングエラー:', error);
            this.finishEyedropper(null);
        }
    }
    
    /**
     * スポイトツール終了
     */
    finishEyedropper(sampledColor) {
        this.eyedropperActive = false;
        this.app.view.style.cursor = 'default';
        
        if (sampledColor) {
            this.selectColor(sampledColor, 'eyedropper');
            this.sampledColors.push({
                color: sampledColor,
                timestamp: Date.now()
            });
            
            // サンプリング履歴サイズ制限
            if (this.sampledColors.length > 10) {
                this.sampledColors = this.sampledColors.slice(-10);
            }
        }
        
        this.eventStore.emit('color:eyedropper:deactivated', {
            active: false,
            sampledColor: sampledColor
        });
        
        console.log('🥄 スポイトツール 終了');
    }
    
    /**
     * パレットにカラー追加
     */
    addColorToPalette(color, paletteName = 'custom') {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) return;
        
        const palette = this.colorPalettes.get(paletteName);
        if (!palette) {
            console.warn('⚠️ 存在しないパレット:', paletteName);
            return;
        }
        
        // 重複チェック
        const colorHex = chromaColor.hex();
        const exists = palette.colors.some(c => c.hex() === colorHex);
        
        if (!exists) {
            palette.colors.push(chromaColor);
            
            // パレット更新イベント
            this.eventStore.emit('color:palette:updated', {
                palette: paletteName,
                colors: this.getPaletteColors(paletteName)
            });
            
            console.log(`🎨 パレット追加: ${colorHex} → ${paletteName}`);
        }
    }
    
    /**
     * パレット切り替え
     */
    switchPalette(paletteName) {
        if (!this.colorPalettes.has(paletteName)) {
            console.warn('⚠️ 存在しないパレット:', paletteName);
            return;
        }
        
        this.currentPalette = paletteName;
        
        this.eventStore.emit('color:palette:switched', {
            palette: paletteName,
            colors: this.getPaletteColors(paletteName)
        });
        
        console.log(`🎨 パレット切り替え: ${paletteName}`);
    }
    
    /**
     * カラーモード変更
     */
    changeColorMode(mode) {
        const validModes = ['hex', 'rgb', 'hsl', 'hsv'];
        if (!validModes.includes(mode)) {
            console.warn('⚠️ 無効なカラーモード:', mode);
            return;
        }
        
        this.currentColorMode = mode;
        
        this.eventStore.emit('color:mode:changed', {
            mode: mode,
            currentColor: this.getCurrentColorInMode(mode)
        });
        
        console.log(`🎨 カラーモード変更: ${mode}`);
    }
    
    /**
     * 指定モードでの現在色取得
     */
    getCurrentColorInMode(mode) {
        switch (mode) {
            case 'hex':
                return this.currentColor.hex();
            case 'rgb':
                return this.currentColor.rgb();
            case 'hsl':
                return this.currentColor.hsl();
            case 'hsv':
                return this.currentColor.hsv();
            default:
                return this.currentColor.hex();
        }
    }
    
    /**
     * パレットデータ取得
     */
    getPaletteData() {
        const paletteData = {};
        
        this.colorPalettes.forEach((palette, name) => {
            paletteData[name] = {
                name: palette.name,
                colors: palette.colors.map(color => ({
                    chroma: color,
                    hex: color.hex(),
                    pixi: this.chromaToPixi(color)
                }))
            };
        });
        
        return paletteData;
    }
    
    /**
     * 指定パレットの色データ取得
     */
    getPaletteColors(paletteName) {
        const palette = this.colorPalettes.get(paletteName);
        if (!palette) return [];
        
        return palette.colors.map(color => ({
            chroma: color,
            hex: color.hex(),
            pixi: this.chromaToPixi(color),
            rgb: color.rgb(),
            hsl: color.hsl()
        }));
    }
    
    /**
     * ヒストリーデータ取得
     */
    getHistoryData() {
        return this.colorHistory.map(color => ({
            chroma: color,
            hex: color.hex(),
            pixi: this.chromaToPixi(color)
        }));
    }
    
    /**
     * 色の明度調整
     */
    adjustBrightness(color, amount) {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) return null;
        
        const adjusted = chromaColor.brighten(amount);
        return {
            chroma: adjusted,
            hex: adjusted.hex(),
            pixi: this.chromaToPixi(adjusted)
        };
    }
    
    /**
     * 色の彩度調整
     */
    adjustSaturation(color, amount) {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) return null;
        
        const adjusted = amount > 0 ? 
            chromaColor.saturate(amount) : 
            chromaColor.desaturate(Math.abs(amount));
        
        return {
            chroma: adjusted,
            hex: adjusted.hex(),
            pixi: this.chromaToPixi(adjusted)
        };
    }
    
    /**
     * 色の混合
     */
    mixColors(color1, color2, ratio = 0.5) {
        const chroma1 = this.parseColor(color1);
        const chroma2 = this.parseColor(color2);
        
        if (!chroma1 || !chroma2) return null;
        
        const mixed = chroma.mix(chroma1, chroma2, ratio);
        
        return {
            chroma: mixed,
            hex: mixed.hex(),
            pixi: this.chromaToPixi(mixed)
        };
    }
    
    /**
     * 補色計算
     */
    getComplementaryColor(color) {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) return null;
        
        const hsl = chromaColor.hsl();
        const complementaryHue = (hsl[0] + 180) % 360;
        const complementary = chroma.hsl(complementaryHue, hsl[1], hsl[2]);
        
        return {
            chroma: complementary,
            hex: complementary.hex(),
            pixi: this.chromaToPixi(complementary)
        };
    }
    
    /**
     * 類似色生成
     */
    generateAnalogousColors(color, count = 5) {
        const chromaColor = this.parseColor(color);
        if (!chromaColor) return [];
        
        const hsl = chromaColor.hsl();
        const analogous = [];
        const step = 30; // 色相差
        
        for (let i = -(Math.floor(count / 2)); i <= Math.floor(count / 2); i++) {
            if (i === 0) {
                analogous.push({
                    chroma: chromaColor,
                    hex: chromaColor.hex(),
                    pixi: this.chromaToPixi(chromaColor)
                });
            } else {
                const hue = (hsl[0] + i * step + 360) % 360;
                const analogousColor = chroma.hsl(hue, hsl[1], hsl[2]);
                analogous.push({
                    chroma: analogousColor,
                    hex: analogousColor.hex(),
                    pixi: this.chromaToPixi(analogousColor)
                });
            }
        }
        
        return analogous;
    }
    
    /**
     * カラー情報取得
     */
    getColorInfo() {
        return {
            currentColor: {
                chroma: this.currentColor,
                hex: this.currentColor.hex(),
                rgb: this.currentColor.rgb(),
                hsl: this.currentColor.hsl(),
                hsv: this.currentColor.hsv(),
                pixi: this.chromaToPixi(this.currentColor)
            },
            colorMode: this.currentColorMode,
            historySize: this.colorHistory.length,
            paletteCount: this.colorPalettes.size,
            eyedropperActive: this.eyedropperActive,
            cacheSize: this.colorCache.size
        };
    }
    
    /**
     * パフォーマンス情報取得
     */
    getPerformanceInfo() {
        return {
            colorCacheSize: this.colorCache.size,
            conversionCacheSize: this.conversionCache.size,
            historySize: this.colorHistory.length,
            sampledColorsSize: this.sampledColors.length,
            paletteCount: this.colorPalettes.size,
            totalColors: Array.from(this.colorPalettes.values())
                .reduce((sum, palette) => sum + palette.colors.length, 0)
        };
    }
    
    /**
     * キャッシュクリア
     */
    clearCache() {
        this.colorCache.clear();
        this.conversionCache.clear();
        
        // 基本色を再キャッシュ
        this.setupColorCaching();
        
        console.log('🧹 カラーキャッシュクリア完了');
    }
    
    /**
     * カスタムパレット保存
     */
    saveCustomPalette(name, colors) {
        const chromaColors = colors.map(color => this.parseColor(color)).filter(c => c !== null);
        
        this.colorPalettes.set(name, {
            name: name,
            colors: chromaColors
        });
        
        this.eventStore.emit('color:palette:saved', {
            name: name,
            colors: chromaColors.map(c => ({
                chroma: c,
                hex: c.hex(),
                pixi: this.chromaToPixi(c)
            }))
        });
        
        console.log(`💾 カスタムパレット保存: ${name} (${chromaColors.length}色)`);
    }
    
    /**
     * パレット削除
     */
    deletePalette(name) {
        if (name === 'futaba') {
            console.warn('⚠️ ふたば伝統色パレットは削除できません');
            return;
        }
        
        if (this.colorPalettes.delete(name)) {
            this.eventStore.emit('color:palette:deleted', { name });
            console.log(`🗑️ パレット削除: ${name}`);
        }
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // キャッシュクリア
            this.colorCache.clear();
            this.conversionCache.clear();
            
            // 配列クリア
            this.colorHistory = [];
            this.sampledColors = [];
            
            // パレットクリア
            this.colorPalettes.clear();
            
            // スポイトツール無効化
            if (this.eyedropperActive) {
                this.eyedropperActive = false;
                this.app.view.style.cursor = 'default';
            }
            
            console.log('🌈 ColorProcessor破棄完了');
            
        } catch (error) {
            console.error('❌ ColorProcessor破棄エラー:', error);
        }
    }
}