// 🚨 Toshinka Tegaki Tool v1-4系 UI/初期化/ショートカット管理（命令書完全準拠）🚨

// --- 🐛 DEBUG: CANVAS DISPLAY ---
// このファイル内でcanvas（drawing-layer0, composite-canvas, frame-canvas）が
// 絶対に「見える」状態を保証することだけに集中する。
// CSS/DOM/重なり順/不透明度/append順/描画ループ/レイヤー作成順/visibility/pointer-events/z-index 等、
// 些細なミスでも表示全滅になるので、一つ一つ徹底確認。
// ---------------------------------------------------

class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.layerManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.layerManager.redo());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.title = 'アクティブレイヤーを消去 (Delete)';
            clearBtn.addEventListener('click', () => this.app.layerManager.clearActiveLayer());
            const clearAllBtn = document.createElement('button');
            clearAllBtn.id = 'clear-all-btn';
            clearAllBtn.style.fontSize = "16px";
            clearAllBtn.style.padding = "0 4px";
            clearAllBtn.className = 'tool-btn';
            clearAllBtn.innerHTML = '🗑️*';
            clearAllBtn.title = '全レイヤーを消去 (Shift+Delete)';
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            clearAllBtn.addEventListener('click', () => {
                if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) {
                    this.app.layerManager.clearAllLayers();
                }
            });
        }
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }
    closeTool() {
        if (confirm('ウィンドウを閉じますか？')) {
            window.close();
        }
    }
}

class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.lastDrawPos = null;
    }
    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    }
    handleKeyUp(e) {
        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            e.preventDefault();
        }
    }
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        const layer = this.app.layerManager.getActiveLayer();
        const isBaseLayer = layer?._isBaseLayer;

        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            e.preventDefault();
            return;
        }
        // ビューショートカット（Space+やCtrl/Cmd系）
        if (this.app.canvasManager.isSpaceDown) {
            let handled = true;
            switch (e.key) {
                case 'ArrowUp': this.app.canvasManager.viewTransform.y -= 10; break;
                case 'ArrowDown': this.app.canvasManager.viewTransform.y += 10; break;
                case 'ArrowLeft': this.app.canvasManager.viewTransform.x -= 10; break;
                case 'ArrowRight': this.app.canvasManager.viewTransform.x += 10; break;
                default: handled = false;
            }
            if (handled) {
                this.app.layerManager.drawComposite();
                e.preventDefault();
            }
            return;
        }
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            this.app.layerManager.undo(); e.preventDefault(); return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            this.app.layerManager.redo(); e.preventDefault(); return;
        }

        // --- カラーパレット移動ショートカット (最優先/必ず効く) ---
        // [ / ] および Shift+[ / Shift+]、国際配列/日本語配列も網羅
        // BracketLeft, BracketRight, [, {, ], }
        let isBracketLeft = (
            e.code === 'BracketLeft' ||
            e.key === '[' || e.key === '{'
        );
        let isBracketRight = (
            e.code === 'BracketRight' ||
            e.key === ']' || e.key === '}'
        );
        if (isBracketLeft) {
            this.app.colorManager.changeColor(false);
            e.preventDefault();
            return;
        }
        if (isBracketRight) {
            this.app.colorManager.changeColor(true);
            e.preventDefault();
            return;
        }
        // -----------------------------------------------------

        // v+系（アクティブレイヤーtransform）drawing-layer0は禁止
        let handled = false;
        if (!isBaseLayer) {
            if (e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'h': this.app.layerManager.flipActiveLayerVertical(); handled = true; break;
                    case 'arrowup': this.app.layerManager.scaleActiveLayer(1.02); handled = true; break;
                    case 'arrowdown': this.app.layerManager.scaleActiveLayer(1/1.02); handled = true; break;
                    case 'arrowleft': this.app.layerManager.rotateActiveLayer(-1); handled = true; break;
                    case 'arrowright': this.app.layerManager.rotateActiveLayer(1); handled = true; break;
                }
            } else {
                switch (e.key.toLowerCase()) {
                    case 'h': this.app.layerManager.flipActiveLayerHorizontal(); handled = true; break;
                    case 'arrowup': this.app.layerManager.moveActiveLayer(0, -1); handled = true; break;
                    case 'arrowdown': this.app.layerManager.moveActiveLayer(0, 1); handled = true; break;
                    case 'arrowleft': this.app.layerManager.moveActiveLayer(-1, 0); handled = true; break;
                    case 'arrowright': this.app.layerManager.moveActiveLayer(1, 0); handled = true; break;
                }
            }
        }
        if (handled) { e.preventDefault(); return; }
        // drawing-layer0ではtransform/消しゴム/バケツ系ショートカットを無効化
        // ペンサイズ・色・ツール
        switch (e.key.toLowerCase()) {
            // ペンサイズ変更ショートカットは削除・競合防止のためコメントアウト/無効化
            //case '[': this.app.penSettingsManager.changeSize(false); e.preventDefault(); break;
            //case ']': this.app.penSettingsManager.changeSize(true); e.preventDefault(); break;
            case 'x': this.app.colorManager.swapColors(); e.preventDefault(); break;
            case 'd': this.app.colorManager.resetColors(); e.preventDefault(); break;
            case 'p': this.app.toolManager.setTool('pen'); e.preventDefault(); break;
            case 'e': this.app.toolManager.setTool('eraser'); e.preventDefault(); break;
            case 'v': this.app.toolManager.setTool('move'); e.preventDefault(); break;
            case 'g': this.app.toolManager.setTool('bucket'); e.preventDefault(); break;
        }
    }
    // ペン描画系
    handlePenPointerDown(e) {
        const layer = this.app.layerManager.getActiveLayer();
        const isBaseLayer = layer?._isBaseLayer;
        const tool = this.app.toolManager.getCurrentTool();

        if ((tool === 'pen') || (tool === 'eraser')) {
            if (isBaseLayer && tool === 'eraser') {
                // drawing-layer0は消しゴム禁止
                return;
            }
            const { x, y } = this.app.canvasManager.getLayerDrawCoord(e.clientX, e.clientY, layer);
            layer.ctx.beginPath();
            layer.ctx.moveTo(x, y);
            this.lastDrawPos = { x, y };
            layer.ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
            layer.ctx.strokeStyle = this.app.colorManager.getColor();
            layer.ctx.lineWidth = this.app.penSettingsManager.getCurrentSize();
            // pointermove/up: windowバインド
            const move = (ev) => {
                if (!ev.buttons) return;
                const { x:mx, y:my } = this.app.canvasManager.getLayerDrawCoord(ev.clientX, ev.clientY, layer);
                layer.ctx.lineTo(mx, my);
                layer.ctx.stroke();
                this.lastDrawPos = { x:mx, y:my };
            };
            const up = () => {
                window.removeEventListener('pointermove', move, true);
                window.removeEventListener('pointerup', up, true);
                layer.ctx.closePath();
                this.app.layerManager.saveState();
                this.app.layerManager.drawComposite();
            };
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', up, true);
        } else if (tool === 'bucket') {
            // drawing-layer0もバケツOK（命令書では消しゴムのみ禁止）
            const { x, y } = this.app.canvasManager.getLayerDrawCoord(e.clientX, e.clientY, layer);
            this.floodFill(layer, Math.floor(x), Math.floor(y), this.app.colorManager.getColor());
            this.app.layerManager.saveState();
            this.app.layerManager.drawComposite();
        }
    }
    // バケツ: RGBA変換ユーティリティ
    hexToRgba(hex) {
        const c = hex.replace('#', '');
        if (c.length === 3) {
            return [parseInt(c[0]+c[0],16), parseInt(c[1]+c[1],16), parseInt(c[2]+c[2],16), 255];
        } else if (c.length === 6) {
            return [parseInt(c.substr(0,2),16), parseInt(c.substr(2,2),16), parseInt(c.substr(4,2),16), 255];
        }
        return [0,0,0,255];
    }
    floodFill(layer, sx, sy, fillColor) {
        const w = layer.canvas.width, h = layer.canvas.height;
        const ctx = layer.ctx;
        const img = ctx.getImageData(0,0,w,h);
        const startColor = this.getPixel(img, sx, sy);
        const fc = this.hexToRgba(fillColor);
        if (this.colorsMatch(startColor, fc)) return;
        const q = [[sx,sy]];
        while(q.length) {
            const [x, y] = q.pop();
            if (x<0||x>=w||y<0||y>=h) continue;
            if (!this.colorsMatch(this.getPixel(img, x, y), startColor)) continue;
            this.setPixel(img, x, y, fc);
            q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
        }
        ctx.putImageData(img, 0, 0);
    }
    getPixel(img,x,y) {
        const i = (y*img.width+x)*4;
        return [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]];
    }
    setPixel(img,x,y,rgba) {
        const i = (y*img.width+x)*4;
        [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]] = rgba;
    }
    colorsMatch(a,b) {
        return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3];
    }
    // v+系ホイール
    handleLayerWheel(e) {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer || layer._isBaseLayer) {
            // drawing-layer0はmove/transform禁止
            return;
        }
        if (this.app.toolManager.getCurrentTool() === 'move') {
            const delta = e.deltaY > 0 ? -1 : 1;
            if (e.shiftKey && e.ctrlKey) {
                this.app.layerManager.rotateActiveLayer(delta * 5);
                e.preventDefault();
            } else if (e.shiftKey) {
                this.app.layerManager.scaleActiveLayer(delta > 0 ? 1.1 : 1/1.1);
                e.preventDefault();
            } else if (!e.shiftKey && !e.ctrlKey) {
                this.app.layerManager.scaleActiveLayer(delta > 0 ? 1.05 : 1/1.05);
                e.preventDefault();
            }
        }
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null;
        this.shortcutManager = null;
        this.initManagers();
        this.bindTestButtons();
        this.ensureLayerStack();
        this.ensureCanvasVisibilityDebug(); // 🟢 追加: キャンバス表示デバッグ
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.layerManager.setupInitialLayers();
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.shortcutManager.initialize();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        this.layerManager.saveState();
    }
    bindTestButtons() {
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.layerManager.addLayer();
            });
        }
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                if (this.layerManager.layers.length > 1) {
                    let idx = (this.layerManager.activeLayerIndex + 1) % this.layerManager.layers.length;
                    this.layerManager.switchLayer(idx);
                    this.layerManager.drawComposite();
                }
            });
        }
    }
    // drawing-layer0を基準にレイヤーstack DOMエリアを用意
    ensureLayerStack() {
        // drawing-layer0の親要素(canvas-container)内にlayer-stack divを用意
        const baseCanvas = document.getElementById('drawing-layer0');
        if (!baseCanvas) return;
        let stack = document.getElementById('layer-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'layer-stack';
            stack.style.position = 'absolute';
            stack.style.top = '0';
            stack.style.left = '0';
            stack.style.width = '100%';
            stack.style.height = '100%';
            stack.style.pointerEvents = 'none';
            stack.style.zIndex = '10';
            // drawing-layer0の直後(composite-canvasの前)に挿入
            baseCanvas.parentNode.insertBefore(stack, baseCanvas.nextSibling);
        }
        // drawing-layer0だけはlayer-stackには絶対に移動させない
    }

    // --- 🟢 デバッグ用: canvasが「必ず見える」ようにスタイル/z-index/check ---
    ensureCanvasVisibilityDebug() {
        // すべてのcanvasが「絶対に」見えるかどうかを強制的にチェックし、styleを書き換える
        // 1. drawing-layer0が一番下、composite-canvasが中央、frame-canvasが一番上
        // 2. 全て"block"かつopacity=1, visibility=visible, pointer-events=auto, z-index適正
        // 3. DevToolsで消えないよう強制

        // [1] drawing-layer0
        const drawing0 = document.getElementById('drawing-layer0');
        if (drawing0) {
            drawing0.style.display = 'block';
            drawing0.style.opacity = '1';
            drawing0.style.visibility = 'visible';
            drawing0.style.position = 'absolute';
            drawing0.style.zIndex = 1;
            drawing0.style.pointerEvents = 'auto';
            // デバッグ: 赤枠
            // drawing0.style.border = '1px solid #c00';
        } else {
            console.warn('drawing-layer0が見つかりません！（致命的）');
        }

        // [2] composite-canvas
        const composite = document.getElementById('composite-canvas');
        if (composite) {
            composite.style.display = 'block';
            composite.style.opacity = '1';
            composite.style.visibility = 'visible';
            composite.style.position = 'absolute';
            composite.style.zIndex = 2;
            composite.style.pointerEvents = 'auto';
            // composite.style.border = '1px solid #0c0';
        } else {
            console.warn('composite-canvasが見つかりません！（致命的）');
        }
        // [3] frame-canvas
        const frame = document.getElementById('frame-canvas');
        if (frame) {
            frame.style.display = 'block';
            frame.style.opacity = '1';
            frame.style.visibility = 'visible';
            frame.style.position = 'absolute';
            frame.style.zIndex = 3;
            frame.style.pointerEvents = 'none'; // 枠はクリック透過
            // frame.style.border = '1px solid #00c';
        } else {
            console.warn('frame-canvasが見つかりません！（致命的）');
        }

        // [4] layer-stack（追加レイヤー用div）はcomposite-canvasより下、frame-canvasより下
        const stack = document.getElementById('layer-stack');
        if (stack) {
            stack.style.display = 'block';
            stack.style.opacity = '1';
            stack.style.visibility = 'visible';
            stack.style.position = 'absolute';
            stack.style.zIndex = 2; // compositeと同じ
            stack.style.pointerEvents = 'none';
        }

        // --- 重なり順デバッグ ---
        // DOM順で drawing-layer0 → layer-stack → composite-canvas → frame-canvas になっているか
        const parent = drawing0?.parentElement;
        if (parent) {
            let order = [];
            for (let node of parent.childNodes) {
                if (node.nodeType === 1) {
                    order.push(node.id || node.tagName);
                }
            }
            console.log('canvas-container内のDOM順:', order);
        }

        // [5] 何も見えない場合の最終手段: drawing-layer0に直接描画
        if (drawing0) {
            const ctx = drawing0.getContext('2d');
            if (ctx) {
                // すでに色が塗られていない場合のみ
                let px = ctx.getImageData(0, 0, 1, 1).data;
                if (px[3] === 0) {
                    ctx.fillStyle = '#f0e0d6';
                    ctx.fillRect(0, 0, drawing0.width, drawing0.height);
                    ctx.strokeStyle = "#f00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(20, 20);
                    ctx.stroke();
                }
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});

// --- ここより下は一切変更禁止（命令書でcanvas表示以外いじるな！） ---
// 他のManager/Color/Toolクラス等は元のままです
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.getElementById(tool + '-tool');
        if (btn) btn.classList.add('active');
    }
    getCurrentTool() {
        return this.currentTool;
    }
}

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
    getCurrentSize() {
        return this.currentSize;
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
    getColor() {
        return this.mainColor;
    }
}