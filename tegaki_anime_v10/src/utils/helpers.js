// ========================================
// helpers.js - ユーティリティ関数
// ========================================

(function() {
    'use strict';
    
    // ImageData のディープコピー
    function cloneImageData(ctx, imageData) {
        const cloned = ctx.createImageData(imageData.width, imageData.height);
        cloned.data.set(imageData.data);
        return cloned;
    }
    
    // ImageData を透明で初期化
    function createEmptyImageData(ctx, width, height) {
        return ctx.createImageData(width, height);
    }
    
    // ImageData を指定色で塗りつぶし
    function fillImageData(imageData, color) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        }
        
        return imageData;
    }
    
    // RGB色の比較
    function colorMatch(data, index, targetColor, tolerance = 0) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        return Math.abs(r - targetColor.r) <= tolerance &&
               Math.abs(g - targetColor.g) <= tolerance &&
               Math.abs(b - targetColor.b) <= tolerance;
    }
    
    // Hex色をRGBオブジェクトに変換
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    
    // RGB色のハッシュ化（比較用）
    function rgbHash(r, g, b) {
        return (r << 16) | (g << 8) | b;
    }
    
    // フラッドフィル（バケツツール）
    function floodFill(imageData, startX, startY, fillColor) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        const startIndex = (startY * width + startX) * 4;
        const targetColor = {
            r: data[startIndex],
            g: data[startIndex + 1],
            b: data[startIndex + 2]
        };
        
        const fillRgb = hexToRgb(fillColor);
        
        // 同じ色の場合は何もしない
        if (targetColor.r === fillRgb.r && 
            targetColor.g === fillRgb.g && 
            targetColor.b === fillRgb.b) {
            return;
        }
        
        const targetHash = rgbHash(targetColor.r, targetColor.g, targetColor.b);
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const key = y * width + x;
            if (visited.has(key)) continue;
            visited.add(key);
            
            const index = key * 4;
            const currentHash = rgbHash(data[index], data[index + 1], data[index + 2]);
            
            if (currentHash !== targetHash) continue;
            
            // ピクセルを塗りつぶし
            data[index] = fillRgb.r;
            data[index + 1] = fillRgb.g;
            data[index + 2] = fillRgb.b;
            data[index + 3] = 255;
            
            // 4方向に探索
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
    }
    
    // キャンバス座標からマウス座標への変換
    function getCanvasCoordinates(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    // 2つの ImageData を合成
    function compositeImageData(ctx, base, overlay) {
        const result = cloneImageData(ctx, base);
        const resultData = result.data;
        const overlayData = overlay.data;
        
        for (let i = 0; i < resultData.length; i += 4) {
            const alpha = overlayData[i + 3] / 255;
            
            if (alpha > 0) {
                resultData[i] = Math.round(overlayData[i] * alpha + resultData[i] * (1 - alpha));
                resultData[i + 1] = Math.round(overlayData[i + 1] * alpha + resultData[i + 1] * (1 - alpha));
                resultData[i + 2] = Math.round(overlayData[i + 2] * alpha + resultData[i + 2] * (1 - alpha));
                resultData[i + 3] = Math.round(255 * (alpha + (resultData[i + 3] / 255) * (1 - alpha)));
            }
        }
        
        return result;
    }
    
    // Base64からBlobへ変換
    function base64ToBlob(base64, mimeType) {
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        return new Blob([ab], { type: mimeType });
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.TegakiHelpers = {
            cloneImageData,
            createEmptyImageData,
            fillImageData,
            colorMatch,
            hexToRgb,
            rgbHash,
            floodFill,
            getCanvasCoordinates,
            compositeImageData,
            base64ToBlob
        };
        console.log('✅ TegakiHelpers loaded');
    }
})();