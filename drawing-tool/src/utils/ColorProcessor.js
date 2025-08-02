/**
 * 色処理・ふたば色・HSV円形ピッカー統合システム
 * モダンお絵かきツール v3.3 - Phase2色彩管理システム
 * 
 * 機能:
 * - HSV円形ピッカー・色相環・明度彩度制御
 * - ふたば☆ちゃんねるカラーパレット統合
 * - chroma-js活用・色変換・調和色生成
 * - 色履歴・プリセット管理・パレット保存
 * - PixiJS v8統合・EventStore連携・リアルタイム更新
 */

import chroma from 'chroma-js';

/**
 * 色処理・HSVピッカー・ふたば色統合
 * chroma-js活用・高精度色変換・プリセット管理
 */
class ColorProcessor {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // 現在の色状態
        this.currentColor = {
            hex: '#800000',
            rgb: { r: 128, g: 0, b: 0 },
            hsv: { h: 0, s: 100, v: 50 },
            pixi: 0x800000
        };
        
        // ふたば☆ちゃんねるカラーパレット（v3.3拡張版）
        this.futabaColors = {
            maroon: '#800000',          // futaba-maroon
            lightMaroon: '#aa5a56',     // futaba-light-maroon
            medium: '#cf9c97',          // futaba-medium
            lightMedium: '#e9c2ba',     // futaba-light-medium
            cream: '#f0e0d6',           // futaba-cream
            background: '#ffffee',      // futaba-background
            // 追加色
            black: '#000000',
            white: '#ffffff',
            gray: '#808080',
            red: '#ff0000',
            green: '#00ff00',
            blue: '#0000ff',
            yellow: '#ffff00',
            cyan: '#00ffff',
            magenta: '#ff00ff'
        };
        
        // 色履歴管理
        this.colorHistory = [];
        this.maxHistorySize = 20;
        
        // カスタムパレット
        this.customPalettes = {
            user: [],
            recent: [],
            favorites: []
        };
        
        // HSVピッカー設定
        this.pickerSettings = {
            size: 120,
            centerSize: 20,
            borderWidth: 2,
            segments: 360,
            showPreview: true,
            realTimeUpdate: true
        };
        
        // 色変換キャッシュ（パフォーマンス最適化）
        this.conversionCache = new Map();
        this.maxCacheSize = 100;
        
        // プリセット調和色
        this.harmonyTypes = {
            monochromatic: '単色調和',
            analogous: '類似色調和',
            complementary: '補色調和',
            triadic: '三角調和',
            tetradic: '四角調和',
            splitComplementary: '分離補色調和'
        };
        
        this.initializeEventStore();
        this.loadUserSettings();
        
        console.log('✅ ColorProcessor初期化完了 - ふたば色HSV統合');
    }
    
    /**
     * EventStore統合初期化
     * 色選択・変更・履歴イベント連携
     */
    initializeEventStore() {
        // 色選択イベント
        this.eventStore.on('color-selected', (data) => {
            this.setColor(data.color, data.source || 'unknown');
        });
        
        // パレット操作イベント
        this.eventStore.on('palette-color-select', (data) => {
            this.setColorFromPalette(data.colorKey);
        });
        
        // 調和色生成要求
        this.eventStore.on('harmony-colors-request', (data) => {
            this.generateHarmonyColors(data.type);
        });
        
        console.log('🔗 ColorProcessor EventStore統合完了');
    }
    
    /**
     * 色設定（メイン関数）
     * 自動変換・履歴追加・イベント発行
     */
    setColor(color, source = 'manual') {
        try {
            const chromaColor = chroma(color);
            
            // 全形式に変換
            const newColor = {
                hex: chromaColor.hex(),
                rgb: {
                    r: Math.round(chromaColor.get('rgb.r')),
                    g: Math.round(chromaColor.get('rgb.g')),
                    b: Math.round(chromaColor.get('rgb.b'))
                },
                hsv: {
                    h: Math.round(chromaColor.get('hsv.h') || 0),
                    s: Math.round(chromaColor.get('hsv.s') * 100),
                    v: Math.round(chromaColor.get('hsv.v') * 100)
                },
                pixi: parseInt(chromaColor.hex().replace('#', ''), 16)
            };
            
            // 色変更判定
            if (newColor.hex !== this.currentColor.hex) {
                this.currentColor = newColor;
                
                // 履歴追加
                this.addToHistory(newColor, source);
                
                // イベント発行
                this.eventStore.emit('color-changed', {
                    color: newColor,
                    source: source,
                    timestamp: Date.now()
                });
                
                console.log(`🎨 色変更: ${newColor.hex} (${source})`);
            }
            
            return newColor;
            
        } catch (error) {
            console.error('❌ 色設定エラー:', error);
            return this.currentColor;
        }
    }
    
    /**
     * HSV値から色設定
     * HSVピッカー連携専用
     */
    setColorFromHSV(h, s, v) {
        try {
            const chromaColor = chroma.hsv(h, s / 100, v / 100);
            return this.setColor(chromaColor.hex(), 'hsv-picker');
        } catch (error) {
            console.error('❌ HSV色設定エラー:', error);
            return this.currentColor;
        }
    }
    
    /**
     * RGB値から色設定
     */
    setColorFromRGB(r, g, b) {
        try {
            const chromaColor = chroma.rgb(r, g, b);
            return this.setColor(chromaColor.hex(), 'rgb-input');
        } catch (error) {
            console.error('❌ RGB色設定エラー:', error);
            return this.currentColor;
        }
    }
    
    /**
     * ふたばパレットから色設定
     */
    setColorFromPalette(colorKey) {
        const color = this.futabaColors[colorKey];
        if (color) {
            return this.setColor(color, 'futaba-palette');
        } else {
            console.warn(`⚠️ 未知のふたば色: ${colorKey}`);
            return this.currentColor;
        }
    }
    
    /**
     * 色履歴追加
     * 重複除去・サイズ制限・最近使用順
     */
    addToHistory(color, source) {
        // 重複除去
        this.colorHistory = this.colorHistory.filter(
            item => item.color.hex !== color.hex
        );
        
        // 履歴追加（最新を先頭）
        this.colorHistory.unshift({
            color: { ...color },
            source: source,
            timestamp: Date.now()
        });
        
        // サイズ制限
        if (this.colorHistory.length > this.maxHistorySize) {
            this.colorHistory = this.colorHistory.slice(0, this.maxHistorySize);
        }
        
        // 最近使用色パレット更新
        this.updateRecentPalette();
    }
    
    /**
     * 最近使用色パレット更新
     */
    updateRecentPalette() {
        this.customPalettes.recent = this.colorHistory
            .slice(0, 10)
            .map(item => ({
                color: item.color.hex,
                name: `最近 ${item.source}`,
                timestamp: item.timestamp
            }));
    }
    
    /**
     * HSV円形ピッカー用座標変換
     * 角度・距離から色相・彩度・明度計算
     */
    coordinateToHSV(x, y, centerX, centerY, radius) {
        const deltaX = x - centerX;
        const deltaY = y - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 円形範囲外判定
        if (distance > radius) {
            return null;
        }
        
        // 色相計算（角度）
        let hue = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        if (hue < 0) hue += 360;
        
        // 彩度計算（中心からの距離）
        const saturation = Math.min(100, (distance / radius) * 100);
        
        // 明度は現在値維持（別途制御）
        const value = this.currentColor.hsv.v;
        
        return {
            h: Math.round(hue),
            s: Math.round(saturation),
            v: value
        };
    }
    
    /**
     * HSV値から円形座標変換
     * ピッカー表示用座標計算
     */
    hsvToCoordinate(h, s, v, centerX, centerY, radius) {
        const hueRad = (h * Math.PI) / 180;
        const distance = (s / 100) * radius;
        
        return {
            x: centerX + Math.cos(hueRad) * distance,
            y: centerY + Math.sin(hueRad) * distance
        };
    }
    
    /**
     * 調和色生成
     * 色彩理論に基づく調和色セット生成
     */
    generateHarmonyColors(type) {
        const baseColor = chroma(this.currentColor.hex);
        const baseHue = baseColor.get('hsv.h') || 0;
        const baseSat = baseColor.get('hsv.s');
        const baseVal = baseColor.get('hsv.v');
        
        let harmonyColors = [];
        
        switch (type) {
            case 'monochromatic':
                // 単色調和（明度・彩度変化）
                harmonyColors = [
                    chroma.hsv(baseHue, baseSat, Math.min(1, baseVal + 0.3)),
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat, Math.max(0, baseVal - 0.3)),
                    chroma.hsv(baseHue, Math.max(0, baseSat - 0.3), baseVal),
                    chroma.hsv(baseHue, Math.min(1, baseSat + 0.3), baseVal)
                ];
                break;
                
            case 'analogous':
                // 類似色調和（±30度）
                harmonyColors = [
                    chroma.hsv((baseHue - 30 + 360) % 360, baseSat, baseVal),
                    chroma.hsv((baseHue - 15 + 360) % 360, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv((baseHue + 15) % 360, baseSat, baseVal),
                    chroma.hsv((baseHue + 30) % 360, baseSat, baseVal)
                ];
                break;
                
            case 'complementary':
                // 補色調和（180度対面）
                const compHue = (baseHue + 180) % 360;
                harmonyColors = [
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv(compHue, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat * 0.5, baseVal),
                    chroma.hsv(compHue, baseSat * 0.5, baseVal),
                    chroma.hsv(baseHue, baseSat, baseVal * 0.8)
                ];
                break;
                
            case 'triadic':
                // 三角調和（120度間隔）
                harmonyColors = [
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv((baseHue + 120) % 360, baseSat, baseVal),
                    chroma.hsv((baseHue + 240) % 360, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat * 0.7, baseVal),
                    chroma.hsv((baseHue + 120) % 360, baseSat * 0.7, baseVal)
                ];
                break;
                
            case 'tetradic':
                // 四角調和（90度間隔）
                harmonyColors = [
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv((baseHue + 90) % 360, baseSat, baseVal),
                    chroma.hsv((baseHue + 180) % 360, baseSat, baseVal),
                    chroma.hsv((baseHue + 270) % 360, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat * 0.6, baseVal)
                ];
                break;
                
            case 'splitComplementary':
                // 分離補色調和
                const split1 = (baseHue + 150) % 360;
                const split2 = (baseHue + 210) % 360;
                harmonyColors = [
                    chroma.hsv(baseHue, baseSat, baseVal),
                    chroma.hsv(split1, baseSat, baseVal),
                    chroma.hsv(split2, baseSat, baseVal),
                    chroma.hsv(baseHue, baseSat * 0.7, baseVal),
                    chroma.hsv(split1, baseSat * 0.7, baseVal)
                ];
                break;
        }
        
        // 結果をHEX形式に変換
        const hexColors = harmonyColors.map(color => color.hex());
        
        this.eventStore.emit('harmony-colors-generated', {
            type: type,
            baseColor: this.currentColor.hex,
            colors: hexColors,
            timestamp: Date.now()
        });
        
        console.log(`🌈 調和色生成: ${type} - ${hexColors.length}色`);
        return hexColors;
    }
    
    /**
     * 色の明度調整
     */
    adjustBrightness(amount) {
        const currentHsv = this.currentColor.hsv;
        const newValue = Math.max(0, Math.min(100, currentHsv.v + amount));
        
        return this.setColorFromHSV(currentHsv.h, currentHsv.s, newValue);
    }
    
    /**
     * 色の彩度調整
     */
    adjustSaturation(amount) {
        const currentHsv = this.currentColor.hsv;
        const newSaturation = Math.max(0, Math.min(100, currentHsv.s + amount));
        
        return this.setColorFromHSV(currentHsv.h, newSaturation, currentHsv.v);
    }
    
    /**
     * 色の色相調整
     */
    adjustHue(amount) {
        const currentHsv = this.currentColor.hsv;
        const newHue = (currentHsv.h + amount + 360) % 360;
        
        return this.setColorFromHSV(newHue, currentHsv.s, currentHsv.v);
    }
    
    /**
     * 色の近似判定
     * 色抽出時の類似色判定用
     */
    isColorSimilar(color1, color2, threshold = 10) {
        try {
            const chroma1 = chroma(color1);
            const chroma2 = chroma(color2);
            
            const deltaE = chroma.deltaE(chroma1, chroma2);
            return deltaE < threshold;
            
        } catch (error) {
            console.error('❌ 色近似判定エラー:', error);
            return false;
        }
    }
    
    /**
     * ふたば色に最も近い色を取得
     */
    getClosestFutabaColor(targetColor) {
        let closestColor = null;
        let minDistance = Infinity;
        
        try {
            const target = chroma(targetColor);
            
            Object.entries(this.futabaColors).forEach(([key, color]) => {
                const futabaColor = chroma(color);
                const distance = chroma.deltaE(target, futabaColor);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = { key, color, distance };
                }
            });
            
            return closestColor;
            
        } catch (error) {
            console.error('❌ ふたば色近似検索エラー:', error);
            return null;
        }
    }
    
    /**
     * カスタムパレット操作
     */
    addToCustomPalette(paletteName, color, name = null) {
        if (!this.customPalettes[paletteName]) {
            this.customPalettes[paletteName] = [];
        }
        
        const colorData = {
            color: typeof color === 'string' ? color : color.hex,
            name: name || `カスタム ${this.customPalettes[paletteName].length + 1}`,
            timestamp: Date.now()
        };
        
        this.customPalettes[paletteName].push(colorData);
        this.saveUserSettings();
        
        console.log(`🎨 カスタムパレット追加: ${paletteName} - ${colorData.color}`);
    }
    
    /**
     * お気に入り色に追加
     */
    addToFavorites(color = null) {
        const targetColor = color || this.currentColor;
        this.addToCustomPalette('favorites', targetColor, 'お気に入り');
        
        this.eventStore.emit('color-favorited', {
            color: targetColor,
            timestamp: Date.now()
        });
    }
    
    /**
     * HSVピッカー用色相環データ生成
     */
    generateHueRingData() {
        const ringData = [];
        const segments = this.pickerSettings.segments;
        
        for (let i = 0; i < segments; i++) {
            const hue = (i / segments) * 360;
            const color = chroma.hsv(hue, 1, 1);
            
            ringData.push({
                hue: hue,
                color: color.hex(),
                pixi: parseInt(color.hex().replace('#', ''), 16)
            });
        }
        
        return ringData;
    }
    
    /**
     * 明度・彩度グラデーションデータ生成
     */
    generateSaturationValueGradient(hue) {
        const gradientData = [];
        const steps = 20;
        
        for (let s = 0; s <= steps; s++) {
            for (let v = 0; v <= steps; v++) {
                const saturation = s / steps;
                const value = v / steps;
                const color = chroma.hsv(hue, saturation, value);
                
                gradientData.push({
                    s: saturation * 100,
                    v: value * 100,
                    color: color.hex(),
                    pixi: parseInt(color.hex().replace('#', ''), 16)
                });
            }
        }
        
        return gradientData;
    }
    
    /**
     * 色変換キャッシュ管理
     */
    getCachedConversion(input, format) {
        const key = `${input}-${format}`;
        return this.conversionCache.get(key);
    }
    
    setCachedConversion(input, format, result) {
        const key = `${input}-${format}`;
        
        if (this.conversionCache.size >= this.maxCacheSize) {
            // 最古のエントリを削除
            const firstKey = this.conversionCache.keys().next().value;
            this.conversionCache.delete(firstKey);
        }
        
        this.conversionCache.set(key, result);
    }
    
    /**
     * 現在の色取得
     */
    getCurrentColor() {
        return { ...this.currentColor };
    }
    
    /**
     * 色履歴取得
     */
    getColorHistory() {
        return [...this.colorHistory];
    }
    
    /**
     * ふたばカラーパレット取得
     */
    getFutabaColors() {
        return { ...this.futabaColors };
    }
    
    /**
     * カスタムパレット取得
     */
    getCustomPalette(paletteName) {
        return [...(this.customPalettes[paletteName] || [])];
    }
    
    /**
     * 全パレット取得
     */
    getAllPalettes() {
        return {
            futaba: this.getFutabaColors(),
            ...this.customPalettes
        };
    }
    
    /**
     * 調和色タイプ一覧取得
     */
    getHarmonyTypes() {
        return { ...this.harmonyTypes };
    }
    
    /**
     * ピッカー設定取得
     */
    getPickerSettings() {
        return { ...this.pickerSettings };
    }
    
    /**
     * ピッカー設定更新
     */
    updatePickerSettings(newSettings) {
        this.pickerSettings = {
            ...this.pickerSettings,
            ...newSettings
        };
        
        this.saveUserSettings();
    }
    
    /**
     * ユーザー設定保存
     */
    saveUserSettings() {
        try {
            const settings = {
                currentColor: this.currentColor,
                colorHistory: this.colorHistory.slice(0, 10), // 最新10色のみ保存
                customPalettes: this.customPalettes,
                pickerSettings: this.pickerSettings,
                version: '3.3'
            };
            
            localStorage.setItem('color-processor-settings', JSON.stringify(settings));
            console.log('💾 色設定保存完了');
            
        } catch (error) {
            console.error('❌ 色設定保存失敗:', error);
        }
    }
    
    /**
     * ユーザー設定読み込み
     */
    loadUserSettings() {
        try {
            const settingsData = localStorage.getItem('color-processor-settings');
            if (settingsData) {
                const settings = JSON.parse(settingsData);
                
                // 現在の色復元
                if (settings.currentColor) {
                    this.currentColor = settings.currentColor;
                }
                
                // 履歴復元
                if (settings.colorHistory) {
                    this.colorHistory = settings.colorHistory;
                    this.updateRecentPalette();
                }
                
                // カスタムパレット復元
                if (settings.customPalettes) {
                    this.customPalettes = {
                        ...this.customPalettes,
                        ...settings.customPalettes
                    };
                }
                
                // ピッカー設定復元
                if (settings.pickerSettings) {
                    this.pickerSettings = {
                        ...this.pickerSettings,
                        ...settings.pickerSettings
                    };
                }
                
                console.log('📂 色設定読み込み完了');
            }
        } catch (error) {
            console.error('❌ 色設定読み込み失敗:', error);
        }
    }
    
    /**
     * 設定リセット
     */
    resetSettings() {
        this.currentColor = {
            hex: '#800000',
            rgb: { r: 128, g: 0, b: 0 },
            hsv: { h: 0, s: 100, v: 50 },
            pixi: 0x800000
        };
        
        this.colorHistory = [];
        this.customPalettes = { user: [], recent: [], favorites: [] };
        this.pickerSettings = {
            size: 120,
            centerSize: 20,
            borderWidth: 2,
            segments: 360,
            showPreview: true,
            realTimeUpdate: true
        };
        
        this.conversionCache.clear();
        this.saveUserSettings();
        
        console.log('🔄 色設定リセット完了');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            currentColor: this.getCurrentColor(),
            historySize: this.colorHistory.length,
            customPalettes: Object.keys(this.customPalettes).reduce((acc, key) => {
                acc[key] = this.customPalettes[key].length;
                return acc;
            }, {}),
            cacheSize: this.conversionCache.size,
            pickerSettings: this.getPickerSettings()
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 設定保存
        this.saveUserSettings();
        
        // キャッシュクリア
        this.conversionCache.clear();
        
        // 配列クリア
        this.colorHistory = [];
        Object.keys(this.customPalettes).forEach(key => {
            this.customPalettes[key] = [];
        });
        
        console.log('🗑️ ColorProcessor リソース解放完了');
    }
}

export default ColorProcessor;