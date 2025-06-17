// ColorProcessor-v2-0.js
class TegakiColorProcessor {
    constructor() {
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 17:04:14';

        // カラースペース変換行列
        this.matrices = {
            rgb2xyz: [
                [0.4124564, 0.3575761, 0.1804375],
                [0.2126729, 0.7151522, 0.0721750],
                [0.0193339, 0.1191920, 0.9503041]
            ],
            xyz2rgb: [
                [ 3.2404542, -1.5371385, -0.4985314],
                [-0.9692660,  1.8760108,  0.0415560],
                [ 0.0556434, -0.2040259,  1.0572252]
            ]
        };

        // カラーキャッシュ
        this.cache = {
            rgb: new Map(),
            hsl: new Map(),
            hsv: new Map(),
            lab: new Map(),
            xyz: new Map(),
            maxSize: 1000
        };

        // カラー処理ワーカー
        this.worker = null;
        this.workerQueue = [];
        this.workerBusy = false;

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Color Processor at ${this.currentTimestamp}`);

        try {
            // ワーカーの初期化
            await this.initializeWorker();

            // キャッシュの初期化
            this.initializeCache();

            console.log('Color Processor initialization completed');

        } catch (error) {
            console.error('Color Processor initialization failed:', error);
            throw error;
        }
    }

    async initializeWorker() {
        try {
            this.worker = new Worker('../Workers/color-worker-v2-0.js');
            
            this.worker.onmessage = (event) => {
                const { type, data } = event.data;
                this.handleWorkerMessage(type, data);
            };

            this.worker.onerror = (error) => {
                console.error('Color Worker error:', error);
                this.worker = null;
            };

        } catch (error) {
            console.warn('Failed to initialize Color Worker:', error);
            this.worker = null;
        }
    }

    initializeCache() {
        for (const key in this.cache) {
            if (key !== 'maxSize') {
                this.cache[key] = new Map();
            }
        }
    }

    // RGB変換
    hexToRgb(hex) {
        const cached = this.cache.rgb.get(hex);
        if (cached) return [...cached];

        hex = hex.replace(/^#/, '');
        
        let r, g, b;
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }

        const rgb = [r, g, b];
        this.cache.rgb.set(hex, rgb);
        return [...rgb];
    }

    rgbToHex(rgb) {
        const key = rgb.join(',');
        const cached = this.cache.rgb.get(key);
        if (cached) return cached;

        const hex = '#' + rgb.map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');

        this.cache.rgb.set(key, hex);
        return hex;
    }

    // HSL変換
    rgbToHsl(rgb) {
        const key = rgb.join(',');
        const cached = this.cache.hsl.get(key);
        if (cached) return [...cached];

        const [r, g, b] = rgb.map(x => x / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        let s = 0;
        let l = (max + min) / 2;

        if (diff !== 0) {
            s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

            switch (max) {
                case r:
                    h = (g - b) / diff + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / diff + 2;
                    break;
                case b:
                    h = (r - g) / diff + 4;
                    break;
            }

            h *= 60;
        }

        const hsl = [h, s, l];
        this.cache.hsl.set(key, hsl);
        return [...hsl];
    }

    hslToRgb(hsl) {
        const key = hsl.join(',');
        const cached = this.cache.rgb.get(key);
        if (cached) return [...cached];

        let [h, s, l] = hsl;
        h = ((h % 360) + 360) % 360;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;

        if (h >= 0 && h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h >= 60 && h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h >= 120 && h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h >= 180 && h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h >= 240 && h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        const rgb = [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];

        this.cache.rgb.set(key, rgb);
        return [...rgb];
    }

    // HSV変換
    rgbToHsv(rgb) {
        const key = rgb.join(',');
        const cached = this.cache.hsv.get(key);
        if (cached) return [...cached];

        const [r, g, b] = rgb.map(x => x / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        const s = max === 0 ? 0 : diff / max;
        const v = max;

        if (diff !== 0) {
            switch (max) {
                case r:
                    h = (g - b) / diff + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / diff + 2;
                    break;
                case b:
                    h = (r - g) / diff + 4;
                    break;
            }
            h *= 60;
        }

        const hsv = [h, s, v];
        this.cache.hsv.set(key, hsv);
        return [...hsv];
    }

    hsvToRgb(hsv) {
        const key = hsv.join(',');
        const cached = this.cache.rgb.get(key);
        if (cached) return [...cached];

        let [h, s, v] = hsv;
        h = ((h % 360) + 360) % 360;

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r, g, b;

        if (h >= 0 && h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h >= 60 && h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h >= 120 && h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h >= 180 && h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h >= 240 && h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        const rgb = [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];

        this.cache.rgb.set(key, rgb);
        return [...rgb];
    }

    // Lab変換
    rgbToLab(rgb) {
        const key = rgb.join(',');
        const cached = this.cache.lab.get(key);
        if (cached) return [...cached];

        const xyz = this.rgbToXyz(rgb);
        const lab = this.xyzToLab(xyz);

        this.cache.lab.set(key, lab);
        return [...lab];
    }

    labToRgb(lab) {
        const key = lab.join(',');
        const cached = this.cache.rgb.get(key);
        if (cached) return [...cached];

        const xyz = this.labToXyz(lab);
        const rgb = this.xyzToRgb(xyz);

        this.cache.rgb.set(key, rgb);
        return [...rgb];
    }

    // XYZ変換
    rgbToXyz(rgb) {
        const key = rgb.join(',');
        const cached = this.cache.xyz.get(key);
        if (cached) return [...cached];

        const [r, g, b] = rgb.map(x => {
            x = x / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });

        const xyz = this.matrices.rgb2xyz.map(row => 
            row[0] * r + row[1] * g + row[2] * b
        );

        this.cache.xyz.set(key, xyz);
        return [...xyz];
    }

    xyzToRgb(xyz) {
        const key = xyz.join(',');
        const cached = this.cache.rgb.get(key);
        if (cached) return [...cached];

        const rgb = this.matrices.xyz2rgb.map(row => {
            let value = row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2];
            value = value <= 0.00304 ? value * 12.92 : 1.055 * Math.pow(value, 1/2.4) - 0.055;
            return Math.round(Math.max(0, Math.min(1, value)) * 255);
        });

        this.cache.rgb.set(key, rgb);
        return [...rgb];
    }

    // Lab⇔XYZ変換
    xyzToLab(xyz) {
        const [x, y, z] = xyz.map((value, i) => {
            const ref = [0.95047, 1.00000, 1.08883][i];
            value = value / ref;
            return value > 0.008856 ? 
                Math.pow(value, 1/3) : 
                (7.787 * value) + (16/116);
        });

        return [
            (116 * y) - 16,
            500 * (x - y),
            200 * (y - z)
        ];
    }

    labToXyz(lab) {
        const [l, a, b] = lab;
        const y = (l + 16) / 116;
        const x = a / 500 + y;
        const z = y - b / 200;

        return [x, y, z].map((value, i) => {
            const cube = Math.pow(value, 3);
            const linear = (value - 16/116) / 7.787;
            const ref = [0.95047, 1.00000, 1.08883][i];
            
            return ref * (cube > 0.008856 ? cube : linear);
        });
    }

    // カラーブレンド
    blend(color1, color2, mode = 'normal', amount = 1) {
        const rgb1 = Array.isArray(color1) ? color1 : this.hexToRgb(color1);
        const rgb2 = Array.isArray(color2) ? color2 : this.hexToRgb(color2);

        let result;
        switch (mode) {
            case 'multiply':
                result = rgb1.map((c, i) => c * rgb2[i] / 255);
                break;
            case 'screen':
                result = rgb1.map((c, i) => 255 - (255 - c) * (255 - rgb2[i]) / 255);
                break;
            case 'overlay':
                result = rgb1.map((c, i) => {
                    return c < 128 ?
                        2 * c * rgb2[i] / 255 :
                        255 - 2 * (255 - c) * (255 - rgb2[i]) / 255;
                });
                break;
            default: // normal
                result = rgb1.map((c, i) => c + (rgb2[i] - c) * amount);
        }

        return result.map(c => Math.round(Math.max(0, Math.min(255, c))));
    }

    // カラーハーモニー
    getComplementary(color) {
        const hsl = Array.isArray(color) ? 
            this.rgbToHsl(color) :
            this.rgbToHsl(this.hexToRgb(color));

        hsl[0] = (hsl[0] + 180) % 360;
        return this.hslToRgb(hsl);
    }

    getAnalogous(color, angle = 30) {
        const hsl = Array.isArray(color) ?
            this.rgbToHsl(color) :
            this.rgbToHsl(this.hexToRgb(color));

        return [
            hsl,
            [((hsl[0] - angle) + 360) % 360, hsl[1], hsl[2]],
            [(hsl[0] + angle) % 360, hsl[1], hsl[2]]
        ].map(h => this.hslToRgb(h));
    }

    getTriadic(color) {
        const hsl = Array.isArray(color) ?
            this.rgbToHsl(color) :
            this.rgbToHsl(this.hexToRgb(color));

        return [
            hsl,
            [(hsl[0] + 120) % 360, hsl[1], hsl[2]],
            [(hsl[0] + 240) % 360, hsl[1], hsl[2]]
        ].map(h => this.hslToRgb(h));
    }

    // ワーカー処理
    processWithWorker(type, data) {
        if (!this.worker || this.workerBusy) {
            this.workerQueue.push({ type, data });
            return;
        }

        this.workerBusy = true;
        this.worker.postMessage({ type, data });
    }

    handleWorkerMessage(type, data) {
        switch (type) {
            case 'blend-complete':
                this.handleBlendComplete(data);
                break;
            case 'harmony-complete':
                this.handleHarmonyComplete(data);
                break;
        }

        this.workerBusy = false;
        if (this.workerQueue.length > 0) {
            const next = this.workerQueue.shift();
            this.processWithWorker(next.type, next.data);
        }
    }

    // リソース解放
    dispose() {
        // ワーカーの終了
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        // キャッシュのクリア
        this.initializeCache();

        // 状態のリセット
        this.matrices = null;
        this.cache = null;
        this.workerQueue = null;
    }
}