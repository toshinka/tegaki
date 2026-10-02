/**
 * Airbrush固有のspacing、dab配置、texture cacheを管理する。
 * stroke lifecycle、RenderTextureへの焼き込み、History、Layer / CAFは所有しない。
 */

import { lerpNibAngle } from './nib-angle.js';
import { Container, Sprite, Texture } from 'pixi.js';

const AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO = 0.18;
const MIN_PRESSURE_DAB = 0.02;
const DAB_TEXTURE_SIZE = 256;
const MAX_POOLED_DAB_SPRITES = 4096;
const MAX_CACHED_DAB_TEXTURES = 40;
const MIN_PEN_DAB_SPACING = 0.35;
const AIRBRUSH_TILT_STRETCH = 0.6;
const AIRBRUSH_TILT_SHIFT = 0.25;
const PEN_TILT_WIDEN = 1.0;
// falloff(σ=0.3)で被覆50%になる位置は減衰帯の外端から約0.65帯幅。AA時の径補正に使う。
const PEN_AA_HALF_COVERAGE_OFFSET = 0.65;
const DAB_FALLOFF_SIGMA = 0.3;
// 角dab: 外周1texelを透明にした白い四角(縁のAA用)。spriteは(全体/中身)倍して中身が指定径になるようにする。
const SQUARE_TEXTURE_CORE = 32;
const SQUARE_TEXTURE_SIZE = SQUARE_TEXTURE_CORE + 2;
const SQUARE_TEXTURE_SCALE = SQUARE_TEXTURE_SIZE / SQUARE_TEXTURE_CORE;

export class AirbrushDabRenderer {
    constructor(options = {}) {
        this.calculateWidth = options.calculateWidth || ((pressure, size) => size * pressure);
        this.calculateOpacity = options.calculateOpacity || ((pressure, opacity) => opacity);
        this.random = options.random || Math.random;
        // softness / 生成方式ごとのdab texture。airbrushとpen dabが交互に使っても再生成しない。
        this.textures = new Map();
        // segmentごとのContainer / Sprite生成を避けるため、描画後に再利用する。
        this.segmentContainer = null;
        this.spritePool = [];
        this.pooledDabCount = 0;
    }

    /**
     * @param {Container|null} [target] - 同一event内の複数区間を1回のrenderへまとめる時、前回の戻り値を渡すとdabを追記する。
     */
    renderSegment(points, settings, state = {}, target = null) {
        if (!points || points.length < 1) return target;

        const container = target || this._acquireContainer();
        const isPenDab = settings.dabMode === 'pen';
        const texture = isPenDab && settings.penTipShape === 'square'
            ? this._getSquareTexture()
            : this._getTexture(isPenDab
                ? this._getPenDabEffectiveSoftness(points, settings)
                : settings.airbrushSoftness);
        const addDab = isPenDab ? this._addPenDab : this._addDab;

        if (points.length === 1) {
            const point = points[0];
            addDab.call(this, container, texture, point.x, point.y, point.pressure ?? 1, settings, point.widthScale ?? 1, point.nibAngle);
            state.initialized = true;
            state.nextDistance = this.getSpacing(settings, point, point);
            return container.children.length > 0 ? container : null;
        }

        const start = points[0];
        const end = points[points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= 0) {
            addDab.call(this, container, texture, end.x, end.y, end.pressure ?? 1, settings, end.widthScale ?? 1, end.nibAngle);
            return container.children.length > 0 ? container : null;
        }

        const spacing = this.getSpacing(settings, start, end);
        let nextDistance;

        if (!state.initialized) {
            nextDistance = 0;
            state.initialized = true;
        } else {
            nextDistance = state.nextDistance ?? spacing;
        }

        while (nextDistance <= distance) {
            const t = nextDistance / distance;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const pressure = (start.pressure ?? 1)
                + (((end.pressure ?? 1) - (start.pressure ?? 1)) * t);
            // 入り抜き(taper)の径倍率も区間内で補間する。
            const widthScale = (start.widthScale ?? 1) + (((end.widthScale ?? 1) - (start.widthScale ?? 1)) * t);

            const nibAngle = Number.isFinite(start.nibAngle) && Number.isFinite(end.nibAngle)
                ? lerpNibAngle(start.nibAngle, end.nibAngle, t)
                : undefined;
            addDab.call(this, container, texture, x, y, pressure, settings, widthScale, nibAngle);
            nextDistance += spacing;
        }

        state.nextDistance = nextDistance - distance;
        return container.children.length > 0 ? container : null;
    }

    getSpacing(settings, start = null, end = null) {
        if (settings.dabMode === 'pen') {
            // 筆圧で細くなった区間でも隙間が出ないよう、区間内の細い側の径でspacingを決める。
            const pressure = Math.min(start?.pressure ?? 1, end?.pressure ?? 1);
            const widthScale = Math.min(start?.widthScale ?? 1, end?.widthScale ?? 1);
            const width = this._getPenDabWidth(pressure, settings) * widthScale;
            const ratio = settings.penDabSpacingRatio ?? 0.05;
            return Math.max(MIN_PEN_DAB_SPACING, width * ratio);
        }
        const size = Math.max(1, settings.size || 1);
        const ratio = settings.airbrushSpacingRatio ?? 0.1;
        return Math.max(0.5, size * ratio);
    }

    _addDab(container, texture, x, y, pressure, settings) {
        const rawPressure = Math.max(MIN_PRESSURE_DAB, Math.min(1, pressure ?? 1));
        if (settings.pressureEnabled === true && (pressure ?? 0) <= MIN_PRESSURE_DAB) {
            return;
        }

        const baseFlow = this._getSpacingAdjustedFlow(settings);
        const pressureFactor = settings.pressureEnabled === true ? rawPressure : 1.0;

        // エアブラシ案B: 筆圧を濃度(flow/alpha)へ反映し、サイズ極小化を防止する。
        // サイズ変化は 75%~100% の穏やかな範囲に抑え、フワッとしたグラデーションの重なりを維持する。
        const sizeScale = settings.pressureEnabled === true ? (0.75 + 0.25 * pressureFactor) : 1.0;
        const baseSize = settings.size * sizeScale;

        const scatter = settings.airbrushScatter ?? 0;
        const isErase = settings.mode === 'airbrush-erase' || settings.mode === 'eraser';
        const sprite = this._acquireSprite(container, texture);

        let dabX = x;
        let dabY = y;
        if (scatter > 0) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.random() * baseSize * scatter * 0.2;
            dabX = x + Math.cos(angle) * distance;
            dabY = y + Math.sin(angle) * distance;
        }

        // ペンの傾き: dabを傾き方向へ伸ばした楕円にし、ペン先側へずらす(エアブラシの噴射円錐)。
        const tilt = settings.dabTilt;
        if (tilt && tilt.amount > 0) {
            const shift = baseSize * AIRBRUSH_TILT_SHIFT * tilt.amount;
            dabX += Math.cos(tilt.angle) * shift;
            dabY += Math.sin(tilt.angle) * shift;
            sprite.rotation = tilt.angle;
        } else {
            sprite.rotation = 0;
        }
        sprite.position.set(dabX, dabY);
        sprite.width = baseSize * (1 + AIRBRUSH_TILT_STRETCH * (tilt?.amount || 0));
        sprite.height = baseSize;
        sprite.tint = isErase ? 0xffffff : (settings.color ?? 0x800000);
        // 筆圧を濃度(アルファ)に直接反映
        sprite.alpha = Math.max(0.001, (settings.opacity ?? 1) * baseFlow * pressureFactor);
        sprite.blendMode = isErase ? 'erase' : 'normal';
        container.addChild(sprite);
    }

    _isPoolingEnabled() {
        return window.TEGAKI_CONFIG?.brushEngine?.airbrushDabPooling !== false;
    }

    _acquireContainer() {
        if (!this._isPoolingEnabled()) return new Container();
        if (!this.segmentContainer || this.segmentContainer.destroyed) {
            this.segmentContainer = new Container();
        }
        const container = this.segmentContainer;
        // 前回の呼び出し側がreleaseしなかった場合でもspriteを確実に回収する。
        if (container.children.length > 0) container.removeChildren();
        container.position.set(0, 0);
        this.pooledDabCount = 0;
        return container;
    }

    _acquireSprite(container, texture) {
        if (container !== this.segmentContainer) {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            return sprite;
        }
        let sprite = this.spritePool[this.pooledDabCount];
        if (!sprite || sprite.destroyed) {
            sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            this.spritePool[this.pooledDabCount] = sprite;
        } else if (sprite.texture !== texture) {
            sprite.texture = texture;
        }
        this.pooledDabCount++;
        return sprite;
    }

    /**
     * renderSegmentが返したcontainerを描画後に返却する。
     * pooling時はspriteを外して再利用し、無効時は従来どおり破棄する。
     */
    releaseSegment(container) {
        if (!container) return;
        if (container !== this.segmentContainer) {
            // cached texture を破棄しないため texture/baseTexture は指定しない。
            container.destroy({ children: true });
            return;
        }
        container.removeChildren();
        this.pooledDabCount = 0;
        this._trimTextureCache();
        if (this.spritePool.length > MAX_POOLED_DAB_SPRITES) {
            const excess = this.spritePool.splice(MAX_POOLED_DAB_SPRITES);
            excess.forEach(sprite => sprite.destroy());
        }
    }

    /**
     * pen dabの縁の柔らかさ。設定の柔らかさ(径に比例)と、AA幅(画素数で一定)から求めた柔らかさの大きい方。
     * AA幅は区間の細い側の径で換算し、texture数を抑えるため1/32刻みへ丸める。
     */
    _getPenDabEffectiveSoftness(points, settings) {
        const softness = Math.max(0, Math.min(1, Number(settings.penDabSoftness) || 0));
        const aaPx = Math.max(0, Number(settings.penEdgeAA) || 0);
        if (!(aaPx > 0) || !points?.length) return softness;
        const pressure = Math.min(...points.map(point => point.pressure ?? 1));
        const widthScale = Math.min(...points.map(point => point.widthScale ?? 1));
        const radius = Math.max(0.5, (this._getPenDabWidth(pressure, settings) * widthScale) / 2)
            + aaPx * PEN_AA_HALF_COVERAGE_OFFSET;
        const aaSoftness = computeSoftnessForEdgeWidth(aaPx, radius);
        const quantized = Math.round(Math.max(softness, aaSoftness) * 32) / 32;
        return Math.max(softness, Math.min(1, quantized));
    }

    _getPenDabWidth(pressure, settings) {
        let width = settings.pressureEnabled === true
            ? this.calculateWidth(pressure, settings.size)
            : Math.max(1, settings.size || 1);
        // 筆圧が径に効く強さ(1=従来どおり / 0=筆圧に依らず一定径)。角ペン・ミリペンは小さくして線幅を安定させる。
        const sizeStrength = settings.penPressureSizeStrength;
        if (settings.pressureEnabled === true && Number.isFinite(sizeStrength) && sizeStrength < 1) {
            const base = Math.max(1, settings.size || 1);
            const clamped = Math.max(0, sizeStrength);
            width = base * (1 - clamped) + width * clamped;
        }
        // ペンの傾き: 寝かせるほど太く(鉛筆の側面)。最大PEN_TILT_WIDEN倍。
        return width * (1 + PEN_TILT_WIDEN * (settings.dabTilt?.amount || 0));
    }

    /**
     * pen dab: stroke maskへmax合成で置くため、重なってもstroke内で濃度が積み上がらない。
     * 線の不透明度はmask確定時に一括で掛ける。
     */
    _addPenDab(container, texture, x, y, pressure, settings, widthScale = 1, nibAngle = undefined) {
        // AA帯は径の内側に作られるため、その分dabを広げて50%被覆の縁を元の径に保つ(線が細らない)。
        const aaPx = Math.max(0, Number(settings.penEdgeAA) || 0);
        const width = Math.max(0.5, this._getPenDabWidth(pressure, settings) * widthScale)
            + 2 * aaPx * PEN_AA_HALF_COVERAGE_OFFSET;
        const sprite = this._acquireSprite(container, texture);
        sprite.position.set(x, y);
        if (settings.penTipShape === 'square') {
            // 角: 幅=指定径、高さ=径×アスペクト、向き=nibの角度。縁のAAはtextureの外周1texelに任せる。
            const aspect = Math.max(0.15, Math.min(1, Number(settings.penTipAspect) || 1));
            const squareWidth = Math.max(0.5, this._getPenDabWidth(pressure, settings) * widthScale);
            // 方向追従の角度(再描画時のみ付く)があればそれを使い、なければ設定の固定角
            const angle = Number.isFinite(nibAngle) ? nibAngle : (Number(settings.penTipAngle) || 0);
            sprite.rotation = (angle * Math.PI) / 180;
            sprite.width = squareWidth * SQUARE_TEXTURE_SCALE;
            sprite.height = squareWidth * aspect * SQUARE_TEXTURE_SCALE;
        } else {
            sprite.rotation = 0;
            sprite.width = width;
            sprite.height = width;
        }
        sprite.tint = 0xffffff;
        sprite.alpha = Math.max(0.001, this.calculateOpacity(pressure, 1.0, settings));
        sprite.blendMode = 'max';
        container.addChild(sprite);
    }

    _getSpacingAdjustedFlow(settings) {
        const flow = Math.max(0.001, Math.min(1, settings.airbrushFlow ?? 0.08));
        const spacingRatio = Math.max(0.01, settings.airbrushSpacingRatio ?? 0.1);
        const exponent = spacingRatio / AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO;
        return 1 - Math.pow(1 - flow, exponent);
    }

    _getSquareTexture() {
        const cached = this.textures.get('square');
        if (cached && !cached.destroyed) return cached;
        const canvas = document.createElement('canvas');
        canvas.width = SQUARE_TEXTURE_SIZE;
        canvas.height = SQUARE_TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        // 角はごくわずかに丸め(拡大するとAAで柔らかい角になる)。
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(1, 1, SQUARE_TEXTURE_CORE, SQUARE_TEXTURE_CORE, 3);
        else ctx.rect(1, 1, SQUARE_TEXTURE_CORE, SQUARE_TEXTURE_CORE);
        ctx.fill();
        const texture = Texture.from({ resource: canvas, autoGenerateMipmaps: true }, true);
        this.textures.set('square', texture);
        return texture;
    }

    _getTexture(providedSoftness = 0.8) {
        const softness = Math.max(0, Math.min(1, Number(providedSoftness) || 0));
        const useFalloff = window.TEGAKI_CONFIG?.brushEngine?.airbrushHardnessFalloff !== false;
        const textureKey = `${useFalloff ? 'falloff' : 'legacy'}:${softness}`;
        const cached = this.textures.get(textureKey);
        if (cached && !cached.destroyed) {
            return cached;
        }

        const canvas = useFalloff
            ? createFalloffDabCanvas(softness)
            : createLegacyGradientDabCanvas(softness);

        // 小径dabで256px textureを縮小sampleしても粗くならないようmipmapを生成する。
        const texture = Texture.from({ resource: canvas, autoGenerateMipmaps: true }, true);
        this.textures.set(textureKey, texture);
        this._trimTextureCache();
        return texture;
    }

    /**
     * slider操作やAA幅でsoftnessが変化してもtextureを無制限に溜めない。
     * ただし描画待ちのsegment containerのdabが使っているtextureは破棄しない(破棄するとそのdabが消える)。
     * その場合は一時的に上限を超え、releaseSegment時に改めて整理する。
     */
    _trimTextureCache() {
        if (this.textures.size <= MAX_CACHED_DAB_TEXTURES) return;
        const inUse = new Set();
        (this.segmentContainer?.children || []).forEach(sprite => inUse.add(sprite.texture));
        for (const [key, texture] of [...this.textures.entries()]) {
            if (this.textures.size <= MAX_CACHED_DAB_TEXTURES) break;
            if (inUse.has(texture)) continue;
            this.textures.delete(key);
            this._releasePooledSpriteTexture(texture);
            texture.destroy(true);
        }
    }

    _releasePooledSpriteTexture(texture) {
        // 破棄するtextureをpool中のspriteが握ったままにしない。
        this.spritePool.forEach(sprite => {
            if (sprite.texture === texture) sprite.texture = Texture.EMPTY;
        });
    }

    destroy() {
        this.spritePool.forEach(sprite => sprite.destroy());
        this.spritePool = [];
        this.segmentContainer?.destroy();
        this.segmentContainer = null;
        this.textures.forEach(texture => texture.destroy(true));
        this.textures.clear();
    }
}

/**
 * 縁の減衰帯をedgePx画素にするsoftness。falloffの不透明な芯は半径×(1-softness)^2なので、
 * 減衰帯 = 半径×(1-(1-s)^2) = edgePx を解く。
 */
export function computeSoftnessForEdgeWidth(edgePx, radiusPx) {
    if (!(edgePx > 0) || !(radiusPx > 0)) return 0;
    const fraction = Math.min(1, edgePx / radiusPx);
    return 1 - Math.sqrt(1 - fraction);
}

/**
 * hardness(=1-softness)でパラメータ化した円形falloff。
 * softness 0 は1texel幅AAだけの硬い円、既定0.8は旧radial gradientに近いGaussian寄りの裾になる。
 */
export function computeDabFalloff(radius, softness) {
    if (radius >= 1) return 0;
    const core = (1 - softness) * (1 - softness);
    if (radius <= core) return 1;
    const t = (radius - core) / (1 - core);
    const tail = Math.exp(-1 / (2 * DAB_FALLOFF_SIGMA * DAB_FALLOFF_SIGMA));
    const gaussian = Math.exp(-(t * t) / (2 * DAB_FALLOFF_SIGMA * DAB_FALLOFF_SIGMA));
    return Math.max(0, (gaussian - tail) / (1 - tail));
}

function createFalloffDabCanvas(softness) {
    const size = DAB_TEXTURE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    const data = image.data;
    const radiusPx = size / 2;
    // 外周1texel手前で0へ落とし、clamp sampleでtexture端が滲まないようにする。
    const edgeRadiusPx = radiusPx - 1;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - radiusPx;
            const dy = y + 0.5 - radiusPx;
            const distancePx = Math.hypot(dx, dy);
            const radius = distancePx / edgeRadiusPx;
            // 硬い縁はtexel単位のcoverageでAAする。
            const edgeCoverage = Math.max(0, Math.min(1, edgeRadiusPx - distancePx + 0.5));
            const alpha = computeDabFalloff(Math.min(radius, 0.999999), softness) * edgeCoverage;
            const index = (y * size + x) * 4;
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = Math.round(alpha * 255);
        }
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

function createLegacyGradientDabCanvas(softness) {
    const size = DAB_TEXTURE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    const center = size / 2;
    context.clearRect(0, 0, size, size);

    const hardEdge = 1 - softness;
    const innerStop = hardEdge * 0.3;
    const midStop = innerStop + ((1 - innerStop) * 0.4);
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    if (innerStop > 0.01) {
        gradient.addColorStop(innerStop, 'rgba(255, 255, 255, 1.0)');
    }
    gradient.addColorStop(midStop, `rgba(255, 255, 255, ${(0.4 * softness).toFixed(3)})`);
    gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.02)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return canvas;
}
