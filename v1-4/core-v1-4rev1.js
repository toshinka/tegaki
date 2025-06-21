// Toshinka Tegaki Tool core.js 最終安定版
// （transform-origin:center＋逆行列座標変換・Space+ドラッグ/回転/反転/拡縮/移動すべて対応）

// --- 2D行列の合成・逆行列・座標適用 ---
function multiplyMatrix(a, b) {
    return [
        a[0]*b[0] + a[2]*b[1],               // m00
        a[1]*b[0] + a[3]*b[1],               // m10
        a[0]*b[2] + a[2]*b[3],               // m01
        a[1]*b[2] + a[3]*b[3],               // m11
        a[0]*b[4] + a[2]*b[5] + a[4],        // m02
        a[1]*b[4] + a[3]*b[5] + a[5],        // m12
    ];
}
function invertMatrix(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det === 0) return null;
    const invDet = 1 / det;
    return [
        m[3]*invDet,
        -m[1]*invDet,
        -m[2]*invDet,
        m[0]*invDet,
        (m[2]*m[5] - m[3]*m[4])*invDet,
        (m[1]*m[4] - m[0]*m[5])*invDet
    ];
}
function applyMatrix(m, x, y) {
    return {
        x: m[0]*x + m[2]*y + m[4],
        y: m[1]*x + m[3]*y + m[5],
    };
}

// --- CanvasManager ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = null;
        this.ctx = null;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.frameCanvas = null;

        this.isDrawing = false;
        this.isPanning = false;
        // this.isLayerMoving = false; // ← isLayerTransforming に役割を統合します
        this.isLayerTransforming = false; // レイヤー変形操作中かどうかのフラグ
        this.isSpaceDown = false;
        this.isVDown = false;
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null; // 変形前のオリジナル画像データを保持
        this.wheelTimeout = null;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;

        // ↓ 新しく追加
        this.layerTransform = { // 現在の変形パラメータを保持するオブジェクト
            translateX: 0,
            translateY: 0,
            scale: 1,
            rotation: 0, // 角度はラジアンで管理します
        };

        // キャンバス全体の見た目transform値
        this.transform = {
            scale: 1,
            rotation: 0,
            flipX: 1,
            flipY: 1,
            left: 0,
            top: 0
        };
        // 強制transform初期化（デバッグ用・リセット防止）
        this.transform.scale = 1;
        this.transform.rotation = 0;
        this.transform.flipX = 1;
        this.transform.flipY = 1;
        this.transform.left = 0;
        this.transform.top = 0;

        this.createAndDrawFrame();
        this.bindEvents();
    }

    createAndDrawFrame() {
        // 額縁キャンバス
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '-10px';
        this.frameCanvas.style.top = '-5px';
        this.frameCanvas.style.zIndex = '-1';
        this.frameCanvas.style.pointerEvents = 'none';
        const firstLayer = this.canvasContainer.querySelector('.main-canvas');
        this.canvasContainer.insertBefore(this.frameCanvas, firstLayer);
        const frameCtx = this.frameCanvas.getContext('2d');
        frameCtx.fillStyle = '#ffffff';
        frameCtx.strokeStyle = '#cccccc';
        frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        if (frameCtx.roundRect) {
            frameCtx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        } else {
            frameCtx.rect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1);
        }
        frameCtx.fill();
        frameCtx.stroke();
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setActiveLayerContext(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.updateCursor();
    }
    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvasStartX = this.transform.left;
            this.canvasStartY = this.transform.top;
            this.isPanning = true;
            e.preventDefault();
            return;
        }
        if (this.isVDown && this.canvas && e.target === this.canvas) {
            this.startLayerTransform(); // ★変形処理を開始

            const coords = this.getCanvasCoordinates(e);
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
        
            e.preventDefault();
            return;
        }
        if (!this.canvas || e.target !== this.canvas) return;
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.left = this.canvasStartX + dx;
            this.transform.top = this.canvasStartY + dy;
            this.applyTransform();
        }
        else if (this.isLayerTransforming && e.buttons) { // e.buttonsでドラッグ中かを判定
            const coords = this.getCanvasCoordinates(e);
            // 移動量を計算して変形パラメータを更新
            this.layerTransform.translateX = Math.round(coords.x - this.moveLayerStartX);
            this.layerTransform.translateY = Math.round(coords.y - this.moveLayerStartY);

            // プレビューを更新
            this.applyLayerTransformPreview();
        }
        else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            const currentX = coords.x;
            const currentY = coords.y;
            this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentSize;
            this.ctx.lineTo(currentX, currentY);
            this.ctx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
        }
    }

    onPointerUp(e) {
        try {
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isLayerTransforming) {
            this.commitLayerTransform(); // ★変形を確定させる
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
    }

    // --- 逆行列対応完全版 ---
    getCanvasCoordinates(e) {
        const containerRect = this.canvas.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;

        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;

        const rad = -this.transform.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;

        let scaleX = this.transform.scale * this.transform.flipX;
        let scaleY = this.transform.scale * this.transform.flipY;
        const unscaledX = unrotatedX / scaleX;
        const unscaledY = unrotatedY / scaleY;

        const canvasX = unscaledX + this.canvas.width / 2;
        const canvasY = unscaledY + this.canvas.height / 2;

        return { x: canvasX, y: canvasY };
    }

    updateCursor() {
        if (!this.canvas) return;
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            this.canvas.style.cursor = 'grab';
            return;
        }
        if (this.isVDown) {
            this.canvas.style.cursor = 'move';
            this.canvasArea.style.cursor = 'default';
            return;
        }
        this.canvasArea.style.cursor = 'default';
        this.canvas.style.cursor = 'crosshair';
    }

    applyTransform() {
        this.canvasContainer.style.transformOrigin = "center";
        this.canvasContainer.style.transform =
            `translate(${this.transform.left}px, ${this.transform.top}px) ` +
            `scale(${this.transform.scale}, ${this.transform.scale}) ` +
            `rotate(${this.transform.rotation}deg) ` +
            `scale(${this.transform.flipX}, ${this.transform.flipY})`;
    }

    startLayerTransform() {
        if (this.isLayerTransforming || !this.ctx) return;

        this.isLayerTransforming = true;
        this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0 };

        // プレビュー表示のために、元レイヤーの絵を一旦消しておきます
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    applyLayerTransformPreview() {
        if (!this.isLayerTransforming || !this.moveLayerImageData) return;

        const ctx = this.ctx;
        const canvas = this.canvas;

        // オリジナル画像を一時的な別キャンバスに用意します
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').putImageData(this.moveLayerImageData, 0, 0);

        // アクティブレイヤーをクリアして、変形した絵を描画し直します
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); // 現在の描画設定を一時保存

        // --- ここからが変形処理の心臓部です ---
        // 1. 変形の中心をキャンバス中央に移動
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // 2. パラメータに従って、移動・回転・スケールを実行
        ctx.translate(this.layerTransform.translateX, this.layerTransform.translateY);
        ctx.rotate(this.layerTransform.rotation); // 角度はラジアン
        ctx.scale(this.layerTransform.scale, this.layerTransform.scale);
        // 3. 描画の基準点を元の左上に戻す
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        // ------------------------------------

        // 変形された状態で、一時キャンバス（＝オリジナル画像）を描画します
        ctx.drawImage(tempCanvas, 0, 0);

        ctx.restore(); // 保存しておいた描画設定を元に戻す
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;

        // プレビューが既にキャンバスに描かれているので、
        // ここでは変形モードを終了し、アンドゥ履歴に保存するだけでOKです。
        this.isLayerTransforming = false;
        this.moveLayerImageData = null; // 記憶していたオリジナル画像は不要になるので解放
        this.saveState(); // 現在のキャンバスの状態を履歴に保存
    }

    saveState() {
        if (!this.ctx) return;
        // 現在のレイヤーの画像データを履歴に保存する
        // レイヤーごとに履歴を持つ場合は、LayerManager内で管理するように変更が必要
        // 今回は簡略化のため、アクティブレイヤーの変更がundo/redoに影響しないよう、全レイヤーの描画状態を保存する
        // ただし、これだとレイヤー操作（追加・削除・複製・合成）がundo/redoの対象にならない
        // より正確なundo/redoを実現するには、レイヤー構造の変更も履歴に含める必要があるが、今回はスコープ外
        const currentState = this.app.layerManager.layers.map(layer => 
            layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)
        );

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(currentState);
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    restoreState(state) {
        // 保存された全レイヤーの画像データを復元する
        this.app.layerManager.layers.forEach((layer, index) => {
            if (state[index]) {
                layer.ctx.putImageData(state[index], 0, 0);
            }
        });
    }

    clearCanvas() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // レイヤー0の場合は背景色で塗りつぶし直す
            if (this.app.layerManager.activeLayerIndex === 0) {
                this.ctx.fillStyle = '#f0e0d6';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this.saveState();
        }
    }

    clearAllLayers() {
        if (!this.app.layerManager || !this.app.layerManager.layers) return;
        this.app.layerManager.layers.forEach((layer, index) => {
            const lw = layer.canvas.width;
            const lh = layer.canvas.height;
            layer.ctx.clearRect(0, 0, lw, lh);
            if (index === 0) { // 背景レイヤーのみ背景色で塗りつぶす
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, lw, lh);
            }
        });
        this.saveState(); // 全クリアも履歴に保存
    }

    flipHorizontal() {
        this.transform.flipX *= -1;
        this.normalizeTransform();
        this.applyTransform();
    }

    flipVertical() {
        this.transform.flipY *= -1;
        this.normalizeTransform();
        this.applyTransform();
    }

    zoom(factor) {
        this.transform.scale = Math.max(0.1, Math.min(this.transform.scale * factor, 10));
        this.applyTransform();
    }

    rotate(degrees) {
        this.transform.rotation = (this.transform.rotation + degrees) % 360;
        this.normalizeTransform();
        this.applyTransform();
    }

    normalizeTransform() {
        this.transform.rotation = ((this.transform.rotation % 360) + 360) % 360;

        this.transform.flipX = this.transform.flipX >= 0 ? 1 : -1;
        this.transform.flipY = this.transform.flipY >= 0 ? 1 : -1;

        if (this.transform.flipX === -1 && this.transform.flipY === -1) {
            this.transform.rotation = (this.transform.rotation + 180) % 360;
            this.transform.flipX = 1;
            this.transform.flipY = 1;
        }

        if (Math.abs(this.transform.rotation - 270) < 0.1 && this.transform.flipX === -1) {
            this.transform.rotation = 90;
            this.transform.flipX = 1;
            this.transform.flipY *= -1;
        }

        if (Math.abs(this.transform.rotation - 90) < 0.1 && this.transform.flipX === -1) {
            this.transform.rotation = 270;
            this.transform.flipX = 1;
            this.transform.flipY *= -1;
        }
    }

    resetView() {
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyTransform();
    }

    handleWheel(e) {
        e.preventDefault();

        const now = Date.now();
        if (now - this.lastWheelTime < this.wheelThrottle) {
            return;
        }
        this.lastWheelTime = now;

        let deltaY = e.deltaY;
        if (Math.abs(deltaY) > 100) {
            deltaY = deltaY > 0 ? 100 : -100;
        }
        deltaY = Math.max(-30, Math.min(30, deltaY));

        if (this.isVDown) {
            // 変形操作がまだ開始されていなければ、ここで開始します
            if (!this.isLayerTransforming) {
                this.startLayerTransform();
            }

            if (e.shiftKey) {
                // レイヤー回転
                const degrees = deltaY > 0 ? -5 : 5;
                this.layerTransform.rotation += degrees * Math.PI / 180; // ラジアンに変換して加算
            } else {
                // レイヤー拡大縮小
                const factor = deltaY > 0 ? 0.95 : 1.05;
                this.layerTransform.scale = Math.max(0.1, Math.min(this.layerTransform.scale * factor, 10));
            }
            this.applyLayerTransformPreview(); // プレビュー更新
        } else {
            // 既存のキャンバス全体の変形処理
            if (e.shiftKey) {
                let degrees;
                if (Math.abs(deltaY) > 20) {
                    degrees = deltaY > 0 ? -10 : 10;
                } else if (Math.abs(deltaY) > 10) {
                    degrees = deltaY > 0 ? -5 : 5;
                } else {
                    degrees = deltaY > 0 ? -2 : 2;
                }
                this.rotate(degrees);
            } else {
                let zoomFactor;
                if (Math.abs(deltaY) > 20) {
                    zoomFactor = deltaY > 0 ? 1.05 : 1 / 1.05;
                } else {
                    zoomFactor = deltaY > 0 ? 1.02 : 1 / 1.02;
                }
                this.zoom(zoomFactor);
            }
        }

        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }
        this.wheelTimeout = setTimeout(() => {
            this.lastWheelTime = 0;
        }, 200);
    }

    colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }
    getPixelColor(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
    }
    setPixelColor(imageData, x, y, color) {
        const i = (y * imageData.width + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
    }
    fill(startX, startY, fillColor) {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], fillRGBA[3]];
        if (this.colorsMatch(startColor, targetFillColor)) return;
        const stack = [[startX, startY]];
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
            const currentColor = this.getPixelColor(imageData, x, y);
            if (this.colorsMatch(currentColor, startColor)) {
                this.setPixelColor(imageData, x, y, targetFillColor);
                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
}

// --- LayerManager (★改修箇所) ---
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasContainer = document.getElementById('canvas-container');
    }

    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) return;

        // レイヤー0 (背景) を設定
        const bgLayer = {
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
            name: '背景'
        };
        this.layers.push(bgLayer);
        const firstLayerCtx = bgLayer.ctx;
        firstLayerCtx.fillStyle = '#f0e0d6'; // 指示された背景色
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);
        
        // レイヤー1 (描画用) を追加
        // addLayer()は新しいレイヤーを追加し、それをアクティブに設定します。
        // すでに switchLayer(1) が呼ばれているので、重複を避けるためにコメントアウトまたは削除します。
        // this.addLayer(); 
        // 以下のように、直接レイヤーを追加し、その後アクティブレイヤーを明示的に設定する形にします。
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        
        // レイヤー0のすぐ上に挿入
        this.canvasContainer.insertBefore(newCanvas, this.layers[0]?.canvas.nextSibling || null);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: `レイヤー ${this.layers.length}`
        };
        
        this.layers.push(newLayer); // レイヤー配列の最後に新しいレイヤーを追加

        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        
        this.updateAllLayerZIndexes(); // Z-indexを更新
        this.renameLayers(); // レイヤー名をインデックスに合わせて更新
        this.switchLayer(1); // 明示的にレイヤー1をアクティブにする
        this.app.canvasManager.saveState(); // 初期状態を履歴に保存
    }

    addLayer() {
        if (this.layers.length >= 99) { // レイヤー上限を仮で設定
            alert("レイヤー数の上限に達しました。");
            return null;
        }

        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        
        // 新しいレイヤーはアクティブレイヤーのすぐ上に挿入
        const insertIndex = this.activeLayerIndex + 1;
        // DOM上でも正しい位置に挿入する
        this.canvasContainer.insertBefore(newCanvas, this.layers[insertIndex]?.canvas || null);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: `レイヤー ${this.layers.length}` // 一時的な名前
        };
        
        this.layers.splice(insertIndex, 0, newLayer);
        
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        
        this.updateAllLayerZIndexes();
        this.renameLayers(); // レイヤー名をインデックスに合わせて更新
        this.switchLayer(insertIndex); // 新しく追加したレイヤーをアクティブに
        this.app.canvasManager.saveState(); // レイヤー追加も履歴に
        return newLayer;
    }

    deleteActiveLayer() {
        const indexToDelete = this.activeLayerIndex;

        if (indexToDelete === 0) {
            alert('背景レイヤーは削除できません。');
            return;
        }
        if (indexToDelete < 0 || indexToDelete >= this.layers.length) return;

        // DOMからcanvasを削除
        const layerToRemove = this.layers[indexToDelete];
        this.canvasContainer.removeChild(layerToRemove.canvas);

        // 配列から削除
        this.layers.splice(indexToDelete, 1);
        
        this.renameLayers(); // レイヤー名を更新

        // 新しいアクティブレイヤーのインデックスを決定
        // 削除されたレイヤーの一つ上、なければ一つ下のレイヤー（レイヤー0は除く）
        let newActiveIndex = indexToDelete - 1;
        if (newActiveIndex < 0) { // 削除したのがレイヤー1で、残りが背景だけの場合
            newActiveIndex = 0; // 背景レイヤーをアクティブにする
        } else if (newActiveIndex === 0 && this.layers.length > 1) { // 背景をアクティブにしない場合は、次のレイヤー
            newActiveIndex = 1; // 背景の次のレイヤー
        }
        
        this.updateAllLayerZIndexes();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.saveState(); // レイヤー削除も履歴に
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;

        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';

        // アクティブレイヤーのすぐ上に挿入
        const insertIndex = this.activeLayerIndex + 1;
        this.canvasContainer.insertBefore(newCanvas, this.layers[insertIndex]?.canvas || null);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: `レイヤー ${this.layers.length}` // 一時的な名前
        };
        this.layers.splice(insertIndex, 0, newLayer);

        // 元のレイヤーの内容を新しいレイヤーにコピー
        newLayer.ctx.drawImage(activeLayer.canvas, 0, 0);

        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';

        this.updateAllLayerZIndexes();
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState(); // レイヤー複製も履歴に
    }

    mergeDownActiveLayer() {
        const activeIndex = this.activeLayerIndex;
        // レイヤー0（背景）またはレイヤー1（アクティブレイヤーが一つしかない場合）は合成不可
        if (activeIndex === 0 || this.layers.length <= 1) {
            alert('背景レイヤーは合成できません。または、合成できるレイヤーがありません。');
            return;
        }

        const activeLayer = this.layers[activeIndex];
        const targetLayer = this.layers[activeIndex - 1]; // 直下のレイヤー

        if (!activeLayer || !targetLayer) return;

        // 直下のレイヤーにアクティブレイヤーの内容を描画
        targetLayer.ctx.drawImage(activeLayer.canvas, 0, 0);

        // アクティブレイヤーを削除
        // deleteActiveLayerは履歴に保存するので、ここではsaveStateを呼ばない
        this.deleteActiveLayer(); 
        // deleteActiveLayer内でswitchLayerとrenameLayersが呼ばれるため、ここでは不要
        // ただし、deleteActiveLayerのsaveStateが呼ばれるため、mergeDownの操作自体が履歴に残る
    }

    // レイヤー名をインデックスに合わせて再設定する
    renameLayers() {
        this.layers.forEach((layer, index) => {
            if (index === 0) {
                layer.name = '背景';
            } else {
                layer.name = `レイヤー ${index}`;
            }
        });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
            this.layers.forEach((layer, i) => {
                layer.canvas.style.pointerEvents = (i === index) ? 'auto' : 'none';
            });
            // UIマネージャーにUI更新を依頼する
            if (this.app.layerUIManager) {
                this.app.layerUIManager.renderLayers();
            }
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }
}


// --- PenSettingsManager, ColorManager, ToolManager, ToshinkaTegakiTool（ここから下は変更ありません） ---
class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);

        this.bindEvents();
        this.updateSizeButtonVisuals();
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
    }
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize);
        this.updateSizeButtonVisuals();
    }
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }
    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            const sizeDot = btn.querySelector('.size-dot');
            const sizeNumber = btn.querySelector('.size-number');
            if (sizeDot) {
                const dotSize = Math.min(size, 16);
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
            }
            if (sizeNumber) {
                sizeNumber.textContent = size;
            }
        });
    }
}
class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);

        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');

        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }
}
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
        this.app.canvasManager.updateCursor();
    }
    getCurrentTool() {
        return this.currentTool;
    }
}
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.penSettingsManager = null;
        this.layerManager = null;
        this.layerUIManager = null; // UI Managerを追加
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.layerManager.setupInitialLayers();
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        // this.canvasManager.saveState(); // 初期化時にsaveStateを呼ぶのはsetupInitialLayersの後で良い
    }
}
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        // 初期状態の保存を確実にするため、ここで一度saveStateを呼ぶ
        window.toshinkaTegakiTool.canvasManager.saveState(); 
    }
});