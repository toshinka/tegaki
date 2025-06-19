// 🚨 Toshinka Tegaki Tool v1-4系 UI/初期化/ショートカット管理（命令書完全準拠）🚨

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
        // v+系（アクティブレイヤーtransform）
        let handled = false;
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
        if (handled) { e.preventDefault(); return; }
        // ペンサイズ・色・ツール
        switch (e.key.toLowerCase()) {
            case '[': this.app.penSettingsManager.changeSize(false); e.preventDefault(); break;
            case ']': this.app.penSettingsManager.changeSize(true); e.preventDefault(); break;
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
        if (this.app.toolManager.getCurrentTool() === 'pen' || this.app.toolManager.getCurrentTool() === 'eraser') {
            const layer = this.app.layerManager.getActiveLayer();
            if (this.app.layerManager.activeLayerIndex === 0 && this.app.toolManager.getCurrentTool() === 'eraser') {
                // drawing-layer0は消しゴム禁止
                return;
            }
            const { x, y } = this.app.canvasManager.getLayerDrawCoord(e.clientX, e.clientY, layer);
            layer.ctx.beginPath();
            layer.ctx.moveTo(x, y);
            this.lastDrawPos = { x, y };
            layer.ctx.globalCompositeOperation = this.app.toolManager.getCurrentTool() === 'eraser' ? 'destination-out' : 'source-over';
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
        } else if (this.app.toolManager.getCurrentTool() === 'bucket') {
            // バケツ塗り
            const layer = this.app.layerManager.getActiveLayer();
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
        if (this.app.toolManager.getCurrentTool() === 'move') {
            if (this.app.layerManager.activeLayerIndex === 0) {
                // drawing-layer0はmove/transform禁止
                return;
            }
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
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});