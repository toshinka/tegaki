// ColorManager-v2-0.js
class TegakiColorManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 08:01:43';
        
        // カラー状態の管理
        this.state = {
            primaryColor: '#000000',
            secondaryColor: '#ffffff',
            backgroundColor: '#ffffff',
            opacity: 1.0,
            blendMode: 'normal'
        };

        // カラーパレット
        this.palettes = new Map();
        this.activePalette = null;

        // カラー履歴
        this.colorHistory = {
            primary: [],
            secondary: [],
            maxSize: 30
        };

        // グラデーション設定
        this.gradients = new Map();

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Color Manager at ${this.currentTimestamp}`);

        try {
            // 基本パレットの初期化
            await this.initializeDefaultPalettes();

            // カスタムパレットの読み込み
            await this.loadCustomPalettes();

            // グラデーションの初期化
            this.initializeGradients();

            console.log('Color Manager initialization completed');

        } catch (error) {
            console.error('Color Manager initialization failed:', error);
            throw error;
        }
    }

    initializeDefaultPalettes() {
        // 基本パレット
        this.palettes.set('basic', {
            name: 'Basic Colors',
            colors: [
                '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
                '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0'
            ]
        });

        // グレースケールパレット
        this.palettes.set('grayscale', {
            name: 'Grayscale',
            colors: Array.from({ length: 11 }, (_, i) => {
                const value = Math.round((i / 10) * 255);
                return `rgb(${value},${value},${value})`;
            })
        });

        // 水彩パレット
        this.palettes.set('watercolor', {
            name: 'Watercolor',
            colors: [
                '#c7dbe6', '#a9c8e3', '#7fa7ce', '#5c88b7',
                '#e6c7c7', '#e3a9a9', '#ce7f7f', '#b75c5c',
                '#c7e6c7', '#a9e3a9', '#7fce7f', '#5cb75c'
            ]
        });

        this.activePalette = 'basic';
    }

    async loadCustomPalettes() {
        try {
            const savedPalettes = localStorage.getItem(
                `tegaki_palettes_${this.currentUser}`
            );

            if (savedPalettes) {
                const customPalettes = JSON.parse(savedPalettes);
                for (const [name, palette] of Object.entries(customPalettes)) {
                    this.palettes.set(name, palette);
                }
            }
        } catch (error) {
            console.error('Error loading custom palettes:', error);
        }
    }

    initializeGradients() {
        // 基本グラデーション
        this.gradients.set('rainbow', {
            name: 'Rainbow',
            stops: [
                { position: 0, color: '#ff0000' },
                { position: 0.17, color: '#ff8000' },
                { position: 0.33, color: '#ffff00' },
                { position: 0.5, color: '#00ff00' },
                { position: 0.67, color: '#0000ff' },
                { position: 0.83, color: '#8000ff' },
                { position: 1, color: '#ff0080' }
            ]
        });

        // モノクログラデーション
        this.gradients.set('monochrome', {
            name: 'Monochrome',
            stops: [
                { position: 0, color: '#ffffff' },
                { position: 1, color: '#000000' }
            ]
        });
    }

    setPrimaryColor(color) {
        this.addToColorHistory('primary', this.state.primaryColor);
        this.state.primaryColor = this.validateColor(color);
        this.notifyColorChange('primary');
    }

    setSecondaryColor(color) {
        this.addToColorHistory('secondary', this.state.secondaryColor);
        this.state.secondaryColor = this.validateColor(color);
        this.notifyColorChange('secondary');
    }

    setBackgroundColor(color) {
        this.state.backgroundColor = this.validateColor(color);
        this.notifyColorChange('background');
    }

    setOpacity(value) {
        this.state.opacity = Math.max(0, Math.min(1, value));
        this.notifyColorChange('opacity');
    }

    setBlendMode(mode) {
        const validModes = [
            'normal', 'multiply', 'screen', 'overlay',
            'darken', 'lighten', 'color-dodge', 'color-burn',
            'hard-light', 'soft-light', 'difference', 'exclusion',
            'hue', 'saturation', 'color', 'luminosity'
        ];

        if (validModes.includes(mode)) {
            this.state.blendMode = mode;
            this.notifyColorChange('blendMode');
        }
    }

    addToColorHistory(type, color) {
        const history = this.colorHistory[type];
        const index = history.indexOf(color);

        if (index !== -1) {
            history.splice(index, 1);
        }

        history.unshift(color);

        if (history.length > this.colorHistory.maxSize) {
            history.pop();
        }
    }

    createCustomPalette(name, colors) {
        if (this.palettes.has(name)) {
            throw new Error(`Palette "${name}" already exists`);
        }

        const palette = {
            name,
            colors: colors.map(color => this.validateColor(color)),
            custom: true,
            created: this.currentTimestamp,
            author: this.currentUser
        };

        this.palettes.set(name, palette);
        this.saveCustomPalettes();

        return palette;
    }

    updateCustomPalette(name, colors) {
        const palette = this.palettes.get(name);
        if (!palette || !palette.custom) {
            throw new Error(`Cannot update non-custom palette "${name}"`);
        }

        palette.colors = colors.map(color => this.validateColor(color));
        palette.modified = this.currentTimestamp;

        this.saveCustomPalettes();
    }

    deleteCustomPalette(name) {
        const palette = this.palettes.get(name);
        if (!palette || !palette.custom) {
            throw new Error(`Cannot delete non-custom palette "${name}"`);
        }

        this.palettes.delete(name);
        this.saveCustomPalettes();

        if (this.activePalette === name) {
            this.activePalette = 'basic';
        }
    }

    saveCustomPalettes() {
        const customPalettes = {};
        for (const [name, palette] of this.palettes.entries()) {
            if (palette.custom) {
                customPalettes[name] = palette;
            }
        }

        localStorage.setItem(
            `tegaki_palettes_${this.currentUser}`,
            JSON.stringify(customPalettes)
        );
    }

    createGradient(name, stops) {
        if (this.gradients.has(name)) {
            throw new Error(`Gradient "${name}" already exists`);
        }

        const gradient = {
            name,
            stops: stops.map(stop => ({
                position: Math.max(0, Math.min(1, stop.position)),
                color: this.validateColor(stop.color)
            })),
            custom: true,
            created: this.currentTimestamp,
            author: this.currentUser
        };

        this.gradients.set(name, gradient);
        return gradient;
    }

    getGradientColors(name, steps = 10) {
        const gradient = this.gradients.get(name);
        if (!gradient) return null;

        const colors = [];
        for (let i = 0; i < steps; i++) {
            const position = i / (steps - 1);
            colors.push(this.interpolateGradient(gradient, position));
        }

        return colors;
    }

    interpolateGradient(gradient, position) {
        const stops = gradient.stops.sort((a, b) => a.position - b.position);
        
        // 範囲外の処理
        if (position <= stops[0].position) return stops[0].color;
        if (position >= stops[stops.length - 1].position) {
            return stops[stops.length - 1].color;
        }

        // 適切な区間を見つける
        let i = 0;
        while (i < stops.length - 1 && position > stops[i + 1].position) {
            i++;
        }

        const start = stops[i];
        const end = stops[i + 1];
        const t = (position - start.position) / 
                 (end.position - start.position);

        return this.interpolateColor(start.color, end.color, t);
    }

    interpolateColor(color1, color2, t) {
        const rgb1 = this.parseColor(color1);
        const rgb2 = this.parseColor(color2);

        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);

        return `rgb(${r},${g},${b})`;
    }

    validateColor(color) {
        // カラー文字列の検証
        if (typeof color !== 'string') {
            throw new Error('Color must be a string');
        }

        // HEX形式の検証
        if (color.startsWith('#')) {
            const hex = color.substring(1);
            if (!/^[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(hex)) {
                throw new Error('Invalid hex color format');
            }
            return color;
        }

        // RGB/RGBA形式の検証
        if (color.startsWith('rgb')) {
            try {
                const rgb = this.parseColor(color);
                return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            } catch {
                throw new Error('Invalid RGB color format');
            }
        }

        throw new Error('Unsupported color format');
    }

    parseColor(color) {
        // HEX形式の解析
        if (color.startsWith('#')) {
            const hex = color.substring(1);
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16)
                };
            }
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16)
            };
        }

        // RGB形式の解析
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }

        throw new Error('Unable to parse color');
    }

    notifyColorChange(type) {
        this.app.config.container.dispatchEvent(new CustomEvent('color-change', {
            detail: {
                type,
                state: this.getState()
            }
        }));
    }

    getState() {
        return {
            ...this.state,
            activePalette: this.activePalette,
            history: {
                primary: [...this.colorHistory.primary],
                secondary: [...this.colorHistory.secondary]
            }
        };
    }

    setState(state) {
        if (!state) return;

        this.state = { ...this.state, ...state };
        this.activePalette = state.activePalette || 'basic';

        if (state.history) {
            this.colorHistory.primary = [...state.history.primary];
            this.colorHistory.secondary = [...state.history.secondary];
        }

        this.notifyColorChange('state');
    }
}