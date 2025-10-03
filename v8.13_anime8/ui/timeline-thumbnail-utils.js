// ===== ui/timeline-thumbnail-utils.js =====
// タイムライン専用サムネイル生成ユーティリティ
// PixiJS v8.13 対応 - アスペクト比保持・devicePixelRatio考慮
// GPT5案実装: RenderTexture直接生成方式

(function() {
    'use strict';
    
    /**
     * タイムラインサムネイル生成
     * @param {PIXI.Renderer} renderer - PixiJS Renderer
     * @param {PIXI.Container} displayObject - 描画対象Container
     * @param {number} thumbDisplayW - UI表示幅（CSSピクセル）
     * @param {number} thumbDisplayH - UI表示高さ（CSSピクセル）
     * @returns {Object} { canvas, width, height, dpr }
     */
    function createThumbnail(renderer, displayObject, thumbDisplayW, thumbDisplayH) {
        const dpr = window.devicePixelRatio || 1;
        
        // 内部レンダリングサイズ（物理ピクセル）
        const rtWidth = Math.max(1, Math.round(thumbDisplayW * dpr));
        const rtHeight = Math.max(1, Math.round(thumbDisplayH * dpr));
        
        // RenderTexture作成（解像度=1でピクセルサイズ直接指定）
        const renderTexture = PIXI.RenderTexture.create({
            width: rtWidth,
            height: rtHeight,
            scaleMode: PIXI.SCALE_MODES.LINEAR
        });
        
        // 元オブジェクトのサイズ取得
        const bounds = displayObject.getLocalBounds();
        const srcW = bounds.width || 1;
        const srcH = bounds.height || 1;
        
        // アスペクト比保持してスケール計算
        const srcAspect = srcW / srcH;
        const dstAspect = thumbDisplayW / thumbDisplayH;
        
        let scale;
        if (srcAspect > dstAspect) {
            // 横長 -> 幅基準
            scale = (rtWidth / dpr) / srcW;
        } else {
            // 縦長 -> 高さ基準
            scale = (rtHeight / dpr) / srcH;
        }
        
        // 中央配置のオフセット計算
        const scaledW = srcW * scale;
        const scaledH = srcH * scale;
        const offsetX = (thumbDisplayW - scaledW) / 2;
        const offsetY = (thumbDisplayH - scaledH) / 2;
        
        // 一時コンテナ作成（transform分離のため）
        const tmpContainer = new PIXI.Container();
        
        // displayObjectをクローン or Sprite化
        let childToRender;
        if (displayObject.texture) {
            childToRender = new PIXI.Sprite(displayObject.texture);
        } else {
            // Containerの場合は直接配置（副作用注意）
            childToRender = displayObject;
        }
        
        // DPR補正したtransform設定
        childToRender.position.set(offsetX * dpr, offsetY * dpr);
        childToRender.scale.set(scale * dpr, scale * dpr);
        
        tmpContainer.addChild(childToRender);
        
        // RenderTextureにレンダリング
        renderer.render({
            container: tmpContainer,
            target: renderTexture,
            clear: true
        });
        
        // Canvas抽出（extract plugin使用）
        const canvas = renderer.extract.canvas(renderTexture);
        
        // クリーンアップ
        tmpContainer.removeChild(childToRender);
        tmpContainer.destroy({ children: false });
        renderTexture.destroy(true);
        
        return {
            canvas: canvas,
            width: rtWidth,
            height: rtHeight,
            dpr: dpr
        };
    }
    
    /**
     * Canvas2Dを使った最終縮小（互換性用）
     * @param {HTMLCanvasElement} sourceCanvas 
     * @param {number} targetW 
     * @param {number} targetH 
     * @returns {HTMLCanvasElement}
     */
    function resizeCanvasWithAspect(sourceCanvas, targetW, targetH) {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // アスペクト比保持
        const srcAspect = sourceCanvas.width / sourceCanvas.height;
        const dstAspect = targetW / targetH;
        
        let drawW, drawH, offsetX = 0, offsetY = 0;
        
        if (srcAspect > dstAspect) {
            drawW = targetW;
            drawH = targetW / srcAspect;
            offsetY = (targetH - drawH) / 2;
        } else {
            drawH = targetH;
            drawW = targetH * srcAspect;
            offsetX = (targetW - drawW) / 2;
        }
        
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height,
                      offsetX, offsetY, drawW, drawH);
        
        return canvas;
    }
    
    // グローバル公開
    window.TegakiThumbnailUtils = {
        createThumbnail,
        resizeCanvasWithAspect
    };
    
})();