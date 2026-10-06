/** ROLE: Display-only replacement for a committed tone while QTP edits its recipe.
 * AUTHORITY: TonePanel supplies pixels. No layerData, texture authority or History writes.
 * CAPTURE: Existing preview registry reveals the source and excludes this transient Sprite.
 * LIFETIME: End before update, external content/selection changes, popup/tab hide or destroy.
 */
import { Sprite, Texture } from 'pixi.js';
import { hideLetteringPreviewSource, restoreLetteringPreviewSource } from '../system/lettering-preview-display.js';

export class ToneDraftDisplay {
    constructor(layerSystem) {
        this.layerSystem = layerSystem;
        this.layer = null;
        this.sprite = null;
    }

    show(layer, raster) {
        this.clear();
        const source = layer?.layerData?.layerSprite;
        if (!source || source.destroyed || !raster?.ok) return false;
        const canvas = document.createElement('canvas');
        canvas.width = raster.width; canvas.height = raster.height;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(raster.pixels), raster.width, raster.height), 0, 0);
        const sprite = new Sprite(Texture.from(canvas));
        sprite.label = 'tone_draft_display';
        sprite.position.set(raster.rasterBounds?.x || 0, raster.rasterBounds?.y || 0);
        sprite.blendMode = source.blendMode;
        sprite.visible = source.visible;
        const mask = layer.layerData.clippingMaskSprite;
        if (mask) this.layerSystem._setClippingMask(sprite, mask, layer.layerData.clippingMode === 'inverse');
        layer.addChildAt(sprite, layer.getChildIndex(source) + 1);
        this.layer = layer; this.sprite = sprite;
        if (!hideLetteringPreviewSource(layer, () => this.layerSystem._folderCompositor?.markDirty?.(), sprite)) {
            this.clear(); return false;
        }
        return true;
    }

    clear() {
        if (this.layer) restoreLetteringPreviewSource(this.layer);
        if (this.sprite && !this.sprite.destroyed) {
            this.sprite.mask = null;
            this.sprite.destroy({ texture: true, textureSource: true });
        }
        this.layer = null; this.sprite = null;
        this.layerSystem?._folderCompositor?.markDirty?.();
    }
}
