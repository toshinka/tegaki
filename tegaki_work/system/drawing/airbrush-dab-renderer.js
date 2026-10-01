/**
 * Airbrush固有のspacing、dab配置、texture cacheを管理する。
 * stroke lifecycle、RenderTextureへの焼き込み、History、Layer / CAFは所有しない。
 */

import { Container, Sprite, Texture } from 'pixi.js';

const AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO = 0.18;
const MIN_PRESSURE_DAB = 0.02;
const DAB_TEXTURE_SIZE = 256;
const MAX_POOLED_DAB_SPRITES = 4096;
const DAB_FALLOFF_SIGMA = 0.3;

export class AirbrushDabRenderer {
    constructor(options = {}) {
        this.calculateWidth = options.calculateWidth || ((pressure, size) => size * pressure);
        this.random = options.random || Math.random;
        this.texture = null;
        this.textureSoftness = null;
        // segmentごとのContainer / Sprite生成を避けるため、描画後に再利用する。
        this.segmentContainer = null;
        this.spritePool = [];
        this.pooledDabCount = 0;
    }

    renderSegment(points, settings, state = {}) {
        if (!points || points.length < 1) return null;

        const container = this._acquireContainer();
        const texture = this._getTexture(settings.airbrushSoftness);

        if (points.length === 1) {
            const point = points[0];
            this._addDab(container, texture, point.x, point.y, point.pressure ?? 1, settings);
            state.initialized = true;
            state.nextDistance = this.getSpacing(settings);
            return container.children.length > 0 ? container : null;
        }

        const start = points[0];
        const end = points[points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= 0) {
            this._addDab(container, texture, end.x, end.y, end.pressure ?? 1, settings);
            return container;
        }

        const spacing = this.getSpacing(settings);
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

            this._addDab(container, texture, x, y, pressure, settings);
            nextDistance += spacing;
        }

        state.nextDistance = nextDistance - distance;
        return container.children.length > 0 ? container : null;
    }

    getSpacing(settings) {
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

        sprite.position.set(dabX, dabY);
        sprite.width = baseSize;
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
        if (this.spritePool.length > MAX_POOLED_DAB_SPRITES) {
            const excess = this.spritePool.splice(MAX_POOLED_DAB_SPRITES);
            excess.forEach(sprite => sprite.destroy());
        }
    }

    _getSpacingAdjustedFlow(settings) {
        const flow = Math.max(0.001, Math.min(1, settings.airbrushFlow ?? 0.08));
        const spacingRatio = Math.max(0.01, settings.airbrushSpacingRatio ?? 0.1);
        const exponent = spacingRatio / AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO;
        return 1 - Math.pow(1 - flow, exponent);
    }

    _getTexture(providedSoftness = 0.8) {
        const softness = Math.max(0, Math.min(1, Number(providedSoftness) || 0));
        const useFalloff = window.TEGAKI_CONFIG?.brushEngine?.airbrushHardnessFalloff !== false;
        const textureKey = `${useFalloff ? 'falloff' : 'legacy'}:${softness}`;
        if (this.texture && this.textureSoftness === textureKey) {
            return this.texture;
        }
        this.textureSoftness = textureKey;

        const canvas = useFalloff
            ? createFalloffDabCanvas(softness)
            : createLegacyGradientDabCanvas(softness);

        this.texture?.destroy(true);
        // 小径dabで256px textureを縮小sampleしても粗くならないようmipmapを生成する。
        this.texture = Texture.from({ resource: canvas, autoGenerateMipmaps: true }, true);
        return this.texture;
    }

    destroy() {
        this.spritePool.forEach(sprite => sprite.destroy());
        this.spritePool = [];
        this.segmentContainer?.destroy();
        this.segmentContainer = null;
        this.texture?.destroy(true);
        this.texture = null;
        this.textureSoftness = null;
    }
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
