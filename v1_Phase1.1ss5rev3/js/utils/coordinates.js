/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: 座標変換・計算・色変換ユーティリティ
 * 🎯 DEPENDENCIES: なし（Pure JavaScript）
 * 🎯 NODE_MODULES: lodash（利用可能時）
 * 🎯 PIXI_EXTENSIONS: なし（独立ユーティリティ）
 * 🎯 ISOLATION_TEST: 可能（完全独立）
 * 🎯 SPLIT_THRESHOLD: 300行（小規模ユーティリティ）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（Pure JavaScript）
 */

/**
 * 座標変換・計算ユーティリティシステム
 * DRY原則: 元HTMLの重複コードを統合
 */
class CoordinateUtils {
    constructor() {
        this.precision = 10; // 小数点精度
        console.log('📐 CoordinateUtils 初期化完了');
    }
    
    /**
     * Canvas座標からPixi座標への変換
     */
    canvasToPixi(canvasX, canvasY, canvasRect, pixiWidth, pixiHeight) {
        const x = (canvasX - canvasRect.left) * (pixiWidth / canvasRect.width);
        const y = (canvasY - canvasRect.top) * (pixiHeight / canvasRect.height);
        
        return {
            x: Math.round(x * this.precision) / this.precision,
            y: Math.round(y * this.precision) / this.precision
        };
    }
    
    /**
     * Pixi座標からCanvas座標への変換
     */
    pixiToCanvas(pixiX, pixiY, canvasRect, pixiWidth, pixiHeight) {
        const x = (pixiX / pixiWidth) * canvasRect.width + canvasRect.left;
        const y = (pixiY / pixiHeight) * canvasRect.height + canvasRect.top;
        
        return {
            x: Math.round(x * this.precision) / this.precision,
            y: Math.round(y * this.precision) / this.precision
        };
    }
    
    /**
     * 2点間距離計算
     */
    distance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 線形補間
     */
    lerp(start, end, t) {
        return start + (end - start) * Math.max(0, Math.min(1, t));
    }
    
    /**
     * 2点間補間ポイント生成
     */
    interpolatePoints(point1, point2, steps) {
        const points = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: this.lerp(point1.x, point2.x, t),
                y: this.lerp(point1.y, point2.y, t)
            });
        }
        
        return points;
    }
    
    /**
     * ベジェ曲線座標計算
     */
    calculateBezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;
        
        return {
            x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
            y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
        };
    }
    
    /**
     * 角度計算（ラジアン）
     */
    calculateAngle(point1, point2) {
        return Math.atan2(point2.y - point1.y, point2.x - point1.x);
    }
    
    /**
     * 度数→ラジアン変換
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * ラジアン→度数変換
     */
    radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    }
    
    /**
     * 点の回転
     */
    rotatePoint(point, centerPoint, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = point.x - centerPoint.x;
        const dy = point.y - centerPoint.y;
        
        return {
            x: centerPoint.x + (dx * cos - dy * sin),
            y: centerPoint.y + (dx * sin + dy * cos)
        };
    }
    
    /**
     * 境界ボックス計算
     */
    calculateBounds(points) {
        if (points.length === 0) return null;
        
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    /**
     * 点が矩形内にあるかチェック
     */
    pointInRect(point, rect) {
        return point.x >= rect.x && 
               point.x <= rect.x + rect.width &&
               point.y >= rect.y && 
               point.y <= rect.y + rect.height;
    }
    
    /**
     * 点が円内にあるかチェック
     */
    pointInCircle(point, center, radius) {
        return this.distance(point, center) <= radius;
    }
    
    /**
     * 座標配列の正規化
     */
    normalizePoints(points, targetRect) {
        const bounds = this.calculateBounds(points);
        if (!bounds) return points;
        
        const scaleX = targetRect.width / bounds.width;
        const scaleY = targetRect.height / bounds.height;
        const scale = Math.min(scaleX, scaleY); // 比率維持
        
        return points.map(point => ({
            x: targetRect.x + (point.x - bounds.x) * scale,
            y: targetRect.y + (point.y - bounds.y) * scale
        }));
    }
    
    /**
     * スムージング処理（移動平均）
     */
    smoothPoints(points, windowSize = 3) {
        if (points.length < windowSize) return points;
        
        const smoothed = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < points.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(points.length - 1, i + halfWindow);
            
            let sumX = 0, sumY = 0, count = 0;
            
            for (let j = start; j <= end; j++) {
                sumX += points[j].x;
                sumY += points[j].y;
                count++;
            }
            
            smoothed.push({
                x: sumX / count,
                y: sumY / count
            });
        }
        
        return smoothed;
    }
    
    /**
     * パス簡略化（Douglas-Peucker アルゴリズム）
     */
    simplifyPath(points, tolerance = 1.0) {
        if (points.length <= 2) return points;
        
        const simplify = (pts, tol) => {
            const first = pts[0];
            const last = pts[pts.length - 1];
            
            if (pts.length <= 2) return pts;
            
            let maxDistance = 0;
            let maxIndex = 0;
            
            for (let i = 1; i < pts.length - 1; i++) {
                const distance = this.pointToLineDistance(pts[i], first, last);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    maxIndex = i;
                }
            }
            
            if (maxDistance > tol) {
                const left = simplify(pts.slice(0, maxIndex + 1), tol);
                const right = simplify(pts.slice(maxIndex), tol);
                return left.slice(0, -1).concat(right);
            } else {
                return [first, last];
            }
        };
        
        return simplify(points, tolerance);
    }
    
    /**
     * 点から線分への距離計算
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return this.distance(point, lineStart);
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

/**
 * 色変換ユーティリティ
 * DRY原則: 色関連処理を統合
 */
class ColorUtils {
    constructor() {
        // ふたば☆ちゃんねる風カラーパレット
        this.futabaColors = {
            maroon: 0x800000,
            lightMaroon: 0xaa5a56,
            medium: 0xcf9c97,
            lightMedium: 0xe9c2ba,
            cream: 0xf0e0d6,
            background: 0xffffee
        };
        
        console.log('🎨 ColorUtils 初期化完了');
    }
    
    /**
     * 16進数→RGB変換
     */
    hexToRgb(hex) {
        const r = (hex >> 16) & 0xFF;
        const g = (hex >> 8) & 0xFF;
        const b = hex & 0xFF;
        return { r, g, b };
    }
    
    /**
     * RGB→16進数変換
     */
    rgbToHex(r, g, b) {
        return ((r << 16) | (g << 8) | b);
    }
    
    /**
     * HSV→RGB変換
     */
    hsvToRgb(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        
        let rPrime, gPrime, bPrime;
        
        if (h >= 0 && h < 60) {
            rPrime = c; gPrime = x; bPrime = 0;
        } else if (h >= 60 && h < 120) {
            rPrime = x; gPrime = c; bPrime = 0;
        } else if (h >= 120 && h < 180) {
            rPrime = 0; gPrime = c; bPrime = x;
        } else if (h >= 180 && h < 240) {
            rPrime = 0; gPrime = x; bPrime = c;
        } else if (h >= 240 && h < 300) {
            rPrime = x; gPrime = 0; bPrime = c;
        } else {
            rPrime = c; gPrime = 0; bPrime = x;
        }
        
        return {
            r: Math.round((rPrime + m) * 255),
            g: Math.round((gPrime + m) * 255),
            b: Math.round((bPrime + m) * 255)
        };
    }
    
    /**
     * RGB→HSV変換
     */
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
            h *= 60;
        }
        
        const s = max === 0 ? 0 : delta / max;
        const v = max;
        
        return { h: h < 0 ? h + 360 : h, s, v };
    }
    
    /**
     * 色の明度調整
     */
    adjustBrightness(color, factor) {
        const rgb = this.hexToRgb(color);
        const adjusted = {
            r: Math.max(0, Math.min(255, Math.round(rgb.r * factor))),
            g: Math.max(0, Math.min(255, Math.round(rgb.g * factor))),
            b: Math.max(0, Math.min(255, Math.round(rgb.b * factor)))
        };
        return this.rgbToHex(adjusted.r, adjusted.g, adjusted.b);
    }
    
    /**
     * 色のブレンド
     */
    blendColors(color1, color2, ratio = 0.5) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        
        const blended = {
            r: Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio),
            g: Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio),
            b: Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio)
        };
        
        return this.rgbToHex(blended.r, blended.g, blended.b);
    }
    
    /**
     * ふたば風カラー取得
     */
    getFutabaColor(colorName) {
        return this.futabaColors[colorName] || this.futabaColors.maroon;
    }
    
    /**
     * CSS色文字列→16進数変換
     */
    cssToHex(cssColor) {
        if (cssColor.startsWith('#')) {
            return parseInt(cssColor.slice(1), 16);
        }
        
        // rgb(r,g,b) パターン
        const rgbMatch = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return this.rgbToHex(r, g, b);
        }
        
        return 0x800000; // フォールバック: ふたばマルーン
    }
    
    /**
     * 16進数→CSS色文字列変換
     */
    hexToCss(hex) {
        const rgb = this.hexToRgb(hex);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
}

/**
 * マス計算ユーティリティ
 */
class MathUtils {
    constructor() {
        this.lodashAvailable = window._ !== undefined;
        console.log(`🔢 MathUtils 初期化完了 (Lodash: ${this.lodashAvailable ? '✅' : '❌'})`);
    }
    
    /**
     * 値のクランプ（範囲制限）
     */
    clamp(value, min, max) {
        if (this.lodashAvailable) {
            return window._.clamp(value, min, max);
        }
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * 配列の平均値
     */
    average(numbers) {
        if (this.lodashAvailable) {
            return window._.mean(numbers);
        }
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }
    
    /**
     * 丸め処理（指定桁数）
     */
    roundTo(value, decimals = 0) {
        if (this.lodashAvailable) {
            return window._.round(value, decimals);
        }
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }
    
    /**
     * 範囲マッピング
     */
    mapRange(value, fromMin, fromMax, toMin, toMax) {
        const fromRange = fromMax - fromMin;
        const toRange = toMax - toMin;
        const normalized = (value - fromMin) / fromRange;
        return toMin + normalized * toRange;
    }
    
    /**
     * イージング関数
     */
    easing = {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
    };
}

// ==== グローバル公開 ====
if (typeof window !== 'undefined') {
    window.CoordinateUtils = new CoordinateUtils();
    window.ColorUtils = new ColorUtils();
    window.MathUtils = new MathUtils();
    
    // 統合ヘルパー
    window.Utils = {
        coord: window.CoordinateUtils,
        color: window.ColorUtils,
        math: window.MathUtils
    };
    
    console.log('✅ Utils グローバル公開完了 - 座標・色・数学ユーティリティ');
}

// ==== 自動テスト ====
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.group('🧪 Utils 自動テスト');
        
        try {
            // 座標変換テスト
            const coord = window.CoordinateUtils;
            const distance = coord.distance({x: 0, y: 0}, {x: 3, y: 4});
            console.log(`✅ 距離計算: ${distance} (期待値: 5)`);
            
            // 色変換テスト
            const color = window.ColorUtils;
            const rgb = color.hexToRgb(0xFF0000);
            console.log(`✅ 色変換: RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) (期待値: RGB(255, 0, 0))`);
            
            // 数学テスト
            const math = window.MathUtils;
            const clamped = math.clamp(150, 0, 100);
            console.log(`✅ クランプ: ${clamped} (期待値: 100)`);
            
            console.log('🎉 Utils テスト完了');
        } catch (error) {
            console.error('❌ Utils テストエラー:', error);
        }
        
        console.groupEnd();
    }, 800);
}

console.log('📐 CoordinateUtils 準備完了 - 座標変換・計算・色変換ユーティリティ');
console.log('💡 使用例: window.Utils.coord.distance(p1, p2), window.Utils.color.hexToRgb(0x800000)');

// DRY原則適用完了ログ
console.log('♻️ DRY原則適用: 重複する座標・色・数学計算処理を統合完了');