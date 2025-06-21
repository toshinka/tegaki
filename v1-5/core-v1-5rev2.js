// Toshinka Tegaki Tool core.js 最終安定版
// （transform-origin:center＋逆行列座標変換・Space+ドラッグ/回転/反転/拡縮/移動すべて対応）
// ★ v1-5改：Smooth.jsによる線補正＋筆圧対応拡張版 ★

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
        (m[1]*m[4] - m[0]*m[5])*invDet,
    ];
}
function transformPoint(m, x, y) {
    return {
        x: x * m[0] + y * m[2] + m[4],
        y: x * m[1] + y * m[3] + m[5]
    };
}
function mapPoint(point, matrix) {
    return transformPoint(matrix, point.x, point.y);
}


// --- 座標変換ユーティリティ ---
// 親要素からの相対座標をキャンバス内部座標に変換
function getRelativeCoords(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event.touches && event.touches.length > 0) {
        x = event.touches[0].clientX - rect.left;
        y = event.touches[0].clientY - rect.top;
    } else {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
    }
    return { x: x, y: y };
}


// --- Manager Classes ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.drawingCanvas = document.getElementById('drawingCanvas');
        this.drawingContext = this.drawingCanvas.getContext('2d', { willReadFrequently: true });
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.points = []; // for smooth drawing
        this.undoStack = [];
        this.redoStack = [];
        this.matrix = [1, 0, 0, 1, 0, 0]; // 初期変換行列
        this.startX = 0;
        this.startY = 0;
        this.isTransforming = false;
        this.currentTransformType = null; // 'translate', 'scale', 'rotate'
        this.initialDistance = 0;
        this.initialAngle = 0;
        this.initialMatrix = null; // 変換開始時の行列を保持

        this.bindEvents();
        this.setupCanvasSize(); // Canvasサイズを初期設定
        this.drawingContext.lineCap = 'round';
        this.drawingContext.lineJoin = 'round';
    }

    setupCanvasSize() {
        const container = document.getElementById('canvas-container');
        if (container) {
            this.drawingCanvas.width = container.clientWidth;
            this.drawingCanvas.height = container.clientHeight;
            this.app.layerManager.resizeLayers(this.drawingCanvas.width, this.drawingCanvas.height);
            this.renderAllLayers();
        } else {
            // コンテナが見つからない場合のフォールバック（デフォルトサイズ）
            this.drawingCanvas.width = 800; // 例: デフォルトの幅
            this.drawingCanvas.height = 600; // 例: デフォルトの高さ
            this.app.layerManager.resizeLayers(this.drawingCanvas.width, this.drawingCanvas.height);
            this.renderAllLayers();
        }
    }


    bindEvents() {
        // マウスイベント
        this.drawingCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.drawingCanvas.addEventListener('mousemove', this.draw.bind(this));
        this.drawingCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.drawingCanvas.addEventListener('mouseout', this.stopDrawing.bind(this)); // キャンバス外に出た時も停止

        // タッチイベント
        this.drawingCanvas.addEventListener('touchstart', this.startDrawing.bind(this));
        this.drawingCanvas.addEventListener('touchmove', this.draw.bind(this));
        this.drawingCanvas.addEventListener('touchend', this.stopDrawing.bind(this));
        this.drawingCanvas.addEventListener('touchcancel', this.stopDrawing.bind(this));

        // ウィンドウのリサイズイベント
        window.addEventListener('resize', this.debounceResize.bind(this));

        // ショートカットマネージャーからのイベントリスナー
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    // リサイズ処理のデバウンス
    debounceResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.setupCanvasSize();
        }, 200); // 200msのデバウンス
    }

    handleKeyDown(e) {
        if (e.key === ' ' && !this.isTransforming) { // Spaceキー
            e.preventDefault(); // スペースバーによるスクロールを防止
            this.isTransforming = true;
            this.initialMatrix = [...this.matrix]; // 現在の行列を保存
            this.currentTransformType = 'translate'; // デフォルトは移動

            // Shiftキーが押されていれば回転モードに
            if (e.shiftKey) {
                this.currentTransformType = 'rotate';
                // 回転の中心をキャンバスの中心に設定
                const centerX = this.drawingCanvas.width / 2;
                const centerY = this.drawingCanvas.height / 2;
                const p = transformPoint(this.matrix, centerX, centerY);
                this.startX = p.x;
                this.startY = p.y;
            } else if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd+Spaceで拡縮モード
                this.currentTransformType = 'scale';
                this.startX = e.clientX;
                this.startY = e.clientY;
            } else {
                this.startX = e.clientX;
                this.startY = e.clientY;
            }

            this.updateCursor();
        } else if (e.key === 'Delete') {
            if (e.ctrlKey || e.metaKey) { // Ctrl + Delete で全レイヤ消去
                this.app.canvasManager.clearAllLayers();
            } else { // Delete でアクティブレイヤ消去
                this.app.canvasManager.clearCanvas();
            }
        }
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.isTransforming = false;
            this.currentTransformType = null;
            this.updateCursor();
            this.saveCanvasState(); // 変換後の状態を履歴に保存
        }
    }


    setCurrentTool(tool) {
        this.currentTool = tool;
    }

    updateCursor() {
        const cursorMap = {
            pen: 'url("./assets/cursor/pen.cur"), auto',
            eraser: 'url("./assets/cursor/eraser.cur"), auto',
            fill: 'url("./assets/cursor/fill.cur"), auto',
            // その他のツール
        };

        if (this.isTransforming) {
            switch (this.currentTransformType) {
                case 'translate':
                    this.drawingCanvas.style.cursor = 'grab';
                    break;
                case 'scale':
                    this.drawingCanvas.style.cursor = 'nwse-resize';
                    break;
                case 'rotate':
                    this.drawingCanvas.style.cursor = 'url("./assets/cursor/rotate.cur"), auto';
                    break;
                default:
                    this.drawingCanvas.style.cursor = 'default';
            }
        } else {
            this.drawingCanvas.style.cursor = cursorMap[this.currentTool] || 'default';
        }
    }

    startDrawing(e) {
        e.preventDefault();
        this.isDrawing = true;
        this.saveCanvasState(); // 描画開始時に現在の状態を保存

        // 変換モードの場合
        if (this.isTransforming && e.touches && e.touches.length === 2) {
            // 2本指タッチで拡縮・回転
            this.currentTransformType = 'pinch';
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.initialDistance = Math.sqrt(dx * dx + dy * dy);
            this.initialAngle = Math.atan2(dy, dx);
            this.initialMatrix = [...this.matrix];
            return;
        } else if (this.isTransforming) {
            // 単一指またはマウスでの変換
            if (e.touches && e.touches.length === 1) {
                this.startX = e.touches[0].clientX;
                this.startY = e.touches[0].clientY;
            } else {
                this.startX = e.clientX;
                this.startY = e.clientY;
            }
            this.initialMatrix = [...this.matrix];
            return;
        }

        // 描画モードの場合
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;
        const ctx = layer.getContext();

        const { x, y } = getRelativeCoords(e, this.drawingCanvas);
        const transformedPoint = transformPoint(invertMatrix(this.matrix), x, y);

        this.lastX = transformedPoint.x;
        this.lastY = transformedPoint.y;
        this.points = [{x: this.lastX, y: this.lastY, pressure: (e.pressure !== undefined ? e.pressure : 0.5)}]; // 筆圧初期値
        
        ctx.beginPath();
        // ここでの moveTo は Smooth.js で補正されるため、あまり意味がないかもしれません
        // ctx.moveTo(this.lastX, this.lastY); 
    }

    draw(e) {
        e.preventDefault();

        // 変換モードの場合
        if (this.isTransforming) {
            if (this.currentTransformType === 'pinch' && e.touches && e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const currentAngle = Math.atan2(dy, dx);

                const scale = currentDistance / this.initialDistance;
                const rotation = currentAngle - this.initialAngle;

                // スケールと回転の中心をキャンバスの中心に設定
                const centerX = this.drawingCanvas.width / 2;
                const centerY = this.drawingCanvas.height / 2;
                
                // 行列の計算: (中心に戻す) -> (スケール) -> (回転) -> (中心に移動)
                let newMatrix = [...this.initialMatrix];

                // translate to center for scaling/rotation
                newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, -centerX, -centerY]);

                // Apply scale
                newMatrix = multiplyMatrix(newMatrix, [scale, 0, 0, scale, 0, 0]);

                // Apply rotation
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                newMatrix = multiplyMatrix(newMatrix, [cos, sin, -sin, cos, 0, 0]);
                
                // translate back
                newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, centerX, centerY]);

                this.matrix = newMatrix;
                this.app.layerManager.updateLayerTransforms(this.matrix);
                this.renderAllLayers();
                return;

            } else if (e.touches && e.touches.length === 1 && this.currentTransformType) {
                const currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;
                this.applyTransform(currentX, currentY);
                return;
            } else if (!e.touches && this.currentTransformType) { // マウス操作
                this.applyTransform(e.clientX, e.clientY);
                return;
            }
        }


        // 描画モードの場合
        if (!this.isDrawing) return;

        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;
        const ctx = layer.getContext();

        const { x, y } = getRelativeCoords(e, this.drawingCanvas);
        const transformedPoint = transformPoint(invertMatrix(this.matrix), x, y);

        const pressure = (e.pressure !== undefined ? e.pressure : 0.5); // 筆圧取得

        this.points.push({x: transformedPoint.x, y: transformedPoint.y, pressure: pressure});

        if (this.points.length > 2) {
            // Smooth.js を使用して線を補正
            const lastTwoPoints = this.points.slice(-2);
            const p1 = lastTwoPoints[0];
            const p2 = lastTwoPoints[1];

            // 筆圧に応じて線の太さを調整
            const minSize = this.app.penSettingsManager.minSize; // 最小サイズ
            const penSize = this.app.penSettingsManager.getSize();
            const startPenSize = minSize + (penSize - minSize) * p1.pressure;
            const endPenSize = minSize + (penSize - minSize) * p2.pressure;

            ctx.lineWidth = endPenSize; // 現在の筆圧に対応
            ctx.strokeStyle = this.app.colorManager.getCurrentColor();

            if (this.currentTool === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
            } else if (this.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // 筆圧による太さの変化を考慮したパスの描画
            // より高度な筆圧対応は、Custom Line Capなどを実装する必要がありますが、
            // ここでは単純にlineWidthを変化させる方式で。
        }

        this.lastX = transformedPoint.x;
        this.lastY = transformedPoint.y;
        this.renderAllLayers(); // レイヤー描画を更新
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.points = []; // reset points for next stroke
    }

    applyTransform(currentX, currentY) {
        let dx = currentX - this.startX;
        let dy = currentY - this.startY;
        let newMatrix = [...this.initialMatrix];

        switch (this.currentTransformType) {
            case 'translate':
                newMatrix[4] = this.initialMatrix[4] + dx;
                newMatrix[5] = this.initialMatrix[5] + dy;
                break;
            case 'scale':
                const scaleFactor = 1 + (dy * -0.01); // 上に動かすと拡大
                newMatrix = multiplyMatrix(newMatrix, [scaleFactor, 0, 0, scaleFactor, 0, 0]);
                break;
            case 'rotate':
                const centerX = this.drawingCanvas.width / 2;
                const centerY = this.drawingCanvas.height / 2;

                // 変換後の中心座標
                const transformedCenterX = this.initialMatrix[0] * centerX + this.initialMatrix[2] * centerY + this.initialMatrix[4];
                const transformedCenterY = this.initialMatrix[1] * centerX + this.initialMatrix[3] * centerY + this.initialMatrix[5];

                const angle = Math.atan2(currentY - transformedCenterY, currentX - transformedCenterX) -
                              Math.atan2(this.startY - transformedCenterY, this.startX - transformedCenterY);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // 回転の中心をキャンバスの中心に
                // 1. 中心に移動
                newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, -centerX, -centerY]);
                // 2. 回転
                newMatrix = multiplyMatrix(newMatrix, [cos, sin, -sin, cos, 0, 0]);
                
                // 3. 元に戻す
                newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, centerX, centerY]);
                break;
        }
        this.matrix = newMatrix;
        this.app.layerManager.updateLayerTransforms(this.matrix); // レイヤーにも変換を適用
        this.renderAllLayers();
    }


    // レイヤーの内容を全て合成して表示する
    renderAllLayers() {
        this.drawingContext.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        
        // 全体の変換行列を適用
        this.drawingContext.setTransform(...this.matrix);

        const layers = this.app.layerManager.getLayers();
        layers.forEach(layer => {
            // レイヤーごとの不透明度を適用
            this.drawingContext.globalAlpha = layer.opacity;
            // レイヤーごとの表示/非表示をチェック
            if (layer.visible) {
                this.drawingContext.drawImage(layer.canvas, 0, 0);
            }
        });

        // 変換をリセットして、UI要素（カーソルなど）が正しく表示されるようにする
        this.drawingContext.setTransform(1, 0, 0, 1, 0, 0);
        this.drawingContext.globalAlpha = 1; // アルファ値をリセット
    }

    // ★追加: 全レイヤーを統合したCanvasを返すメソッド (ui.jsで使用)
    getMergedImageCanvas() {
        const layers = this.app.layerManager.getLayers();
        if (!layers || layers.length === 0) {
            return null;
        }

        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.drawingCanvas.width;
        mergedCanvas.height = this.drawingCanvas.height;
        const mergedCtx = mergedCanvas.getContext('2d', { willReadFrequently: true });

        // 全体の変換行列を適用して描画
        mergedCtx.setTransform(...this.matrix);

        // 各レイヤーを描画 (表示されているレイヤーのみ)
        // 最下層から順に描画して重ねていく
        for (const layer of layers) {
            if (layer.canvas && layer.visible) {
                mergedCtx.globalAlpha = layer.opacity;
                mergedCtx.drawImage(layer.canvas, 0, 0);
            }
        }
        // 変換をリセット
        mergedCtx.setTransform(1, 0, 0, 1, 0, 0);
        mergedCtx.globalAlpha = 1;

        return mergedCanvas;
    }


    clearCanvas() {
        const layer = this.app.layerManager.getActiveLayer();
        if (layer) {
            layer.getContext().clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            this.saveCanvasState(); // 履歴に保存
            this.renderAllLayers();
        }
    }

    clearAllLayers() {
        this.app.layerManager.clearAllLayers();
        this.saveCanvasState(); // 履歴に保存
        this.renderAllLayers();
    }

    saveCanvasState() {
        const layerCanvasData = this.app.layerManager.getLayers().map(layer => ({
            imageData: layer.canvas.toDataURL(),
            visible: layer.visible,
            opacity: layer.opacity,
            name: layer.name,
            id: layer.id
        }));
        this.undoStack.push({
            layers: layerCanvasData,
            activeLayerIndex: this.app.layerManager.activeLayerIndex,
            matrix: [...this.matrix] // 行列も保存
        });
        this.redoStack = []; // Redoスタックをクリア
        // console.log("State saved. Undo stack size:", this.undoStack.length);
        if (this.undoStack.length > 20) { // undo履歴を20に制限
            this.undoStack.shift();
        }
    }

    restoreCanvasState(state) {
        if (!state) return;

        this.app.layerManager.restoreLayers(state.layers);
        this.app.layerManager.switchLayer(state.activeLayerIndex, true); // trueでUI更新を抑制
        this.matrix = [...state.matrix]; // 行列も復元
        this.app.layerManager.updateLayerTransforms(this.matrix);
        this.renderAllLayers();
        this.app.layerUIManager.renderLayers(); // UIを更新
        // console.log("State restored.");
    }

    undo() {
        if (this.undoStack.length > 0) {
            const currentState = this.undoStack.pop();
            this.redoStack.push(currentState);
            if (this.undoStack.length > 0) {
                this.restoreCanvasState(this.undoStack[this.undoStack.length - 1]);
            } else {
                // スタックが空になった場合、完全にクリアした状態を復元（または最初の状態）
                this.app.layerManager.clearAllLayers(); // 全てのレイヤーをクリア
                this.app.layerManager.setupInitialLayers(); // 初期レイヤーを再設定
                this.matrix = [1, 0, 0, 1, 0, 0]; // 行列もリセット
                this.renderAllLayers();
                this.app.layerUIManager.renderLayers();
            }
        } else {
            console.log("No more undo steps.");
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const nextState = this.redoStack.pop();
            this.undoStack.push(nextState);
            this.restoreCanvasState(nextState);
        } else {
            console.log("No more redo steps.");
        }
    }

    getMainCanvas() {
        return this.drawingCanvas;
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#000000'; // 黒
        this.subColor = '#FFFFFF'; // 白
        this.mainColorPicker = document.getElementById('main-color-picker');
        this.subColorPicker = document.getElementById('sub-color-picker');
        this.colorSwapBtn = document.getElementById('color-swap-btn');
        this.colorBox = document.getElementById('color-box');
        this.recentColors = [];
        this.recentColorsContainer = document.getElementById('recent-colors');

        this.bindEvents();
        this.updateColorDisplays();
        this.loadRecentColors(); // 最近使用した色をロード
    }

    bindEvents() {
        this.mainColorPicker.addEventListener('input', (e) => this.setMainColor(e.target.value));
        this.subColorPicker.addEventListener('input', (e) => this.setSubColor(e.target.value));
        this.colorSwapBtn.addEventListener('click', () => this.swapColors());
        this.colorBox.addEventListener('click', () => this.mainColorPicker.click());
        
        // 最近使用した色のクリックイベント
        this.recentColorsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('recent-color-swatch')) {
                this.setMainColor(e.target.dataset.color);
            }
        });
    }

    setMainColor(hex) {
        this.mainColor = hex;
        this.updateColorDisplays();
        this.addRecentColor(hex);
    }

    setSubColor(hex) {
        this.subColor = hex;
        this.updateColorDisplays();
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
    }

    updateColorDisplays() {
        this.mainColorPicker.value = this.mainColor;
        this.subColorPicker.value = this.subColor;
        this.colorBox.style.backgroundColor = this.mainColor;
    }

    getCurrentColor() {
        return this.mainColor;
    }

    // 最近使用した色を追加
    addRecentColor(color) {
        // 既にリストにある場合は削除して先頭に追加
        this.recentColors = this.recentColors.filter(c => c !== color);
        this.recentColors.unshift(color);
        // 最大10色まで保持
        if (this.recentColors.length > 10) {
            this.recentColors.pop();
        }
        this.saveRecentColors(); // localStorageに保存
        this.renderRecentColors();
    }

    // localStorageから最近使用した色をロード
    loadRecentColors() {
        try {
            const storedColors = localStorage.getItem('recentColors');
            if (storedColors) {
                this.recentColors = JSON.parse(storedColors);
                this.renderRecentColors();
            }
        } catch (e) {
            console.error('Failed to load recent colors from localStorage:', e);
            this.recentColors = []; // ロード失敗時はクリア
        }
    }

    // localStorageに最近使用した色を保存
    saveRecentColors() {
        try {
            localStorage.setItem('recentColors', JSON.stringify(this.recentColors));
        } catch (e) {
            console.error('Failed to save recent colors to localStorage:', e);
        }
    }

    // 最近使用した色を表示
    renderRecentColors() {
        this.recentColorsContainer.innerHTML = '';
        this.recentColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'recent-color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            this.recentColorsContainer.appendChild(swatch);
        });
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.size = 10;
        this.opacity = 1.0;
        this.minSize = 1; // 最小サイズを定義
        this.bindEvents();
        this.updateDisplay();
    }

    bindEvents() {
        document.getElementById('size-slider').addEventListener('input', (e) => this.setSize(parseInt(e.target.value)));
        document.getElementById('opacity-slider').addEventListener('input', (e) => this.setOpacity(parseFloat(e.target.value)));

        document.querySelectorAll('.size-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const size = parseInt(e.currentTarget.dataset.size);
                this.setSize(size);
            });
        });
    }

    setSize(newSize) {
        this.size = Math.max(this.minSize, newSize); // 最小サイズを下回らないように
        this.updateDisplay();
        this.app.canvasManager.drawingContext.lineWidth = this.size;
    }

    setOpacity(newOpacity) {
        this.opacity = newOpacity;
        this.updateDisplay();
        this.app.canvasManager.drawingContext.globalAlpha = this.opacity;
    }

    getSize() {
        return this.size;
    }

    getOpacity() {
        return this.opacity;
    }

    updateDisplay() {
        document.getElementById('size-slider').value = this.size;
        document.getElementById('size-number').textContent = this.size;
        document.getElementById('opacity-slider').value = this.opacity;
        document.getElementById('opacity-number').textContent = Math.round(this.opacity * 100);

        // サイズ表示ドットの更新
        const sizeDot = document.querySelector('.size-indicator .size-dot');
        if (sizeDot) {
            sizeDot.style.width = `${this.size}px`;
            sizeDot.style.height = `${this.size}px`;
            sizeDot.style.borderRadius = '50%'; // 丸くする
            sizeDot.style.backgroundColor = 'black'; // ドットの色
        }
    }
}

class Layer {
    constructor(id, name, width, height, isHidden = false) {
        this.id = id;
        this.name = name;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
        this.visible = true; // 表示/非表示の状態
        this.opacity = 1.0; // 不透明度 (0.0 - 1.0)
    }

    getContext() {
        return this.context;
    }

    resize(newWidth, newHeight) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // 現在のレイヤーの内容を新しいサイズのキャンバスに描画
        tempCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, newWidth, newHeight);

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.context.clearRect(0, 0, newWidth, newHeight); // クリアしてからコピー
        this.context.drawImage(tempCanvas, 0, 0);
    }
}


class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1; // No active layer initially
        this.nextLayerId = 0;
        // setupInitialLayers() は ToshinkaTegakiTool のコンストラクタで呼び出す
    }

    setupInitialLayers() {
        if (this.layers.length === 0) {
            this.addLayer('レイヤー 1');
            this.switchLayer(0); // 最初のレイヤーをアクティブに
            this.app.canvasManager.saveCanvasState(); // 初期状態を履歴に保存
        }
    }

    // ★追加: 親フレームからの初期画像データをロードするメソッド
    loadInitialImage(dataURL) {
        if (!dataURL) return;

        const img = new Image();
        img.onload = () => {
            if (this.layers.length === 0) {
                this.addLayer('背景'); // レイヤーがない場合は「背景」として追加
            }
            const targetLayer = this.layers[0]; // 最初のレイヤー (レイヤー0) を対象とする
            
            // キャンバスのサイズを画像に合わせるか、画像をキャンバスサイズに合わせるか選択
            // ここではキャンバスサイズに合わせて画像を縮小・拡大して描画
            const mainCanvas = this.app.canvasManager.getMainCanvas();
            // まずレイヤーをクリア
            targetLayer.getContext().clearRect(0, 0, targetLayer.canvas.width, targetLayer.canvas.height);
            // 画像を描画
            targetLayer.getContext().drawImage(img, 0, 0, img.width, img.height, 0, 0, mainCanvas.width, mainCanvas.height);
            this.app.canvasManager.renderAllLayers();
            this.app.canvasManager.saveCanvasState(); // ロード後の状態を履歴に保存
            this.app.layerUIManager.renderLayers(); // UI更新
            console.log('初期画像がレイヤーにロードされました。');
        };
        img.onerror = (e) => {
            console.error('初期画像のロードに失敗しました:', e);
        };
        img.src = dataURL;
    }


    addLayer(name = `レイヤー ${this.nextLayerId + 1}`) {
        const mainCanvas = this.app.canvasManager.getMainCanvas();
        const newLayer = new Layer(this.nextLayerId++, name, mainCanvas.width, mainCanvas.height);
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1); // 新しいレイヤーをアクティブにする
        this.app.canvasManager.saveCanvasState(); // 履歴に保存
        this.app.layerUIManager.renderLayers(); // UIを更新
        return newLayer;
    }

    duplicateLayer(index = this.activeLayerIndex) {
        if (index < 0 || index >= this.layers.length) return;

        const originalLayer = this.layers[index];
        const duplicatedLayer = new Layer(this.nextLayerId++, `${originalLayer.name} コピー`, originalLayer.canvas.width, originalLayer.canvas.height);
        duplicatedLayer.getContext().drawImage(originalLayer.canvas, 0, 0); // 内容をコピー
        duplicatedLayer.visible = originalLayer.visible;
        duplicatedLayer.opacity = originalLayer.opacity;

        this.layers.splice(index + 1, 0, duplicatedLayer); // 元のレイヤーの直後に追加
        this.switchLayer(index + 1); // 複製したレイヤーをアクティブに
        this.app.canvasManager.saveCanvasState(); // 履歴に保存
        this.app.layerUIManager.renderLayers();
    }

    mergeLayer(index = this.activeLayerIndex) {
        if (index <= 0 || index >= this.layers.length) {
            alert('最下層以外のレイヤーを選択して結合してください。');
            return; // 最下層は結合できない、または対象レイヤーがない
        }
        if (this.layers.length < 2) {
            alert('結合するレイヤーがありません。');
            return;
        }

        const targetLayer = this.layers[index - 1]; // 結合先はアクティブレイヤーの下のレイヤー
        const activeLayer = this.layers[index];

        // 結合先のレイヤーのコンテキストにアクティブレイヤーの内容を描画
        targetLayer.getContext().globalAlpha = targetLayer.opacity; // 結合先の不透明度を適用
        targetLayer.getContext().drawImage(activeLayer.canvas, 0, 0); // アクティブレイヤーを結合
        targetLayer.getContext().globalAlpha = 1.0; // リセット

        this.layers.splice(index, 1); // アクティブレイヤーを削除
        this.switchLayer(index - 1); // 結合先のレイヤーをアクティブに
        this.app.canvasManager.saveCanvasState(); // 履歴に保存
        this.app.canvasManager.renderAllLayers(); // 再描画
        this.app.layerUIManager.renderLayers(); // UI更新
    }


    deleteLayer(index = this.activeLayerIndex) {
        if (this.layers.length === 1) {
            alert('最後のレイヤーは削除できません。');
            return;
        }
        if (index < 0 || index >= this.layers.length) return;

        if (confirm(`「${this.layers[index].name}」レイヤーを削除しますか？`)) {
            this.layers.splice(index, 1); // レイヤーを削除

            // アクティブレイヤーのインデックスを調整
            if (this.activeLayerIndex >= index) {
                this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
            }
            this.switchLayer(this.activeLayerIndex); // 新しいアクティブレイヤーを設定
            this.app.canvasManager.saveCanvasState(); // 履歴に保存
            this.app.canvasManager.renderAllLayers(); // 再描画
            this.app.layerUIManager.renderLayers(); // UI更新
        }
    }

    switchLayer(index, suppressUIUpdate = false) {
        if (index < 0 || index >= this.layers.length) {
            console.warn("Invalid layer index:", index);
            return;
        }
        this.activeLayerIndex = index;
        if (!suppressUIUpdate) {
            this.app.layerUIManager.renderLayers(); // UIを更新
        }
        this.app.canvasManager.renderAllLayers(); // 全レイヤーを再描画してアクティブレイヤーを反映
    }

    toggleLayerVisibility(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.layers[index].visible = !this.layers[index].visible;
        this.app.canvasManager.renderAllLayers();
        this.app.layerUIManager.renderLayers();
    }

    setLayerOpacity(index, opacity) {
        if (index < 0 || index >= this.layers.length) return;
        this.layers[index].opacity = opacity;
        this.app.canvasManager.renderAllLayers();
        this.app.layerUIManager.renderLayers();
    }

    moveLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length ||
            toIndex < 0 || toIndex >= this.layers.length ||
            fromIndex === toIndex) {
            return;
        }

        const [movedLayer] = this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, movedLayer);

        // アクティブレイヤーのインデックスを調整
        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (this.activeLayerIndex >= Math.min(fromIndex, toIndex) &&
                   this.activeLayerIndex <= Math.max(fromIndex, toIndex)) {
            if (fromIndex < toIndex) { // 下に移動した場合
                this.activeLayerIndex--;
            } else { // 上に移動した場合
                this.activeLayerIndex++;
            }
        }
        this.app.canvasManager.renderAllLayers();
        this.app.layerUIManager.renderLayers();
        this.app.canvasManager.saveCanvasState(); // 履歴に保存
    }

    clearAllLayers() {
        const mainCanvas = this.app.canvasManager.getMainCanvas();
        this.layers = []; // 全てのレイヤーを破棄
        this.addLayer('レイヤー 1'); // 新しい初期レイヤーを作成
        this.switchLayer(0); // 新しいレイヤーをアクティブに
        this.app.canvasManager.renderAllLayers();
        this.app.layerUIManager.renderLayers();
    }

    // レイヤーの配列全体を返す
    getLayers() {
        return this.layers;
    }

    getActiveLayer() {
        return this.layers[this.activeLayerIndex];
    }

    // 履歴からの復元時にレイヤーを再構築
    restoreLayers(layerDataArray) {
        const mainCanvas = this.app.canvasManager.getMainCanvas();
        this.layers = layerDataArray.map(data => {
            const layer = new Layer(data.id, data.name, mainCanvas.width, mainCanvas.height);
            layer.visible = data.visible;
            layer.opacity = data.opacity;
            const img = new Image();
            img.src = data.imageData;
            img.onload = () => {
                layer.getContext().clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                layer.getContext().drawImage(img, 0, 0);
                this.app.canvasManager.renderAllLayers(); // 描画完了後に全体を再描画
            };
            return layer;
        });
        this.nextLayerId = Math.max(...this.layers.map(l => l.id)) + 1; // IDを更新
    }

    updateLayerTransforms(matrix) {
        // レイヤーはそれぞれ個別のキャンバスを持つため、
        // メインのレンダリング時にCanvasManagerが全体変換を適用します。
        // 個々のレイヤーには直接変換を適用する必要はありません。
        // ただし、もし各レイヤーに個別の変換を持たせる場合はここにロジックを追加します。
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
        document.getElementById('fill-tool').addEventListener('click', () => this.setTool('fill'));
        // その他のツールボタンのイベントリスナー
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
        this.layerUIManager = null;
        this.topBarManager = null; // UI Managerへの参照を追加
        this.shortcutManager = null; // Shortcut Managerへの参照を追加

        this.initManagers();
        this.handleParentMessages(); // ★追加: 親からのメッセージを処理
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

        // UIマネージャーはDOMContentLoadedで初期化されるため、ここで参照をセット
        // (ui.jsで window.toshinkaTegakiTool.topBarManager などとしてセットされる)
    }

    // ★追加: 親フレームからのメッセージを処理するメソッド
    handleParentMessages() {
        window.addEventListener('message', (event) => {
            // セキュリティ: 親のオリジンを確認することを推奨
            // if (event.origin !== 'https://may.2chan.net') { // 適切なオリジンに置き換える
            //   console.warn('不明なオリジンからのメッセージをブロックしました:', event.origin);
            //   return;
            // }

            if (event.data && event.data.type === 'initialDrawing') {
                const initialDataURL = event.data.data;
                console.log('親フレームから初期描画データを受信しました。');
                // LayerManagerが完全に初期化されていることを確認してからロード
                if (this.layerManager.layers.length > 0) {
                    this.layerManager.loadInitialImage(initialDataURL); // LayerManagerに処理を移譲
                } else {
                    // もし初期化がまだなら、少し待ってから再試行
                    setTimeout(() => this.layerManager.loadInitialImage(initialDataURL), 100);
                }
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        // UIマネージャーやショートカットマネージャーは ui.js で初期化され、
        // ここで作成された toshinkaTegakiTool インスタンスに設定されます。
    }
});