// ColorProcessor.js - ふたば色・色処理統合（Phase2・封印解除時実装）

import chroma from 'chroma-js';

/**
 * 🌈 ふたば色・色処理統合（Phase2・封印解除時実装）
 * 責務: ChromaColorController詳細、ふたば☆ちゃんねるカラーパレット実装、色変換・最適化・履歴管理
 */
export class ColorProcessor {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        
        // 色状態管理
        this.currentColor = [0.5, 0.0, 0.0, 1.0]; // デフォルト: ふたばマルーン
        this.previousColor = null;
        this.colorHistory = [];
        this.maxHistorySize = 20;
        
        // ふたば☆ちゃんねるカラーパレット
        this.futabaColorPalette = this.initializeFutabaColors();
        this.customColors = [];
        
        // カラーピッカー状態
        this.colorPickerActive = false;
        this.colorPickerElement = null;
        
        // Chroma.js設定
        this.chromaScale = null;
        this.harmonicColors = [];
        
        console.log('✅ ColorProcessor初期化完了');
    }
    
    /**
     * ふたば☆ちゃんねる色初期化
     */
    initializeFutabaColors() {
        const futabaColors = {
            // メイン系統
            main: [
                { name: 'マルーン', hex: '#800000', rgb: [0.5, 0.0, 0.0, 1.0], primary: true },
                { name: '薄いマルーン', hex: '#aa5a56', rgb: [0.667, 0.353, 0.337, 1.0] },
                { name: '中間色', hex: '#cf9c97', rgb: [0.812, 0.612, 0.592, 1.0] },
                { name: '薄いピンクベージュ', hex: '#e9c2ba', rgb: [0.914, 0.761, 0.729, 1.0] },
                { name: 'クリーム', hex: '#f0e0d6', rgb: [0.941, 0.878, 0.839, 1.0] },
                { name: '背景色', hex: '#ffffee', rgb: [1.0, 1.0, 0.933, 1.0] }
            ],
            
            // 基本拡張色
            basic: [
                { name: '黒', hex: '#000000', rgb: [0.0, 0.0, 0.0, 1.0] },
                { name: '白', hex: '#ffffff', rgb: [1.0, 1.0, 1.0, 1.0] },
                { name: '赤', hex: '#ff0000', rgb: [1.0, 0.0, 0.0, 1.0] },
                { name: '緑', hex: '#00ff00', rgb: [0.0, 1.0, 0.0, 1.0] },
                { name: '青', hex: '#0000ff', rgb: [0.0, 0.0, 1.0, 1.0] },
                { name: '黄', hex: '#ffff00', rgb: [1.0, 1.0, 0.0, 1.0] },
                { name: 'マゼンタ', hex: '#ff00ff', rgb: [1.0, 0.0, 1.0, 1.0] },
                { name: 'シアン', hex: '#00ffff', rgb: [0.0, 1.0, 1.0, 1.0] },
                { name: 'グレー', hex: '#808080', rgb: [0.5, 0.5, 0.5, 1.0] },
                { name: 'ダークグレー', hex: '#404040', rgb: [0.25, 0.25, 0.25, 1.0] }
            ],
            
            // ふたば特色
            special: [
                { name: 'としあき色', hex: '#117743', rgb: [0.067, 0.467, 0.263, 1.0] },
                { name: 'レス番色', hex: '#cc1105', rgb: [0.8, 0.067, 0.02, 1.0] },
                { name: 'リンク色', hex: '#0000ee', rgb: [0.0, 0.0, 0.933, 1.0] },
                { name: '訪問済み', hex: '#551a8b', rgb: [0.333, 0.102, 0.545, 1.0] }
            ]
        };
        
        console.log('🌈 ふたば☆ちゃんねる色パレット初期化完了');
        return futabaColors;
    }
    
    /**
     * イベント購読開始
     */
    subscribeToEvents() {
        // 色変更イベント
        this.eventStore.on('color:change', this.handleColorChange.bind(this), 'color-processor');
        this.eventStore.on('color:sampled', this.handleColorSampled.bind(this), 'color-processor');
        
        // カラーピッカーイベント
        this.eventStore.on('color:picker:show', this.showColorPicker.bind(this), 'color-processor');
        this.eventStore.on('color:picker:hide', this.hideColorPicker.bind(this), 'color-processor');
        
        console.log('📝 色処理イベント購読開始');
    }
    
    /**
     * 現在の色設定
     */
    setCurrentColor(color, format = 'rgb') {
        // 色形式変換
        const rgbColor = this.convertColorToRGB(color, format);
        if (!rgbColor) return false;
        
        // 前の色を保存
        this.previousColor = [...this.currentColor];
        this.currentColor = rgbColor;
        
        // 履歴に追加
        this.addToColorHistory(rgbColor);
        
        // エンジンに色設定を反映
        this.updateEngineColor(rgbColor);
        
        // イベント発火
        this.eventStore.emit('color:changed', {
            color: rgbColor,
            hex: this.rgbToHex(rgbColor),
            previousColor: this.previousColor
        });
        
        console.log('🎨 色設定変更:', this.rgbToHex(rgbColor));
        return true;
    }
    
    /**
     * 色形式変換（RGB統一）
     */
    convertColorToRGB(color, format) {
        try {
            let chromaColor;
            
            switch (format) {
                case 'hex':
                    chromaColor = chroma(color);
                    break;
                case 'hsl':
                    chromaColor = chroma(color, 'hsl');
                    break;
                case 'hsv':
                    chromaColor = chroma(color, 'hsv');
                    break;
                case 'rgb':
                default:
                    if (Array.isArray(color)) {
                        // [r, g, b, a] または [r, g, b] 形式
                        const [r, g, b, a = 1.0] = color;
                        return [r, g, b, a];
                    } else if (typeof color === 'string') {
                        chromaColor = chroma(color);
                    } else {
                        return null;
                    }
            }
            
            if (chromaColor) {
                const [r, g, b] = chromaColor.rgb();
                return [r / 255, g / 255, b / 255, 1.0];
            }
            
            return null;
            
        } catch (error) {
            console.warn('🚨 色変換エラー:', error);
            return null;
        }
    }
    
    /**
     * RGB → HEX変換
     */
    rgbToHex(rgbColor) {
        const [r, g, b] = rgbColor;
        const red = Math.round(r * 255);
        const green = Math.round(g * 255);
        const blue = Math.round(b * 255);
        
        return chroma.rgb(red, green, blue).hex();
    }
    
    /**
     * エンジン色設定更新
     */
    updateEngineColor(rgbColor) {
        // 現在のツールに色を反映
        const currentTool = this.engine.currentTool;
        if (currentTool && this.engine.toolConfig[currentTool]) {
            this.engine.toolConfig[currentTool].color = [...rgbColor];
        }
    }
    
    /**
     * 色履歴追加
     */
    addToColorHistory(color) {
        // 重複除去
        const hexColor = this.rgbToHex(color);
        this.colorHistory = this.colorHistory.filter(
            historyColor => this.rgbToHex(historyColor) !== hexColor
        );
        
        // 最新色を先頭に追加
        this.colorHistory.unshift([...color]);
        
        // 履歴サイズ制限
        if (this.colorHistory.length > this.maxHistorySize) {
            this.colorHistory = this.colorHistory.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * ふたば色パレット取得
     */
    getFutabaColorPalette() {
        return this.futabaColorPalette;
    }
    
    /**
     * 調和色生成
     */
    generateHarmonicColors(baseColor, scheme = 'complementary') {
        try {
            const chromaColor = chroma.rgb(
                baseColor[0] * 255,
                baseColor[1] * 255,
                baseColor[2] * 255
            );
            
            let harmonicColors = [];
            
            switch (scheme) {
                case 'complementary':
                    // 補色
                    harmonicColors = [
                        chromaColor,
                        chromaColor.set('hsl.h', '+180')
                    ];
                    break;
                    
                case 'triadic':
                    // 三角配色
                    harmonicColors = [
                        chromaColor,
                        chromaColor.set('hsl.h', '+120'),
                        chromaColor.set('hsl.h', '+240')
                    ];
                    break;
                    
                case 'analogous':
                    // 類似色
                    harmonicColors = [
                        chromaColor.set('hsl.h', '-30'),
                        chromaColor,
                        chromaColor.set('hsl.h', '+30')
                    ];
                    break;
                    
                case 'monochromatic':
                    // 単色の明度違い
                    harmonicColors = [
                        chromaColor.brighten(1),
                        chromaColor,
                        chromaColor.darken(1),
                        chromaColor.darken(2)
                    ];
                    break;
                    
                case 'tetradic':
                    // 四角配色
                    harmonicColors = [
                        chromaColor,
                        chromaColor.set('hsl.h', '+90'),
                        chromaColor.set('hsl.h', '+180'),
                        chromaColor.set('hsl.h', '+270')
                    ];
                    break;
                    
                default:
                    harmonicColors = [chromaColor];
            }
            
            // RGB形式に変換
            this.harmonicColors = harmonicColors.map(color => {
                const [r, g, b] = color.rgb();
                return [r / 255, g / 255, b / 255, 1.0];
            });
            
            console.log(`🌈 調和色生成完了: ${scheme}`, this.harmonicColors.length + '色');
            return this.harmonicColors;
            
        } catch (error) {
            console.warn('🚨 調和色生成エラー:', error);
            return [baseColor];
        }
    }
    
    /**
     * グラデーション生成
     */
    generateGradient(startColor, endColor, steps = 10) {
        try {
            const startChroma = chroma.rgb(
                startColor[0] * 255,
                startColor[1] * 255,
                startColor[2] * 255
            );
            
            const endChroma = chroma.rgb(
                endColor[0] * 255,
                endColor[1] * 255,
                endColor[2] * 255
            );
            
            const scale = chroma.scale([startChroma, endChroma]).mode('rgb');
            const gradient = [];
            
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const color = scale(t);
                const [r, g, b] = color.rgb();
                gradient.push([r / 255, g / 255, b / 255, 1.0]);
            }
            
            console.log(`🌈 グラデーション生成完了: ${steps}段階`);
            return gradient;
            
        } catch (error) {
            console.warn('🚨 グラデーション生成エラー:', error);
            return [startColor, endColor];
        }
    }
    
    /**
     * 色変更イベント処理
     */
    handleColorChange(eventData) {
        const { color, format = 'rgb' } = eventData.payload;
        this.setCurrentColor(color, format);
    }
    
    /**
     * 色サンプリングイベント処理
     */
    handleColorSampled(eventData) {
        const { color } = eventData.payload;
        this.setCurrentColor(color, 'rgb');
        
        console.log('💧 色サンプリング受信:', this.rgbToHex(color));
    }
    
    /**
     * カラーピッカー表示
     */
    showColorPicker(eventData) {
        if (this.colorPickerActive) return;
        
        const { position } = eventData.payload;
        this.colorPickerElement = this.createColorPickerUI(position);
        this.colorPickerActive = true;
        
        console.log('🎨 カラーピッカー表示');
    }
    
    /**
     * カラーピッカーUI作成
     */
    createColorPickerUI(position = { x: 100, y: 100 }) {
        const picker = document.createElement('div');
        picker.className = 'color-picker';
        picker.style.cssText = `
            position: fixed;
            left: ${position.x}px;
            top: ${position.y}px;
            width: 320px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(170, 90, 86, 0.3);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
            backdrop-filter: blur(10px);
            z-index: 2000;
            font-family: 'Segoe UI', system-ui, sans-serif;
        `;
        
        // ヘッダー
        const header = document.createElement('div');
        header.innerHTML = '🎨 カラーピッカー';
        header.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #800000;
            margin-bottom: 16px;
            text-align: center;
        `;
        picker.appendChild(header);
        
        // ふたばカラーパレット
        const futabaSection = this.createFutabaColorSection();
        picker.appendChild(futabaSection);
        
        // HSVカラーホイール（簡易版）
        const hsvSection = this.createHSVColorSection();
        picker.appendChild(hsvSection);
        
        // 色履歴
        const historySection = this.createColorHistorySection();
        picker.appendChild(historySection);
        
        // 閉じるボタン
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            border: none;
            background: none;
            color: #aa5a56;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        `;
        closeButton.addEventListener('click', () => this.hideColorPicker());
        picker.appendChild(closeButton);
        
        // ドキュメントに追加
        document.body.appendChild(picker);
        
        return picker;
    }
    
    /**
     * ふたばカラーセクション作成
     */
    createFutabaColorSection() {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 16px;
        `;
        
        const title = document.createElement('div');
        title.textContent = 'ふたば☆ちゃんねる色';
        title.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #800000;
            margin-bottom: 8px;
        `;
        section.appendChild(title);
        
        // メイン色グループ
        const mainGroup = this.createColorGroup(this.futabaColorPalette.main, 'メイン');
        section.appendChild(mainGroup);
        
        // 基本色グループ
        const basicGroup = this.createColorGroup(this.futabaColorPalette.basic, '基本');
        section.appendChild(basicGroup);
        
        // 特色グループ
        const specialGroup = this.createColorGroup(this.futabaColorPalette.special, '特色');
        section.appendChild(specialGroup);
        
        return section;
    }
    
    /**
     * 色グループ作成
     */
    createColorGroup(colors, groupName) {
        const group = document.createElement('div');
        group.style.cssText = `
            margin-bottom: 8px;
        `;
        
        const label = document.createElement('div');
        label.textContent = groupName;
        label.style.cssText = `
            font-size: 10px;
            color: #aa5a56;
            margin-bottom: 4px;
        `;
        group.appendChild(label);
        
        const colorRow = document.createElement('div');
        colorRow.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        `;
        
        colors.forEach(colorInfo => {
            const colorSwatch = document.createElement('div');
            colorSwatch.style.cssText = `
                width: 24px;
                height: 24px;
                background: ${colorInfo.hex};
                border: 1px solid rgba(128, 0, 0, 0.3);
                border-radius: 4px;
                cursor: pointer;
                transition: transform 0.2s ease;
                position: relative;
            `;
            
            // プライマリ色のマーク
            if (colorInfo.primary) {
                colorSwatch.style.border = '2px solid #800000';
                colorSwatch.style.boxShadow = '0 0 4px rgba(128, 0, 0, 0.5)';
            }
            
            // ホバー効果
            colorSwatch.addEventListener('mouseenter', () => {
                colorSwatch.style.transform = 'scale(1.1)';
                colorSwatch.title = `${colorInfo.name} (${colorInfo.hex})`;
            });
            
            colorSwatch.addEventListener('mouseleave', () => {
                colorSwatch.style.transform = 'scale(1)';
            });
            
            // クリックで色選択
            colorSwatch.addEventListener('click', () => {
                this.setCurrentColor(colorInfo.rgb, 'rgb');
                this.hideColorPicker();
            });
            
            colorRow.appendChild(colorSwatch);
        });
        
        group.appendChild(colorRow);
        return group;
    }
    
    /**
     * HSVカラーセクション作成（簡易版）
     */
    createHSVColorSection() {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 16px;
        `;
        
        const title = document.createElement('div');
        title.textContent = 'カスタム色';
        title.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #800000;
            margin-bottom: 8px;
        `;
        section.appendChild(title);
        
        // 色相スライダー
        const hueSlider = this.createColorSlider('色相', 0, 360, 0, (value) => {
            this.updateHSVColor('h', value);
        });
        section.appendChild(hueSlider);
        
        // 彩度スライダー
        const satSlider = this.createColorSlider('彩度', 0, 100, 50, (value) => {
            this.updateHSVColor('s', value / 100);
        });
        section.appendChild(satSlider);
        
        // 明度スライダー
        const valSlider = this.createColorSlider('明度', 0, 100, 50, (value) => {
            this.updateHSVColor('v', value / 100);
        });
        section.appendChild(valSlider);
        
        return section;
    }
    
    /**
     * カラースライダー作成
     */
    createColorSlider(label, min, max, defaultValue, onChange) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 8px;
        `;
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-size: 10px;
            color: #aa5a56;
            margin-bottom: 4px;
        `;
        container.appendChild(labelEl);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.value = defaultValue;
        slider.style.cssText = `
            width: 100%;
            height: 4px;
            background: linear-gradient(to right, #f0f0f0, #aa5a56);
            border-radius: 2px;
            outline: none;
            -webkit-appearance: none;
        `;
        
        slider.addEventListener('input', (e) => {
            onChange(parseFloat(e.target.value));
        });
        
        container.appendChild(slider);
        return container;
    }
    
    /**
     * HSV色更新
     */
    updateHSVColor(component, value) {
        // 簡易HSV実装（実際の製品では完全なHSVピッカーを実装）
        const currentHex = this.rgbToHex(this.currentColor);
        const chromaColor = chroma(currentHex);
        
        try {
            let newColor;
            switch (component) {
                case 'h':
                    newColor = chromaColor.set('hsl.h', value);
                    break;
                case 's':
                    newColor = chromaColor.set('hsl.s', value);
                    break;
                case 'v':
                    newColor = chromaColor.set('hsl.l', value);
                    break;
            }
            
            if (newColor) {
                const [r, g, b] = newColor.rgb();
                this.setCurrentColor([r / 255, g / 255, b / 255, 1.0], 'rgb');
            }
        } catch (error) {
            console.warn('🚨 HSV色更新エラー:', error);
        }
    }
    
    /**
     * 色履歴セクション作成
     */
    createColorHistorySection() {
        const section = document.createElement('div');
        
        const title = document.createElement('div');
        title.textContent = '最近使った色';
        title.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #800000;
            margin-bottom: 8px;
        `;
        section.appendChild(title);
        
        const historyRow = document.createElement('div');
        historyRow.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        `;
        
        this.colorHistory.slice(0, 10).forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `
                width: 20px;
                height: 20px;
                background: ${this.rgbToHex(color)};
                border: 1px solid rgba(128, 0, 0, 0.3);
                border-radius: 3px;
                cursor: pointer;
                transition: transform 0.2s ease;
            `;
            
            swatch.addEventListener('mouseenter', () => {
                swatch.style.transform = 'scale(1.1)';
            });
            
            swatch.addEventListener('mouseleave', () => {
                swatch.style.transform = 'scale(1)';
            });
            
            swatch.addEventListener('click', () => {
                this.setCurrentColor(color, 'rgb');
                this.hideColorPicker();
            });
            
            historyRow.appendChild(swatch);
        });
        
        section.appendChild(historyRow);
        return section;
    }
    
    /**
     * カラーピッカー非表示
     */
    hideColorPicker() {
        if (this.colorPickerElement) {
            this.colorPickerElement.remove();
            this.colorPickerElement = null;
            this.colorPickerActive = false;
            
            console.log('🎨 カラーピッカー非表示');
        }
    }
    
    /**
     * 現在の色情報取得
     */
    getCurrentColorInfo() {
        return {
            rgb: this.currentColor,
            hex: this.rgbToHex(this.currentColor),
            previousColor: this.previousColor,
            harmonicColors: this.harmonicColors,
            historyCount: this.colorHistory.length
        };
    }
    
    /**
     * 色処理状態取得
     */
    getColorProcessorState() {
        return {
            currentColor: this.getCurrentColorInfo(),
            futabaColorsLoaded: !!this.futabaColorPalette,
            colorHistorySize: this.colorHistory.length,
            customColorsCount: this.customColors.length,
            colorPickerActive: this.colorPickerActive,
            harmonicColorsCount: this.harmonicColors.length
        };
    }
}