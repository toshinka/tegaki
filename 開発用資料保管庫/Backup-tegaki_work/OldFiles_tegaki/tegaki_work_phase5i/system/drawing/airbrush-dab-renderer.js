/**
 * Airbrush固有のspacing、dab配置、texture cacheを管理する。
 * stroke lifecycle、RenderTextureへの焼き込み、History、Layer / CAFは所有しない。
 */

import { Container, Sprite, Texture } from 'pixi.js';

const AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO = 0.18;
const MIN_PRESSURE_DAB = 0.02;

export class AirbrushDabRenderer {
    constructor(options = {}) {
        this.calculateWidth = options.calculateWidth || ((pressure, size) => size * pressure);
        this.random = options.random || Math.random;
        this.texture = null;
        this.textureSoftness = null;
    }

    renderSegment(points, settings, state = {}) {
        if (!points || points.length < 1) return null;

        const container = new Container();
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
        if (settings.pressureEnabled === true && (pressure ?? 0) <= MIN_PRESSURE_DAB) {
            return;
        }

        const flow = this._getSpacingAdjustedFlow(settings);
        const scatter = settings.airbrushScatter ?? 0;
        const baseSize = settings.pressureEnabled === true
            ? this.calculateWidth(Math.max(MIN_PRESSURE_DAB, pressure ?? 1), settings.size)
            : settings.size;
        const isErase = settings.mode === 'airbrush-erase' || settings.mode === 'eraser';
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);

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
        sprite.alpha = Math.max(0.001, (settings.opacity ?? 1) * flow);
        sprite.blendMode = isErase ? 'erase' : 'normal';
        container.addChild(sprite);
    }

    _getSpacingAdjustedFlow(settings) {
        const flow = Math.max(0.001, Math.min(1, settings.airbrushFlow ?? 0.08));
        const spacingRatio = Math.max(0.01, settings.airbrushSpacingRatio ?? 0.1);
        const exponent = spacingRatio / AIRBRUSH_FLOW_REFERENCE_SPACING_RATIO;
        return 1 - Math.pow(1 - flow, exponent);
    }

    _getTexture(providedSoftness = 0.8) {
        const softness = Math.max(0, Math.min(1, Number(providedSoftness) || 0));
        if (this.texture && this.textureSoftness === softness) {
            return this.texture;
        }
        this.textureSoftness = softness;

        const size = 256;
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

        this.texture?.destroy();
        this.texture = Texture.from(canvas);
        return this.texture;
    }

    destroy() {
        this.texture?.destroy();
        this.texture = null;
        this.textureSoftness = null;
    }
}
