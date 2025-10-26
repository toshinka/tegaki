/**
 * timeline-thumbnail-utils.js - FRAME改修版
 * タイムラインサムネイル管理ユーティリティ
 * ✅ CUT→FRAME変換完了
 */

class TimelineThumbnailUtils {
  constructor(app, coordinateSystem, animationSystem) {
    this.app = app;
    this.coordinateSystem = coordinateSystem;
    this.animationSystem = animationSystem;
    this.thumbnailCache = new Map();
  }

  generateThumbnail(frame) {
    const cacheKey = `${frame.id}_${frame.canvasWidth}_${frame.canvasHeight}`;
    
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey);
    }

    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: true 
    });

    const canvasW = frame.canvasWidth;
    const canvasH = frame.canvasHeight;
    const aspectRatio = canvasW / canvasH;

    const maxThumbW = 150;
    const maxThumbH = 150;

    let thumbW, thumbH;
    if (aspectRatio > 1) {
      thumbW = maxThumbW;
      thumbH = maxThumbW / aspectRatio;
    } else {
      thumbH = maxThumbH;
      thumbW = maxThumbH * aspectRatio;
    }

    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;

    const tempContainer = new PIXI.Container();

    frame.layers.forEach(layerData => {
      if (!layerData.visible) return;
      
      const layerCopy = new PIXI.Container();
      layerCopy.alpha = layerData.opacity;

      layerData.children.forEach(child => {
        const cloned = this._cloneGraphics(child);
        if (cloned) {
          layerCopy.addChild(cloned);
        }
      });

      tempContainer.addChild(layerCopy);
    });

    const renderTexture = PIXI.RenderTexture.create({
      width: canvasW,
      height: canvasH,
      resolution: 1
    });

    this.app.renderer.render({
      container: tempContainer,
      target: renderTexture
    });

    const pixels = this.app.renderer.extract.pixels(renderTexture);
    const imageData = new ImageData(
      new Uint8ClampedArray(pixels.buffer),
      canvasW,
      canvasH
    );

    const scaleX = thumbW / canvasW;
    const scaleY = thumbH / canvasH;

    thumbCtx.imageSmoothingEnabled = true;
    thumbCtx.imageSmoothingQuality = 'high';
    
    const tempFullCanvas = document.createElement('canvas');
    tempFullCanvas.width = canvasW;
    tempFullCanvas.height = canvasH;
    const tempFullCtx = tempFullCanvas.getContext('2d');
    tempFullCtx.putImageData(imageData, 0, 0);

    thumbCtx.drawImage(tempFullCanvas, 0, 0, canvasW, canvasH, 0, 0, thumbW, thumbH);

    renderTexture.destroy(true);
    tempContainer.destroy({ children: true });

    const dataURL = thumbCanvas.toDataURL('image/png');
    this.thumbnailCache.set(cacheKey, dataURL);

    return dataURL;
  }

  _cloneGraphics(graphics) {
    if (!graphics || !graphics.geometry) return null;

    const cloned = new PIXI.Graphics();
    
    if (graphics.fillStyle) {
      cloned.fillStyle = { ...graphics.fillStyle };
    }
    if (graphics.lineStyle) {
      cloned.lineStyle = { ...graphics.lineStyle };
    }

    const geom = graphics.geometry;
    if (geom.graphicsData) {
      geom.graphicsData.forEach(data => {
        if (data.fillStyle) {
          cloned.fill(data.fillStyle.color);
        }
        if (data.lineStyle) {
          cloned.stroke({
            width: data.lineStyle.width,
            color: data.lineStyle.color,
            alpha: data.lineStyle.alpha
          });
        }

        if (data.shape) {
          const shape = data.shape;
          if (shape.points) {
            if (shape.points.length >= 4) {
              cloned.moveTo(shape.points[0], shape.points[1]);
              for (let i = 2; i < shape.points.length; i += 2) {
                cloned.lineTo(shape.points[i], shape.points[i + 1]);
              }
            }
          }
        }
      });
    }

    cloned.x = graphics.x;
    cloned.y = graphics.y;
    cloned.rotation = graphics.rotation;
    cloned.scale.set(graphics.scale.x, graphics.scale.y);
    cloned.alpha = graphics.alpha;

    return cloned;
  }

  updateThumbnailForFrame(frameId) {
    const frame = this.animationSystem.cuts.find(c => c.id === frameId);
    if (!frame) return null;

    const oldCacheKeys = Array.from(this.thumbnailCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    oldCacheKeys.forEach(key => this.thumbnailCache.delete(key));

    return this.generateThumbnail(frame);
  }

  updateAllThumbnails() {
    this.animationSystem.cuts.forEach(frame => {
      this.updateThumbnailForFrame(frame.id);
    });
  }

  _invalidateCache() {
    this.thumbnailCache.clear();
  }

  invalidateFrameCache(frameId) {
    const keysToDelete = Array.from(this.thumbnailCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    keysToDelete.forEach(key => this.thumbnailCache.delete(key));
  }

  // 下位互換メソッド（animation-system.jsから呼ばれる可能性があるため）
  static resizeCanvasWithAspect(sourceCanvas, targetWidth, targetHeight) {
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = targetHeight;
    
    const ctx = resultCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const srcAspect = sourceCanvas.width / sourceCanvas.height;
    const dstAspect = targetWidth / targetHeight;
    
    let drawW, drawH, offsetX = 0, offsetY = 0;
    
    if (srcAspect > dstAspect) {
      drawW = targetWidth;
      drawH = targetWidth / srcAspect;
      offsetY = (targetHeight - drawH) / 2;
    } else {
      drawH = targetHeight;
      drawW = targetHeight * srcAspect;
      offsetX = (targetWidth - drawW) / 2;
    }
    
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(
      sourceCanvas,
      0, 0, sourceCanvas.width, sourceCanvas.height,
      offsetX, offsetY, drawW, drawH
    );
    
    return resultCanvas;
  }
}

window.TimelineThumbnailUtils = TimelineThumbnailUtils;
window.TegakiThumbnailUtils = TimelineThumbnailUtils;

console.log('✅ timeline-thumbnail-utils.js (FRAME改修版) loaded');