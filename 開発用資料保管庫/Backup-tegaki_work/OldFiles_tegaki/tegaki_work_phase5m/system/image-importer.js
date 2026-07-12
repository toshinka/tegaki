/**
 * ============================================================================
 * ファイル名: system/image-importer.js
 * 責務: 外部画像ファイル/OSクリップボード画像をアクティブRaster Layerへ貼り付ける
 * 依存: system/event-bus.js, system/history.js
 * 被依存: core-engine.js, pixel-selection-system.js, ui-panels.js
 * 公開API: ImageImporter
 * イベント発火: image:imported, image:import-failed, drawing:stroke-started, drawing:stroke-completed
 * 実装状態: Phase 5o
 * ============================================================================
 */

import { TegakiEventBus } from './event-bus.js';
import { historyManager } from './history.js';
import { decodeAnimatedImageBlob } from './animated-image-decoder.js';

const SUPPORTED_IMAGE_MIME = /^image\/(png|apng|jpeg|jpg|webp|gif|bmp)$/i;
const SUPPORTED_PSD_MIME = /^(image\/vnd\.adobe\.photoshop|application\/octet-stream|)$/i;

export class ImageImporter {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.history = dependencies.history || historyManager;
        this.fileInput = null;
        this._pasteListener = null;
        this.importMode = 'fit-canvas';
        this._fileDialogOptions = null;
        this.importPopup = null;
        this._suppressNextSystemPaste = false;
        this._suppressPasteTimer = null;
    }

    init(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || this.layerSystem || window.layerManager;
        this.eventBus = dependencies.eventBus || this.eventBus || TegakiEventBus;
        this.history = dependencies.history || this.history || historyManager;
        this._ensureFileInput();
        this._setupPasteListener();
    }

    openFileDialog() {
        this.showImportPopup();
    }

    showImportPopup() {
        this._ensureImportPopup();
        if (!this.importPopup) {
            this._openFileDialogDirect();
            return;
        }
        this.importPopup.classList.add('show');
        this.importPopup.style.display = 'block';
        this._setImportMode(this.importMode);
    }

    hideImportPopup() {
        if (!this.importPopup) return;
        this.importPopup.classList.remove('show');
        this.importPopup.style.display = 'none';
    }

    _openFileDialogDirect(options = {}) {
        this._ensureFileInput();
        this._fileDialogOptions = {
            placementMode: options.placementMode || this.importMode || 'fit-canvas'
        };
        this.fileInput?.click();
    }

    async importFile(file, options = {}) {
        if (this._isSupportedPsdFile(file)) {
            const imported = await window.psdImporter?.importFileToActiveCaf?.(file, {
                placementMode: options.placementMode || this.importMode || 'fit-canvas'
            });
            if (!imported) this._emitFailure('PSDをアクティブCAFへ取り込めませんでした');
            return imported === true;
        }
        if (!this._isSupportedImageBlob(file)) {
            this._emitFailure('対応していない画像形式です');
            return false;
        }
        return this.importBlob(file, {
            source: 'file',
            name: file?.name || 'imported image',
            placementMode: options.placementMode || 'fit-canvas'
        });
    }

    async pasteFromSystemClipboard() {
        if (!navigator.clipboard?.read) return false;
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const type = item.types?.find(candidate => this._isSupportedImageType(candidate));
                if (!type) continue;
                const blob = await item.getType(type);
                return this.importBlob(blob, {
                    source: 'clipboard',
                    name: 'clipboard image'
                });
            }
        } catch (error) {
            console.warn('[ImageImporter] Clipboard image read failed:', error);
        }
        return false;
    }

    suppressNextSystemPaste() {
        this._suppressNextSystemPaste = true;
        if (this._suppressPasteTimer) {
            clearTimeout(this._suppressPasteTimer);
        }
        this._suppressPasteTimer = setTimeout(() => {
            this._suppressNextSystemPaste = false;
            this._suppressPasteTimer = null;
        }, 250);
    }

    _ensureImportPopup() {
        if (this.importPopup && document.body.contains(this.importPopup)) return;
        const popup = document.createElement('div');
        popup.id = 'image-import-settings';
        popup.className = 'popup-panel popup-panel--translucent image-import-popup';
        popup.style.display = 'none';
        popup.innerHTML = `
            <button class="ui-close-button ui-close-button--medium popup-close-btn" type="button" aria-label="閉じる" title="閉じる">
                ${window.UI_ICONS?.close || '×'}
            </button>
            <div class="popup-title">画像読み込み</div>
            <div class="image-import-mode-list">
                <button class="image-import-mode-btn active" type="button" data-import-mode="fit-canvas">
                    <span class="image-import-mode-title">キャンバスに収める</span>
                    <span class="image-import-mode-desc">縦横比を保ち、キャンバス内に最大表示します。</span>
                </button>
                <button class="image-import-mode-btn" type="button" data-import-mode="original">
                    <span class="image-import-mode-title">原寸で貼る</span>
                    <span class="image-import-mode-desc">キャンバスサイズを変えず、画像本来のpxで貼ります。</span>
                </button>
                <button class="image-import-mode-btn" type="button" data-import-mode="resize-canvas">
                    <span class="image-import-mode-title">画像に合わせる</span>
                    <span class="image-import-mode-desc">キャンバスを画像サイズへ変更してから貼ります。</span>
                </button>
            </div>
            <button class="image-import-file-btn" id="image-import-file-button" type="button">
                <span class="image-import-file-icon">${window.UI_ICONS?.folderOpen || ''}</span>
                <span>画像 / PSDを選ぶ</span>
            </button>
        `;

        popup.querySelector('.ui-close-button')?.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.hideImportPopup();
        });
        popup.querySelectorAll('[data-import-mode]').forEach(button => {
            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                this._setImportMode(button.dataset.importMode || 'fit-canvas');
            });
        });
        popup.querySelector('#image-import-file-button')?.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.hideImportPopup();
            this._openFileDialogDirect({ placementMode: this.importMode });
        });

        document.body.appendChild(popup);
        this.importPopup = popup;
        this._setImportMode(this.importMode);
    }

    _setImportMode(mode) {
        this.importMode = ['fit-canvas', 'original', 'resize-canvas'].includes(mode) ? mode : 'fit-canvas';
        this.importPopup?.querySelectorAll('[data-import-mode]')?.forEach(button => {
            button.classList.toggle('active', button.dataset.importMode === this.importMode);
        });
    }

    async importBlob(blob, options = {}) {
        try {
            const animatedSequence = await this._tryDecodeAnimatedImage(blob);
            if (animatedSequence?.frames?.length > 1) {
                const imported = this.importAnimatedImageSequence(animatedSequence, options);
                if (imported) return true;
            }

            const image = await this._decodeImage(blob);
            const imageData = this._imageToCanvasImageData(image);
            this._releaseDecodedImage(image);
            return this.importImageData(imageData, options);
        } catch (error) {
            console.error('[ImageImporter] Failed to import image:', error);
            this._emitFailure(error?.message || '画像読み込みに失敗しました');
            return false;
        }
    }

    importImageData(imageData, options = {}) {
        const layerSystem = this.layerSystem || window.layerManager;
        const layer = layerSystem?.getActiveLayer?.();
        if (!this._canPasteToLayer(layer)) {
            this._emitFailure('貼り付け可能なRaster Layerを選択してください');
            return false;
        }

        const placementMode = this._normalizePlacementMode(options.placementMode);
        if (placementMode === 'resize-canvas' && !this._ensureCanvasSizeForImport(imageData.width, imageData.height, options)) {
            this._emitFailure('キャンバスサイズを変更できませんでした');
            return false;
        }

        const beforeSnapshot = layerSystem.createLayerRasterSnapshot?.(layer);
        if (!beforeSnapshot?.pixels) return false;
        const layerId = layer.layerData.id;
        const isAnimationWorkingLayer = layer.layerData.isAnimationWorkingLayer === true;

        if (isAnimationWorkingLayer) {
            this.eventBus?.emit('drawing:stroke-started', {
                layerId,
                mode: 'image-import',
                source: options.source || 'unknown'
            });
        }

        const canvasConfig = layerSystem.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const projectWidth = Math.max(1, Math.round(canvasConfig.width || beforeSnapshot.width));
        const projectHeight = Math.max(1, Math.round(canvasConfig.height || beforeSnapshot.height));
        const placement = this._resolvePlacement(
            imageData.width,
            imageData.height,
            projectWidth,
            projectHeight,
            placementMode
        );

        const expanded = layerSystem.ensureLayerRasterBoundsForRect?.(layer, placement, { padding: 0 });
        if (expanded && expanded.ok === false) {
            if (isAnimationWorkingLayer) {
                this.eventBus?.emit('drawing:stroke-cancelled', {
                    layerId,
                    mode: 'image-import',
                    source: options.source || 'unknown'
                });
            }
            this._emitFailure('画像の貼り付け範囲が大きすぎます');
            return false;
        }

        const targetSnapshot = layerSystem.createLayerRasterSnapshot?.(layer);
        if (!targetSnapshot?.pixels) {
            if (isAnimationWorkingLayer) this.eventBus?.emit('drawing:stroke-cancelled', { layerId, mode: 'image-import' });
            return false;
        }

        const afterSnapshot = this._composeImageOntoSnapshot(targetSnapshot, imageData, placement);
        if (!afterSnapshot) {
            if (isAnimationWorkingLayer) this.eventBus?.emit('drawing:stroke-cancelled', { layerId, mode: 'image-import' });
            return false;
        }

        if (!layerSystem.restoreLayerRasterSnapshot?.(afterSnapshot)) {
            layerSystem.restoreLayerRasterSnapshot?.(beforeSnapshot);
            if (isAnimationWorkingLayer) this.eventBus?.emit('drawing:stroke-cancelled', { layerId, mode: 'image-import' });
            return false;
        }

        layerSystem.requestThumbnailUpdate?.(layerSystem.getLayerIndex?.(layer), true);
        this.eventBus?.emit('layer:content-changed', { layerId, source: 'image-import' });

        if (isAnimationWorkingLayer) {
            this.eventBus?.emit('drawing:stroke-completed', {
                layerId,
                mode: 'image-import',
                source: options.source || 'unknown'
            });
        } else {
            this._recordNormalLayerHistory(layerId, beforeSnapshot, afterSnapshot, options);
        }

        this.eventBus?.emit('image:imported', {
            layerId,
            source: options.source || 'unknown',
            name: options.name || null,
            placement
        });
        this._showToast('画像を貼り付けました');
        return true;
    }

    importAnimatedImageSequence(sequence, options = {}) {
        const animationTable = this._resolveAnimationTable();
        if (!animationTable?.importImageSequenceAsCafs) return false;

        const placementMode = this._normalizePlacementMode(options.placementMode);
        if (placementMode === 'resize-canvas' && !this._ensureCanvasSizeForImport(sequence.width || 1, sequence.height || 1, options)) {
            this._emitFailure('キャンバスサイズを変更できませんでした');
            return false;
        }

        const canvasConfig = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const projectWidth = Math.max(1, Math.round(canvasConfig.width || sequence.width || 1));
        const projectHeight = Math.max(1, Math.round(canvasConfig.height || sequence.height || 1));
        const frames = sequence.frames.map((frame, index) => {
            const prepared = this._imageDataToProjectPixels(frame.imageData, projectWidth, projectHeight, placementMode);
            return {
                ...prepared,
                delayMs: frame.delayMs || null,
                sourceIndex: Number.isInteger(frame.index) ? frame.index : index
            };
        });

        const imported = animationTable.importImageSequenceAsCafs(frames, {
            name: options.name || `${sequence.kind || 'animated'} image`,
            source: options.source || 'unknown',
            kind: sequence.kind || 'animated-image',
            sourceWidth: sequence.width || null,
            sourceHeight: sequence.height || null
        });

        if (imported) {
            this.eventBus?.emit('image:imported', {
                source: options.source || 'unknown',
                name: options.name || null,
                mode: 'animated-caf',
                kind: sequence.kind || 'animated-image',
                frameCount: frames.length
            });
            this._showToast(`${frames.length}フレームをCAFとして読み込みました`);
        }
        return imported;
    }

    _recordNormalLayerHistory(layerId, beforeSnapshot, afterSnapshot, options = {}) {
        if (!this.history || this.history.isApplying || !this.layerSystem?.restoreLayerRasterSnapshot) return;
        this.history.record({
            name: 'image-import-to-layer',
            do: () => {
                this.layerSystem.restoreLayerRasterSnapshot(afterSnapshot);
                this.eventBus?.emit('layer:content-changed', { layerId, source: 'image-import-redo' });
            },
            undo: () => {
                this.layerSystem.restoreLayerRasterSnapshot(beforeSnapshot);
                this.eventBus?.emit('layer:content-changed', { layerId, source: 'image-import-undo' });
            },
            byteSize: (beforeSnapshot.pixels?.byteLength || 0) + (afterSnapshot.pixels?.byteLength || 0),
            meta: {
                layerId,
                source: options.source || 'unknown',
                imageName: options.name || null
            }
        });
    }

    _ensureFileInput() {
        if (this.fileInput) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/apng,image/jpeg,image/webp,image/gif,image/bmp,.psd,image/vnd.adobe.photoshop';
        input.style.display = 'none';
        input.addEventListener('change', async () => {
            const file = input.files?.[0] || null;
            const options = this._fileDialogOptions || { placementMode: this.importMode || 'fit-canvas' };
            this._fileDialogOptions = null;
            input.value = '';
            if (file) await this.importFile(file, options);
        });
        document.body.appendChild(input);
        this.fileInput = input;
    }

    _setupPasteListener() {
        if (this._pasteListener) return;
        this._pasteListener = async (event) => {
            if (this._isEditableTarget(event.target)) return;
            if (this._suppressNextSystemPaste) {
                this._suppressNextSystemPaste = false;
                if (this._suppressPasteTimer) {
                    clearTimeout(this._suppressPasteTimer);
                    this._suppressPasteTimer = null;
                }
                return;
            }
            const blob = this._getImageBlobFromClipboardEvent(event);
            if (!blob) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            await this.importBlob(blob, {
                source: 'clipboard',
                name: 'clipboard image'
            });
        };
        document.addEventListener('paste', this._pasteListener, { capture: true });
    }

    _getImageBlobFromClipboardEvent(event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.kind === 'file' && this._isSupportedImageType(item.type));
        return imageItem?.getAsFile?.() || null;
    }

    _isSupportedImageBlob(blob) {
        return !!blob && this._isSupportedImageType(blob.type);
    }

    _isSupportedImageType(type) {
        return SUPPORTED_IMAGE_MIME.test(String(type || ''));
    }

    _isSupportedPsdFile(file) {
        if (!file) return false;
        const name = String(file.name || '').toLowerCase();
        const type = String(file.type || '');
        return name.endsWith('.psd') || (name.endsWith('.psd') && SUPPORTED_PSD_MIME.test(type));
    }

    _isEditableTarget(target) {
        return !!(
            target
            && (
                target.tagName === 'INPUT'
                || target.tagName === 'TEXTAREA'
                || target.isContentEditable
            )
        );
    }

    _canPasteToLayer(layer) {
        const data = layer?.layerData;
        return !!(
            data
            && data.renderTexture
            && data.isBackground !== true
            && data.isFolder !== true
        );
    }

    async _tryDecodeAnimatedImage(blob) {
        try {
            return await decodeAnimatedImageBlob(blob);
        } catch (error) {
            console.warn('[ImageImporter] Animated image decode skipped:', error);
            return null;
        }
    }

    _resolveAnimationTable(options = {}) {
        const popupManager = window.PopupManager || window.coreEngine?.popupManager || null;
        const animationTable = popupManager?.get?.('animationTable')
            || popupManager?.popups?.get?.('animationTable')?.instance
            || null;
        if (animationTable?.importImageSequenceAsCafs) {
            if (options.show !== false && !animationTable.isVisible) {
                popupManager?.show?.('animationTable');
            }
            return animationTable;
        }
        return null;
    }

    async _decodeImage(blob) {
        if (typeof createImageBitmap === 'function') {
            return createImageBitmap(blob);
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('画像デコードに失敗しました'));
            };
            img.src = url;
        });
    }

    _releaseDecodedImage(image) {
        image?.close?.();
    }

    _imageToCanvasImageData(image) {
        const width = Math.max(1, Math.round(image.width || image.naturalWidth || 1));
        const height = Math.max(1, Math.round(image.height || image.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('画像変換用Canvasを作成できません');
        ctx.drawImage(image, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height);
    }

    _normalizePlacementMode(mode) {
        return ['fit-canvas', 'original', 'resize-canvas'].includes(mode) ? mode : 'fit-canvas';
    }

    _ensureCanvasSizeForImport(width, height, options = {}) {
        const nextWidth = Math.max(1, Math.round(width || 1));
        const nextHeight = Math.max(1, Math.round(height || 1));
        const config = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const oldWidth = Math.max(1, Math.round(config.width || nextWidth));
        const oldHeight = Math.max(1, Math.round(config.height || nextHeight));
        if (oldWidth === nextWidth && oldHeight === nextHeight) return true;
        return this._resizeCanvasForImport(nextWidth, nextHeight, options);
    }

    _resizeCanvasForImport(width, height, options = {}) {
        const nextWidth = Math.max(1, Math.round(width || 1));
        const nextHeight = Math.max(1, Math.round(height || 1));
        const config = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const oldWidth = Math.max(1, Math.round(config.width || nextWidth));
        const oldHeight = Math.max(1, Math.round(config.height || nextHeight));
        if (oldWidth === nextWidth && oldHeight === nextHeight) return false;

        const camera = window.coreEngine?.getCameraSystem?.() || window.cameraSystem || null;
        if (!camera?.resizeCanvas) return false;

        const beforeState = this._captureCanvasResizeState();
        const align = { horizontal: 'center', vertical: 'center' };
        camera.resizeCanvas(nextWidth, nextHeight, align);
        this._updateCanvasInfo();
        const afterState = this._captureCanvasResizeState();

        if (this.history && !this.history.isApplying) {
            const layerBytes = (beforeState.layerSnapshots || []).reduce((sum, snapshot) => sum + (snapshot.pixels?.byteLength || snapshot.pixels?.length || 0), 0)
                + (afterState.layerSnapshots || []).reduce((sum, snapshot) => sum + (snapshot.pixels?.byteLength || snapshot.pixels?.length || 0), 0);
            this.history.record({
                name: 'resize-canvas-for-image-import',
                do: () => this._restoreCanvasResizeState(afterState, align),
                undo: () => this._restoreCanvasResizeState(beforeState, align),
                byteSize: layerBytes,
                meta: {
                    type: 'resize-canvas-for-image-import',
                    from: { width: oldWidth, height: oldHeight },
                    to: { width: nextWidth, height: nextHeight },
                    source: options.source || 'unknown',
                    imageName: options.name || null
                }
            });
        }
        return true;
    }

    _captureCanvasResizeState() {
        const layerSystem = this.layerSystem || window.layerManager;
        const animationTable = this._resolveAnimationTable({ show: false });
        const layers = layerSystem?.getLayers?.() || [];
        return {
            width: window.TEGAKI_CONFIG?.canvas?.width || layerSystem?.config?.canvas?.width || 1,
            height: window.TEGAKI_CONFIG?.canvas?.height || layerSystem?.config?.canvas?.height || 1,
            layerSnapshots: layers
                .filter(layer => this._canPasteToLayer(layer))
                .map(layer => layerSystem.createLayerRasterSnapshot?.(layer))
                .filter(Boolean),
            animationState: animationTable?._captureTimelineHistoryState?.() || null
        };
    }

    _restoreCanvasResizeState(state, align) {
        if (!state) return false;
        const camera = window.coreEngine?.getCameraSystem?.() || window.cameraSystem || null;
        const layerSystem = this.layerSystem || window.layerManager;
        const currentWidth = window.TEGAKI_CONFIG?.canvas?.width || 1;
        const currentHeight = window.TEGAKI_CONFIG?.canvas?.height || 1;
        if (camera?.resizeCanvas && (currentWidth !== state.width || currentHeight !== state.height)) {
            camera.resizeCanvas(state.width, state.height, align || { horizontal: 'center', vertical: 'center' });
        }
        (state.layerSnapshots || []).forEach(snapshot => {
            layerSystem?.restoreLayerRasterSnapshot?.(snapshot);
        });
        const animationTable = this._resolveAnimationTable({ show: false });
        if (state.animationState && animationTable?._restoreTimelineHistoryState) {
            animationTable._restoreTimelineHistoryState(state.animationState);
            animationTable._invalidateSnapshotTextureCache?.();
            animationTable._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
            animationTable.render?.();
            animationTable._flushLayerPanelSync?.();
        }
        this._updateCanvasInfo();
        return true;
    }

    _updateCanvasInfo() {
        const width = window.TEGAKI_CONFIG?.canvas?.width || 1;
        const height = window.TEGAKI_CONFIG?.canvas?.height || 1;
        const canvasInfoElement = document.getElementById('canvas-info');
        if (canvasInfoElement) {
            canvasInfoElement.textContent = `${width}×${height}px`;
        }
    }

    _resolvePlacement(sourceWidth, sourceHeight, targetWidth, targetHeight, placementMode = 'fit-canvas') {
        const mode = this._normalizePlacementMode(placementMode);
        const scale = mode === 'fit-canvas'
            ? Math.min(1, targetWidth / sourceWidth, targetHeight / sourceHeight)
            : 1;
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        return {
            x: Math.round((targetWidth - width) / 2),
            y: Math.round((targetHeight - height) / 2),
            width,
            height,
            scale
        };
    }

    _imageDataToProjectPixels(imageData, projectWidth, projectHeight, placementMode = 'fit-canvas') {
        const placement = this._resolvePlacement(
            imageData.width,
            imageData.height,
            projectWidth,
            projectHeight,
            placementMode
        );
        const canvasWidth = placementMode === 'original' ? placement.width : projectWidth;
        const canvasHeight = placementMode === 'original' ? placement.height : projectHeight;
        const boundsX = placementMode === 'original' ? placement.x : 0;
        const boundsY = placementMode === 'original' ? placement.y : 0;
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('アニメーション画像配置用Canvasを作成できません');

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = imageData.width;
        sourceCanvas.height = imageData.height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) throw new Error('アニメーション画像ソースCanvasを作成できません');
        sourceCtx.putImageData(imageData, 0, 0);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            sourceCanvas,
            0,
            0,
            imageData.width,
            imageData.height,
            placementMode === 'original' ? 0 : placement.x,
            placementMode === 'original' ? 0 : placement.y,
            placement.width,
            placement.height
        );

        const placed = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        return {
            width: canvasWidth,
            height: canvasHeight,
            rasterBounds: { x: boundsX, y: boundsY, width: canvasWidth, height: canvasHeight },
            pixels: new Uint8ClampedArray(placed.data),
            placement
        };
    }

    _composeImageOntoSnapshot(snapshot, imageData, placement) {
        const canvas = document.createElement('canvas');
        canvas.width = snapshot.width;
        canvas.height = snapshot.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        const rasterBounds = snapshot.rasterBounds || {
            x: 0,
            y: 0,
            width: snapshot.width,
            height: snapshot.height
        };

        ctx.putImageData(new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshot.width, snapshot.height), 0, 0);

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = imageData.width;
        sourceCanvas.height = imageData.height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return null;
        sourceCtx.putImageData(imageData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            sourceCanvas,
            0,
            0,
            imageData.width,
            imageData.height,
            placement.x - rasterBounds.x,
            placement.y - rasterBounds.y,
            placement.width,
            placement.height
        );

        const composed = ctx.getImageData(0, 0, snapshot.width, snapshot.height);
        return {
            ...snapshot,
            pixels: new Uint8ClampedArray(composed.data)
        };
    }

    _emitFailure(message) {
        this.eventBus?.emit('image:import-failed', { message });
        this._showToast(message || '画像貼り付けに失敗しました');
    }

    _showToast(message) {
        const projectManager = window.projectManager;
        if (projectManager?._showSaveToast) {
            projectManager._showSaveToast(message);
        }
    }
}

window.TegakiImageImporter = ImageImporter;
