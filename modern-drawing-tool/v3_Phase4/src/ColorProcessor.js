import chroma from 'chroma-js';

/**
 * ColorProcessor - ふたば☆ちゃんねる色・色処理統合（Phase2拡張）
 * Chroma.js活用・色変換・最適化・履歴管理
 */
export class ColorProcessor {
    constructor(oglCore, eventStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        
        // ふたば☆ちゃんねるカラーパレット
        this.futabaColors = {
            main: '#800000',      // マルーン（メインカラー）
            sub: '#aa5a56',       // 薄いマルーン
            light: '#cf9c97',     // 中間色
            pale: '#e9c2ba',      // 薄いピンクベージュ
            cream: '#f0e0d6',     // クリーム（サブカラー）
            bg: '#ffffee',        // 背景色
            
            // 基本拡張色
            black: '#000000',
            white: '#ffffff',
            red: '#ff0000',
            green: '#00ff00',
            blue: '#0000ff',
            yellow: '#ffff00',
            magenta: '#ff00ff',
            cyan: '#00ffff',
            gray: '#808080',
            darkgray: '#404040'
        };
        
        // 現在の色設定
        this.currentColor = chroma(this.futabaColors.main);
        this.currentColorHistory = [];
        this.maxColorHistory = 20;
        
        // カラーパレット状態
        this.customColors = [];
        this.activeColorPicker = null;
        
        this.initializeFutabaColors();
        this.setupEventSubscriptions();
    }
    
    // ふたば☆ちゃんねる色初期化
    initializeFutabaColors() {
        // デフォルト色設定
        this.setColor(this.futabaColors.main);
        
        // ふたば色パレットUI作成
        this.createFutabaColorPalette();
        
        console.log('✅ Futaba colors initialized with main color:', this.futabaColors.main);
    }
    
    // デフォルトふたば色設定
    setDefaultFutabaColor() {
        this.setColor(this.futabaColors.main);
    }
    
    // 色設定
    setColor(colorValue) {
        try {
            const newColor = chroma(colorValue);
            this.currentColor = newColor;
            
            // 色履歴追加
            this.addToColorHistory(newColor);
            
            // OGLエンジンに色反映
            const rgbArray = newColor.rgb().map(c => c / 255);
            this.oglCore.updateToolConfig('pen', { color: rgbArray });
            
            // イベント発火
            this.eventStore.emit(this.eventStore.eventTypes.COLOR_CHANGE, {
                color: rgbArray,
                hex: newColor.hex(),
                hsl: newColor.hsl(),
                source: 'color_processor'
            });
            
            console.log('🎨 Color set:', newColor.hex());
            return true;
            
        } catch (error) {
            console.error('🚨 Invalid color value:', colorValue, error);
            return false;
        }
    }
    
    // 色履歴追加
    addToColorHistory(color) {
        const hexColor = color.hex();
        
        // 重複削除
        this.currentColorHistory = this.currentColorHistory.filter(c => c !== hexColor);
        
        // 先頭に追加
        this.currentColorHistory.unshift(hexColor);
        
        // 履歴サイズ制限
        if (this.currentColorHistory.length > this.maxColorHistory) {
            this.currentColorHistory = this.currentColorHistory.slice(0, this.maxColorHistory);
        }
    }
    
    // ふたば色パレットUI作成
    createFutabaColorPalette() {
        // パレットボタンは既存のUIに統合される想定
        console.log('🎨 Futaba color palette UI ready');
    }
    
    // HSV色空間での色調整
    adjustHue(delta) {
        const hsl = this.currentColor.hsl();
        const newHue = (hsl[0] + delta) % 360;
        const newColor = chroma.hsl(newHue, hsl[1], hsl[2]);
        this.setColor(newColor);
    }
    
    adjustSaturation(delta) {
        const hsl = this.currentColor.hsl();
        const newSat = Math.max(0, Math.min(1, hsl[1] + delta));
        const newColor = chroma.hsl(hsl[0], newSat, hsl[2]);
        this.setColor(newColor);
    }
    
    adjustLightness(delta) {
        const hsl = this.currentColor.hsl();
        const newLight = Math.max(0, Math.min(1, hsl[2] + delta));
        const newColor = chroma.hsl(hsl[0], hsl[1], newLight);
        this.setColor(newColor);
    }
    
    // 色の調和色生成
    generateHarmoniousColors(type = 'complementary') {
        const baseHue = this.currentColor.hsl()[0];
        const sat = this.currentColor.hsl()[1];
        const light = this.currentColor.hsl()[2];
        
        let harmonies = [];
        
        switch (type) {
            case 'complementary':
                harmonies = [
                    chroma.hsl(baseHue, sat, light),
                    chroma.hsl((baseHue + 180) % 360, sat, light)
                ];
                break;
                
            case 'triadic':
                harmonies = [
                    chroma.hsl(baseHue, sat, light),
                    chroma.hsl((baseHue + 120) % 360, sat, light),
                    chroma.hsl((baseHue + 240) % 360, sat, light)
                ];
                break;
                
            case 'analogous':
                harmonies = [
                    chroma.hsl((baseHue - 30 + 360) % 360, sat, light),
                    chroma.hsl(baseHue, sat, light),
                    chroma.hsl((baseHue + 30) % 360, sat, light)
                ];
                break;
                
            case 'futaba_variations':
                // ふたば色バリエーション
                harmonies = [
                    chroma(this.futabaColors.main),
                    chroma(this.futabaColors.sub),
                    chroma(this.futabaColors.light),
                    chroma(this.futabaColors.pale),
                    chroma(this.futabaColors.cream)
                ];
                break;
        }
        
        return harmonies.map(color => ({
            hex: color.hex(),
            rgb: color.rgb(),
            hsl: color.hsl()
        }));
    }
    
    // グラデーション生成
    generateGradient(endColor, steps = 10) {
        try {
            const endChroma = chroma(endColor);
            const scale = chroma.scale([this.currentColor, endChroma]).mode('lab');
            
            const gradient = [];
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const color = scale(t);
                gradient.push({
                    hex: color.hex(),
                    rgb: color.rgb(),
                    hsl: color.hsl(),
                    position: t
                });
            }
            
            return gradient;
            
        } catch (error) {
            console.error('🚨 Gradient generation failed:', error);
            return [];
        }
    }
    
    // 色の明度・彩度分析
    analyzeColor(color = null) {
        const targetColor = color ? chroma(color) : this.currentColor;
        
        return {
            hex: targetColor.hex(),
            rgb: targetColor.rgb(),
            hsl: targetColor.hsl(),
            hsv: targetColor.hsv(),
            lab: targetColor.lab(),
            luminance: targetColor.luminance(),
            temperature: targetColor.temperature(),
            contrast: {
                white: chroma.contrast(targetColor, 'white'),
                black: chroma.contrast(targetColor, 'black'),
                futabaMain: chroma.contrast(targetColor, this.futabaColors.main)
            }
        };
    }
    
    // 色の可読性チェック
    checkReadability(backgroundColor = '#ffffff') {
        const bgColor = chroma(backgroundColor);
        const contrast = chroma.contrast(this.currentColor, bgColor);
        
        return {
            contrast: contrast,
            aa: contrast >= 4.5,      // WCAG AA準拠
            aaa: contrast >= 7,       // WCAG AAA準拠
            readability: contrast >= 4.5 ? 'good' : contrast >= 3 ? 'fair' : 'poor'
        };
    }
    
    // ふたば色との親和性チェック
    checkFutabaCompatibility(color = null) {
        const targetColor = color ? chroma(color) : this.currentColor;
        const futabaMain = chroma(this.futabaColors.main);
        
        const hslTarget = targetColor.hsl();
        const hslFutaba = futabaMain.hsl();
        
        // 色相差計算
        const hueDiff = Math.abs(hslTarget[0] - hslFutaba[0]);
        const normalizedHueDiff = Math.min(hueDiff, 360 - hueDiff);
        
        // 彩度・明度差計算
        const satDiff = Math.abs(hslTarget[1] - hslFutaba[1]);
        const lightDiff = Math.abs(hslTarget[2] - hslFutaba[2]);
        
        // 総合親和性スコア（0-100）
        const compatibilityScore = Math.max(0, 100 - (
            normalizedHueDiff * 0.5 + 
            satDiff * 30 + 
            lightDiff * 20
        ));
        
        return {
            score: compatibilityScore,
            level: compatibilityScore >= 80 ? 'high' : 
                   compatibilityScore >= 60 ? 'medium' : 'low',
            hueDifference: normalizedHueDiff,
            saturationDifference: satDiff,
            lightnessDifference: lightDiff
        };
    }
    
    // カスタムカラー保存
    saveCustomColor(name = null) {
        const colorData = {
            name: name || `Custom ${this.customColors.length + 1}`,
            hex: this.currentColor.hex(),
            rgb: this.currentColor.rgb(),
            hsl: this.currentColor.hsl(),
            timestamp: Date.now()
        };
        
        this.customColors.push(colorData);
        console.log('💾 Custom color saved:', colorData.name, colorData.hex);
        
        return colorData;
    }
    
    // カスタムカラー削除
    deleteCustomColor(index) {
        if (index >= 0 && index < this.customColors.length) {
            const deleted = this.customColors.splice(index, 1)[0];
            console.log('🗑️ Custom color deleted:', deleted.name);
            return deleted;
        }
        return null;
    }
    
    // 色からスポイト実行
    sampleColorFromPoint(point) {
        // OGLエンジンから指定座標の色を取得
        // 実際の実装はOGLのreadPixels相当機能が必要
        
        // 仮実装（ランダム色）
        const sampledColor = chroma.random();
        this.setColor(sampledColor);
        
        console.log('💧 Color sampled from point:', point, sampledColor.hex());
        
        return {
            color: sampledColor.hex(),
            point: point,
            timestamp: Date.now()
        };
    }
    
    // 色空間変換ユーティリティ
    convertColor(color, fromSpace, toSpace) {
        try {
            let chromaColor;
            
            switch (fromSpace.toLowerCase()) {
                case 'hex':
                    chromaColor = chroma(color);
                    break;
                case 'rgb':
                    chromaColor = chroma.rgb(...color);
                    break;
                case 'hsl':
                    chromaColor = chroma.hsl(...color);
                    break;
                case 'hsv':
                    chromaColor = chroma.hsv(...color);
                    break;
                case 'lab':
                    chromaColor = chroma.lab(...color);
                    break;
                default:
                    throw new Error(`Unsupported color space: ${fromSpace}`);
            }
            
            switch (toSpace.toLowerCase()) {
                case 'hex':
                    return chromaColor.hex();
                case 'rgb':
                    return chromaColor.rgb();
                case 'hsl':
                    return chromaColor.hsl();
                case 'hsv':
                    return chromaColor.hsv();
                case 'lab':
                    return chromaColor.lab();
                default:
                    throw new Error(`Unsupported color space: ${toSpace}`);
            }
            
        } catch (error) {
            console.error('🚨 Color conversion failed:', error);
            return null;
        }
    }
    
    // 色温度調整
    adjustTemperature(kelvin) {
        try {
            const tempColor = chroma.temperature(kelvin);
            const mixed = chroma.mix(this.currentColor, tempColor, 0.5, 'lab');
            this.setColor(mixed);
            
            console.log(`🌡️ Color temperature adjusted: ${kelvin}K`);
        } catch (error) {
            console.error('🚨 Temperature adjustment failed:', error);
        }
    }
    
    // ふたば色プリセット適用
    applyFutabaPreset(presetName) {
        const presets = {
            'classic': [this.futabaColors.main, this.futabaColors.sub, this.futabaColors.cream],
            'warm': [this.futabaColors.light, this.futabaColors.pale, this.futabaColors.cream],
            'monochrome': [this.futabaColors.main, this.futabaColors.gray, this.futabaColors.white],
            'vintage': [
                chroma(this.futabaColors.main).darken(0.5).hex(),
                this.futabaColors.sub,
                chroma(this.futabaColors.cream).darken(0.2).hex()
            ]
        };
        
        const preset = presets[presetName];
        if (preset) {
            this.setColor(preset[0]);
            console.log(`🎨 Futaba preset applied: ${presetName}`);
            return preset;
        }
        
        console.warn(`⚠️ Unknown preset: ${presetName}`);
        return null;
    }
    
    // 色の統計情報取得
    getColorStats() {
        return {
            currentColor: this.analyzeColor(),
            historySize: this.currentColorHistory.length,
            customColorCount: this.customColors.length,
            futabaCompatibility: this.checkFutabaCompatibility(),
            readability: this.checkReadability()
        };
    }
    
    // イベント購読設定
    setupEventSubscriptions() {
        // スポイトツールからの色サンプリング
        this.eventStore.on(this.eventStore.eventTypes.COLOR_CHANGE, (data) => {
            if (data.payload.source === 'eyedropper') {
                const color = data.payload.color;
                this.setColor(chroma.rgb(...color.map(c => c * 255)));
            }
        });
        
        // ツール設定変更時の色同期
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CONFIG_CHANGE, (data) => {
            if (data.payload.property === 'color') {
                const color = data.payload.value;
                if (Array.isArray(color)) {
                    this.setColor(chroma.rgb(...color.map(c => c * 255)));
                }
            }
        });
    }
    
    // 色履歴取得
    getColorHistory(limit = 10) {
        return this.currentColorHistory.slice(0, limit).map(hex => ({
            hex,
            rgb: chroma(hex).rgb(),
            hsl: chroma(hex).hsl()
        }));
    }
    
    // カスタム色一覧取得
    getCustomColors() {
        return [...this.customColors];
    }
    
    // ふたば色パレット取得
    getFutabaColorPalette() {
        return Object.entries(this.futabaColors).map(([name, hex]) => ({
            name,
            hex,
            rgb: chroma(hex).rgb(),
            hsl: chroma(hex).hsl()
        }));
    }
    
    // 現在の色情報取得
    getCurrentColorInfo() {
        return {
            ...this.analyzeColor(),
            futabaCompatibility: this.checkFutabaCompatibility(),
            readability: this.checkReadability()
        };
    }
    
    // 色設定をJSON形式でエクスポート
    exportColorSettings() {
        return {
            currentColor: this.currentColor.hex(),
            colorHistory: this.currentColorHistory,
            customColors: this.customColors,
            futabaColors: this.futabaColors,
            timestamp: Date.now()
        };
    }
    
    // 色設定をJSON形式からインポート
    importColorSettings(settingsData) {
        try {
            if (settingsData.currentColor) {
                this.setColor(settingsData.currentColor);
            }
            
            if (settingsData.colorHistory) {
                this.currentColorHistory = settingsData.colorHistory;
            }
            
            if (settingsData.customColors) {
                this.customColors = settingsData.customColors;
            }
            
            console.log('✅ Color settings imported successfully');
            return true;
            
        } catch (error) {
            console.error('🚨 Color settings import failed:', error);
            return false;
        }
    }
    
    // 色の自動調整（AIアシスト的機能）
    autoAdjustColor(targetMood = 'balanced') {
        const currentHsl = this.currentColor.hsl();
        let adjustedColor;
        
        switch (targetMood) {
            case 'warmer':
                // 暖色調整
                adjustedColor = chroma.hsl(
                    (currentHsl[0] + 15) % 360,
                    Math.min(1, currentHsl[1] + 0.1),
                    currentHsl[2]
                );
                break;
                
            case 'cooler':
                // 寒色調整
                adjustedColor = chroma.hsl(
                    (currentHsl[0] - 15 + 360) % 360,
                    Math.min(1, currentHsl[1] + 0.1),
                    currentHsl[2]
                );
                break;
                
            case 'vivid':
                // 鮮やか調整
                adjustedColor = chroma.hsl(
                    currentHsl[0],
                    Math.min(1, currentHsl[1] + 0.2),
                    currentHsl[2]
                );
                break;
                
            case 'muted':
                // 落ち着いた調整
                adjustedColor = chroma.hsl(
                    currentHsl[0],
                    Math.max(0, currentHsl[1] - 0.2),
                    currentHsl[2]
                );
                break;
                
            case 'futaba_optimized':
                // ふたば色最適化
                const compatibility = this.checkFutabaCompatibility();
                if (compatibility.score < 70) {
                    const futabaHsl = chroma(this.futabaColors.main).hsl();
                    adjustedColor = chroma.hsl(
                        futabaHsl[0],
                        (currentHsl[1] + futabaHsl[1]) / 2,
                        currentHsl[2]
                    );
                } else {
                    adjustedColor = this.currentColor;
                }
                break;
                
            default:
                adjustedColor = this.currentColor;
        }
        
        this.setColor(adjustedColor);
        console.log(`🤖 Auto-adjusted color for mood: ${targetMood}`);
        
        return adjustedColor.hex();
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            currentColor: this.currentColor.hex(),
            colorHistory: this.currentColorHistory.length,
            customColors: this.customColors.length,
            futabaColors: Object.keys(this.futabaColors).length,
            stats: this.getColorStats()
        };
    }
    
    // クリーンアップ
    destroy() {
        this.currentColorHistory = [];
        this.customColors = [];
        this.activeColorPicker = null;
        
        console.log('✅ Color processor destroyed');
    }
}