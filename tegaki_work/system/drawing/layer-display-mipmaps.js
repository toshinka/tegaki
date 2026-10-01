/**
 * ============================================================================
 * ファイル名: system/drawing/layer-display-mipmaps.js
 * 責務: 縮小表示時だけLayer raster textureへmipmapを付け、細線のちらつき・途切れを抑える表示補助。
 * 依存: Pixi renderer / LayerSystem.currentFrameContainer / CameraSystem.worldContainer
 * 被依存: core-engine.js
 * 非所有: Layer raster内容、History、保存、書き出し。level 0の画素は一切変更しない。
 *
 * 仕組み:
 * - renderer.renderを包み、書き込み先textureをdirtyとして記録する。
 * - 縮小表示中は表示中Layerのtextureをmipmap有効にし、読み出し(次のrender)前にdirty分だけ再生成する。
 * - 等倍以上へ戻したらmipmapを無効化し、再生成コストを止める(ヒステリシス付き)。
 * ============================================================================
 */

const ENABLE_BELOW_SCALE = 0.9;
const DISABLE_AT_OR_ABOVE_SCALE = 1.0;
const MIN_TEXTURE_SIZE = 64;

export class LayerDisplayMipmaps {
    constructor({ app, layerSystem, cameraSystem, brushCore = null } = {}) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.brushCore = brushCore;
        this.active = false;
        this.enabledSources = new Set();
        this.dirtySources = new Set();
        this.originalRender = null;
        this.flushing = false;
    }

    install() {
        const renderer = this.app?.renderer;
        if (!renderer || this.originalRender) return false;
        // WebGL1はNPOT mipmap不可のため対象外。
        if (renderer.name === 'webgl' && renderer.context?.webGLVersion !== 2) return false;

        this.originalRender = renderer.render.bind(renderer);
        renderer.render = (...args) => this._render(args);
        return true;
    }

    uninstall() {
        const renderer = this.app?.renderer;
        if (renderer && this.originalRender) {
            renderer.render = this.originalRender;
        }
        this.originalRender = null;
        this._disableAll();
    }

    _isEnabledByConfig() {
        return window.TEGAKI_CONFIG?.brushEngine?.zoomedOutDisplayMipmaps !== false;
    }

    _render(args) {
        const options = args[0];
        const isContainerOnly = options && typeof options === 'object' && !('container' in options) && !('target' in options);
        const target = isContainerOnly ? null : options?.target;
        const targetSource = target?.source || null;

        if (!targetSource) {
            // 画面描画時だけ表示倍率を見て有効/無効を切り替える。
            this._updateActivation();
        }
        if (this.dirtySources.size > 0) {
            this._flushDirty(targetSource);
        }

        const result = this.originalRender(...args);

        if (targetSource && this.enabledSources.has(targetSource)) {
            this.dirtySources.add(targetSource);
        }
        return result;
    }

    _getDisplayScale() {
        const scale = this.cameraSystem?.worldContainer?.scale;
        const x = Math.abs(Number(scale?.x ?? 1));
        const y = Math.abs(Number(scale?.y ?? 1));
        const value = Math.min(x, y);
        return Number.isFinite(value) && value > 0 ? value : 1;
    }

    _updateActivation() {
        if (!this._isEnabledByConfig()) {
            if (this.active) this._disableAll();
            return;
        }
        const scale = this._getDisplayScale();
        if (!this.active && scale < ENABLE_BELOW_SCALE) {
            this.active = true;
        } else if (this.active && scale >= DISABLE_AT_OR_ABOVE_SCALE) {
            this._disableAll();
            return;
        }
        if (this.active) {
            this._syncDisplayedSources();
        }
    }

    _syncDisplayedSources() {
        const displayed = new Set();
        const visit = (node) => {
            const children = node?.children;
            if (!Array.isArray(children)) return;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const source = child?.layerData?.layerSprite?.texture?.source;
                if (source) displayed.add(source);
                if (child?.layerData && child.children?.length) visit(child);
            }
        };
        visit(this.layerSystem?.currentFrameContainer);

        // stroke中のairbrush / pen dab preview(mask)も縮小表示で同じくちらつくため対象に含める。
        const maskSource = this.brushCore?.airbrushState?.maskTexture?.source;
        if (maskSource) displayed.add(maskSource);

        displayed.forEach(source => {
            if (!this.enabledSources.has(source)) this._enableSource(source);
        });
        this.enabledSources.forEach(source => {
            if (!displayed.has(source) || source.destroyed) this._disableSource(source);
        });
    }

    _enableSource(source) {
        if (!source || source.destroyed) return;
        const width = source.pixelWidth || source.width || 0;
        const height = source.pixelHeight || source.height || 0;
        if (Math.max(width, height) < MIN_TEXTURE_SIZE) return;

        source.mipLevelCount = Math.floor(Math.log2(Math.max(width, height))) + 1;
        source.autoGenerateMipmaps = true;
        this.enabledSources.add(source);
        this.dirtySources.add(source);
        // min filterをmipmap付きへ切り替える。
        source.style?.update?.();
    }

    _disableSource(source) {
        this.enabledSources.delete(source);
        this.dirtySources.delete(source);
        if (!source || source.destroyed) return;
        source.autoGenerateMipmaps = false;
        source.mipLevelCount = 1;
        // 古いmip levelをsampleしないよう、min filterを非mipmapへ戻す。
        source.style?.update?.();
    }

    _disableAll() {
        this.active = false;
        Array.from(this.enabledSources).forEach(source => this._disableSource(source));
        this.dirtySources.clear();
    }

    _flushDirty(skipSource) {
        if (this.flushing) return;
        this.flushing = true;
        try {
            Array.from(this.dirtySources).forEach(source => {
                // 描き込み先と同じtextureはFBO bind中のため、この呼び出し後にdirtyのまま残す。
                if (source === skipSource) return;
                this.dirtySources.delete(source);
                if (!source.destroyed && this.enabledSources.has(source)) {
                    source.updateMipmaps();
                }
            });
        } finally {
            this.flushing = false;
        }
    }
}
