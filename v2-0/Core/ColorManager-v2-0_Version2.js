// ColorManager-v2-0.js
class TegakiCoreColorManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 16:47:16';

        // カラー状態
        this.state = {
            primary: '#000000',
            secondary: '#ffffff',
            background: '#ffffff',
            opacity: 1.0,
            blendMode: 'source-over',
            swatches: [],
            recentColors: [],
            maxRecentColors: 16
        };

        // カラースキーム
        this.colorSchemes = new Map([
            ['monochrome', this.generateMonochromeScheme],
            ['analogous', this.generateAnalogousScheme],
            ['complementary', this.generateComplementaryScheme],
            ['split-complementary', this.generateSplitComplementaryScheme],
            ['triadic', this.generateTriadicScheme],
            ['tetradic', this.generateTetradicScheme]
        ]);

        // カラーパレット
        this.defaultPalette = [
            '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
            '#ffff00', '#ff00ff', '#00ffff', '#808080', '#800000',
            '#008000', '#000080', '#808000', '#800080', '#008080',
            '#c0c0c0'
        ];

        // ColorProcessorのインスタンス
        this.processor = null;

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Color Manager at ${this.currentTimestamp}`);

        try {
            // ColorProcessorの初期化
            this.processor = new TegakiColorProcessor();
            await this.processor.initialize();

            // デフォルトスウォッチの設定
            this.state.swatches = [...this.defaultPalette];

            // 保存されたカラー設定の読み込み
            this.loadSavedColors();

            // イベントリスナーの設定
            this.setupEventListeners();

            console.log('Color Manager initialization completed');

        } catch (error) {
            console.error('Color Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // カラーの変更イベント
        this.app.config.container.addEventListener('tegaki-color-change', (event) => {
            const { type, color } = event.detail;
            this.handleColorChange(type, color);
        });

        // ブレンドモードの変更イベント
        this.app.config.container.addEventListener('tegaki-blend-mode-change', (event) => {
            this.setBlendMode(event.detail.mode);
        });
    }

    handleColorChange(type, color) {
        if (!this.isValidColor(color)) return;

        switch (type) {
            case 'primary':
                this.setPrimaryColor(color);
                break;
            case 'secondary':
                this.setSecondaryColor(color);
                break;
            case 'background':
                this.setBackgroundColor(color);
                break;
        }

        this.addRecentColor(color);
        this.saveColors();
    }

    // カラー操作メソッド
    setPrimaryColor(color) {
        if (this.isValidColor(color)) {
            this.state.primary = this.normalizeColor(color);
            this.notifyColorChange('primary');
        }
    }

    setSecondaryColor(color) {
        if (this.isValidColor(color)) {
            this.state.secondary = this.normalizeColor(color);
            this.notifyColorChange('secondary');
        }
    }

    setBackgroundColor(color) {
        if (this.isValidColor(color)) {
            this.state.background = this.normalizeColor(color);
            this.notifyColorChange('background');
        }
    }

    setOpacity(opacity) {
        this.state.opacity = Math.max(0, Math.min(1, opacity));
        this.notifyColorChange('opacity');
    }

    setBlendMode(mode) {
        const validModes = [
            'source-over', 'multiply', 'screen', 'overlay',
            'darken', 'lighten', 'color-dodge', 'color-burn',
            'hard-light', 'soft-light', 'difference', 'exclusion',
            'hue', 'saturation', 'color', 'luminosity'
        ];

        if (validModes.includes(mode)) {
            this.state.blendMode = mode;
            this.notifyColorChange('blend-mode');
        }
    }

    swapColors() {
        [this.state.primary, this.state.secondary] = 
        [this.state.secondary, this.state.primary];
        
        this.notifyColorChange('swap');
    }

    // スウォッチ操作
    addSwatch(color) {
        if (this.isValidColor(color)) {
            const normalizedColor = this.normalizeColor(color);
            if (!this.state.swatches.includes(normalizedColor)) {
                this.state.swatches.push(normalizedColor);
                this.saveColors();
            }
        }
    }

    removeSwatch(color) {
        const index = this.state.swatches.indexOf(color);
        if (index !== -1) {
            this.state.swatches.splice(index, 1);
            this.saveColors();
        }
    }

    addRecentColor(color) {
        if (this.isValidColor(color)) {
            const normalizedColor = this.normalizeColor(color);
            const index = this.state.recentColors.indexOf(normalizedColor);
            
            if (index !== -1) {
                this.state.recentColors.splice(index, 1);
            }
            
            this.state.recentColors.unshift(normalizedColor);
            
            if (this.state.recentColors.length > this.state.maxRecentColors) {
                this.state.recentColors.pop();
            }
            
            this.saveColors();
        }
    }

    // カラースキーム生成
    generateColorScheme(baseColor, type = 'monochrome', steps = 5) {
        const method = this.colorSchemes.get(type);
        if (method && this.isValidColor(baseColor)) {
            return method.call(this, baseColor, steps);
        }
        return [];
    }

    generateMonochromeScheme(baseColor, steps) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [];

        for (let i = 0; i < steps; i++) {
            const lightness = i / (steps - 1);
            const rgb = this.processor.hslToRgb([hsl[0], hsl[1], lightness]);
            scheme.push(this.processor.rgbToHex(rgb));
        }

        return scheme;
    }

    generateAnalogousScheme(baseColor, steps) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [];
        const hueStep = 30;

        for (let i = -2; i <= 2; i++) {
            const hue = (hsl[0] + i * hueStep + 360) % 360;
            const rgb = this.processor.hslToRgb([hue, hsl[1], hsl[2]]);
            scheme.push(this.processor.rgbToHex(rgb));
        }

        return scheme;
    }

    generateComplementaryScheme(baseColor) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [baseColor];
        
        const complementHue = (hsl[0] + 180) % 360;
        const rgb = this.processor.hslToRgb([complementHue, hsl[1], hsl[2]]);
        scheme.push(this.processor.rgbToHex(rgb));

        return scheme;
    }

    generateSplitComplementaryScheme(baseColor) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [baseColor];
        
        const angle = 150;
        for (let i = -1; i <= 1; i += 2) {
            const hue = (hsl[0] + i * angle + 360) % 360;
            const rgb = this.processor.hslToRgb([hue, hsl[1], hsl[2]]);
            scheme.push(this.processor.rgbToHex(rgb));
        }

        return scheme;
    }

    generateTriadicScheme(baseColor) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [baseColor];
        
        for (let i = 1; i <= 2; i++) {
            const hue = (hsl[0] + i * 120) % 360;
            const rgb = this.processor.hslToRgb([hue, hsl[1], hsl[2]]);
            scheme.push(this.processor.rgbToHex(rgb));
        }

        return scheme;
    }

    generateTetradicScheme(baseColor) {
        const hsl = this.processor.rgbToHsl(this.processor.hexToRgb(baseColor));
        const scheme = [baseColor];
        
        for (let i = 1; i <= 3; i++) {
            const hue = (hsl[0] + i * 90) % 360;
            const rgb = this.processor.hslToRgb([hue, hsl[1], hsl[2]]);
            scheme.push(this.processor.rgbToHex(rgb));
        }

        return scheme;
    }

    // カラーユーティリティ
    isValidColor(color) {
        if (typeof color !== 'string') return false;
        
        // Hex color validation
        if (color.startsWith('#')) {
            return /^#([A-Fa-f0-9]{3}){1,2}$/.test(color);
        }
        
        // RGB/RGBA color validation
        if (color.startsWith('rgb')) {
            return /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/.test(color);
        }
        
        // HSL/HSLA color validation
        if (color.startsWith('hsl')) {
            return /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[\d.]+\s*)?\)$/.test(color);
        }
        
        return false;
    }

    normalizeColor(color) {
        if (!this.isValidColor(color)) return '#000000';

        if (color.startsWith('#')) {
            return color.length === 4 ?
                `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` :
                color;
        }

        // RGB/RGBA to Hex
        if (color.startsWith('rgb')) {
            const rgb = color.match(/\d+/g).map(Number);
            return this.processor.rgbToHex(rgb);
        }

        // HSL/HSLA to Hex
        if (color.startsWith('hsl')) {
            const [h, s, l] = color.match(/\d+/g).map(Number);
            const rgb = this.processor.hslToRgb([h, s / 100, l / 100]);
            return this.processor.rgbToHex(rgb);
        }

        return color;
    }

    // 永続化
    saveColors() {
        const data = {
            primary: this.state.primary,
            secondary: this.state.secondary,
            background: this.state.background,
            swatches: this.state.swatches,
            recentColors: this.state.recentColors
        };

        try {
            localStorage.setItem('tegaki-colors', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save color settings:', error);
        }
    }

    loadSavedColors() {
        try {
            const saved = localStorage.getItem('tegaki-colors');
            if (saved) {
                const data = JSON.parse(saved);
                Object.assign(this.state, data);
            }
        } catch (error) {
            console.warn('Failed to load color settings:', error);
        }
    }

    // イベント通知
    notifyColorChange(type) {
        this.app.config.container.dispatchEvent(new CustomEvent('tegaki-color-updated', {
            detail: {
                type,
                state: { ...this.state }
            }
        }));
    }

    // 状態管理
    getState() {
        return { ...this.state };
    }

    setState(state) {
        if (!state) return;
        
        Object.assign(this.state, state);
        this.notifyColorChange('state');
    }

    // リソース解放
    dispose() {
        this.saveColors();
        
        // プロセッサーの解放
        if (this.processor?.dispose) {
            this.processor.dispose();
        }

        // 状態のリセット
        this.state = null;
        this.processor = null;
        this.colorSchemes = null;
    }
}