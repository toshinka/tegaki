/**
 * ROLE: 公式 Rive Web runtime の candidate load、native artboard render、透明 1x PNG、End骨preview。
 * AUTHORITY: detached `.riv` runtime は派生 preview。source/image/save authority は server/model にある。
 * INVARIANTS: frame は artboard 実寸、最後の seek progress を保持し、load failure では良好 runtime/pose を復元する。骨行列は数値コピーのみ。
 * RELATED: advanced/rive-editor/editor.js、bone-projection.mjs、server.mjs、WP-026 cached runtime。
 */
import Rive from '/runtime/canvas_advanced.mjs';
import { BONE_NAME, clampBoneAngle, copyMatrix, createBoneProjection } from './bone-projection.mjs';

function pngBytes(canvas) {
    const dataUrl = canvas.toDataURL('image/png');
    const encoded = dataUrl.slice('data:image/png;base64,'.length);
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

export class RiveNativeRuntime {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
        this.rive = null;
        this.file = null;
        this.artboard = null;
        this.renderer = null;
        this.animation = null;
        this.animationInstance = null;
        this.width = 0;
        this.height = 0;
        this.progress = 0;
        this.previewAngle = null;
        this.lastAlignment = null;
        this.disposed = false;
        this.lifecycle = 0;
    }

    async _createRuntime() {
        return Rive({
            locateFile: name => `/runtime/${name === 'canvas_advanced.wasm' ? 'rive.wasm' : name}`,
        });
    }

    _capture() {
        return {
            rive: this.rive,
            file: this.file,
            artboard: this.artboard,
            renderer: this.renderer,
            animation: this.animation,
            animationInstance: this.animationInstance,
            width: this.width,
            height: this.height,
            progress: this.progress,
            previewAngle: this.previewAngle,
            lastAlignment: this.lastAlignment,
        };
    }

    _assign(resources) {
        this.rive = resources?.rive || null;
        this.file = resources?.file || null;
        this.artboard = resources?.artboard || null;
        this.renderer = resources?.renderer || null;
        this.animation = resources?.animation || null;
        this.animationInstance = resources?.animationInstance || null;
        this.width = resources?.width || 0;
        this.height = resources?.height || 0;
        this.progress = Number.isFinite(resources?.progress) ? resources.progress : 0;
        this.previewAngle = Number.isFinite(resources?.previewAngle) ? resources.previewAngle : null;
        this.lastAlignment = resources?.lastAlignment || null;
    }

    _release(resources) {
        try { resources?.animationInstance?.delete?.(); } catch {}
        try { resources?.animation?.delete?.(); } catch {}
        try { resources?.artboard?.delete?.(); } catch {}
        try { resources?.file?.unref?.(); } catch {}
        try { resources?.renderer?.delete?.(); } catch {}
        try { resources?.rive?.cleanup?.(); } catch {}
    }

    async _loadCandidate(artifactUrl, width, height) {
        const rive = await this._createRuntime();
        let file = null;
        let artboard = null;
        let renderer = null;
        let animation = null;
        let animationInstance = null;
        const nextWidth = Math.max(1, Math.round(width));
        const nextHeight = Math.max(1, Math.round(height));
        const oldCanvasWidth = this.canvas.width;
        const oldCanvasHeight = this.canvas.height;
        try {
            const response = await fetch(`${artifactUrl}${artifactUrl.includes('?') ? '&' : '?'}runtime=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Rive artifact fetch failed: ${response.status}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            file = await rive.load(bytes, undefined, false);
            artboard = file.defaultArtboard();
            this.canvas.width = nextWidth;
            this.canvas.height = nextHeight;
            renderer = rive.makeRenderer(this.canvas);
            animation = artboard.animationByName('EndPose');
            if (!animation) throw new Error('EndPose animation was not found in the .riv.');
            animationInstance = new rive.LinearAnimationInstance(animation, artboard);
            return { rive, file, artboard, renderer, animation, animationInstance, width: nextWidth, height: nextHeight };
        } catch (error) {
            this.canvas.width = oldCanvasWidth;
            this.canvas.height = oldCanvasHeight;
            this._release({ rive, file, artboard, renderer, animation, animationInstance });
            throw error;
        }
    }

    async load(artifactUrl, width, height) {
        if (this.disposed) throw new Error('Native runtime is disposed.');
        const lifecycle = this.lifecycle;
        const previous = this._capture();
        const oldCanvasWidth = this.canvas.width;
        const oldCanvasHeight = this.canvas.height;
        let candidate = null;
        try {
            candidate = await this._loadCandidate(artifactUrl, width, height);
            if (this.disposed || lifecycle !== this.lifecycle) {
                this._release(candidate);
                candidate = null;
                throw new Error('Native runtime was disposed during load.');
            }
            this._assign(candidate);
            this.seek(0);
            this._release(previous);
        } catch (error) {
            if (candidate) this._release(candidate);
            this.canvas.width = oldCanvasWidth;
            this.canvas.height = oldCanvasHeight;
            if (!this.disposed && lifecycle === this.lifecycle) {
                this._assign(previous);
                try { if (previous?.rive) this.seek(previous.progress); } catch {}
            }
            throw error;
        }
    }

    _applyAnimation(progress) {
        if (!this.rive || !this.artboard || !this.renderer || !this.animationInstance) throw new Error('Rive runtime is not loaded.');
        const safeProgress = Math.max(0, Math.min(1, Number(progress)));
        this.animationInstance.time = 0;
        this.animationInstance.advance(safeProgress);
        this.animationInstance.apply(1);
        this.artboard.advance(0);
        this.progress = safeProgress;
        return safeProgress;
    }

    _drawNativeFrame() {
        if (!this.rive || !this.artboard || !this.renderer) throw new Error('Rive runtime is not loaded.');
        const frame = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        const alignment = this.rive.computeAlignment(
            this.rive.Fit.contain,
            this.rive.Alignment.center,
            frame,
            this.artboard.bounds,
        );
        try {
            this.lastAlignment = copyMatrix(alignment);
        } finally {
            alignment?.delete?.();
        }
        if (!this.lastAlignment) throw new Error('Native alignment matrix is unavailable.');
        this.renderer.beginFrame(true);
        this.renderer.save();
        this.renderer.align(
            this.rive.Fit.contain,
            this.rive.Alignment.center,
            frame,
            this.artboard.bounds,
        );
        this.artboard.draw(this.renderer);
        this.renderer.restore();
        this.rive.resolveAnimationFrame();
    }

    seek(progress) {
        const safeProgress = this._applyAnimation(progress);
        this._drawNativeFrame();
        const bone = this.artboard.bone(BONE_NAME);
        this.previewAngle = null;
        return {
            progress: safeProgress,
            boneRotation: bone ? Number(bone.rotation.toFixed(6)) : null,
            animationTime: Number.isFinite(this.animationInstance.time) ? this.animationInstance.time : null,
        };
    }

    render(progress) {
        if (this.previewAngle !== null) throw new Error('Native frame is unavailable during bone preview.');
        const pose = this.seek(progress);
        const imageData = this.context.getImageData(0, 0, this.width, this.height);
        return {
            ...pose,
            width: this.width,
            height: this.height,
            pixels: imageData,
            png: pngBytes(this.canvas),
        };
    }

    dispose() {
        this.disposed = true;
        this.lifecycle += 1;
        const previous = this._capture();
        this._assign(null);
        this._release(previous);
    }

    _boneProjection(cssRect) {
        if (!this.rive || !this.artboard || !this.lastAlignment) return null;
        const bone = this.artboard.bone(BONE_NAME);
        if (!bone || typeof bone.worldTransform !== 'function') return null;
        const boneMatrix = copyMatrix(bone.worldTransform());
        const root = typeof this.artboard.rootBone === 'function' ? this.artboard.rootBone('Root') : null;
        const parentMatrix = root && typeof root.worldTransform === 'function' ? copyMatrix(root.worldTransform()) : null;
        return createBoneProjection({
            alignment: this.lastAlignment,
            boneMatrix,
            parentMatrix,
            length: bone.length,
            canvasWidth: this.width,
            canvasHeight: this.height,
            cssRect,
            angle: Number.isFinite(this.previewAngle) ? this.previewAngle : Number(bone.rotation * 180 / Math.PI),
        });
    }

    getEndBoneProjection(cssRect) {
        return this._boneProjection(cssRect);
    }

    previewEndBone(angle, progress = 1) {
        const safeAngle = clampBoneAngle(angle);
        if (safeAngle === null) throw new Error('End bone angle is invalid.');
        const safeProgress = this._applyAnimation(progress);
        const bone = this.artboard?.bone(BONE_NAME);
        if (!bone) throw new Error('End bone is unavailable.');
        bone.rotation = safeAngle * Math.PI / 180;
        this.artboard.advance(0);
        this._drawNativeFrame();
        this.previewAngle = safeAngle;
        const projection = this._boneProjection(null);
        if (!projection) throw new Error('End bone projection is unavailable.');
        return {
            selectedBone: BONE_NAME,
            angle: safeAngle,
            progress: safeProgress,
            projection,
        };
    }

    restorePose(progress = this.progress) {
        return this.seek(progress);
    }
}

export function imageMetrics(imageData) {
    const { data, width, height } = imageData;
    let alphaPixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] < 8) continue;
            alphaPixels += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    return {
        alphaPixels,
        bbox: alphaPixels ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    };
}

