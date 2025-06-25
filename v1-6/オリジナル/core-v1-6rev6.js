// Toshinka Tegaki Tool core.js v1.6 rev6.3 (Hybrid Engine, Drawing Feel Improvement)

// --- Color Utility ---
function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
}

// --- Layer (Hybrid: ImageData + drawingCanvas) ---
class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.isDrawing = false;

        this.imageData = new ImageData(width, height);
        this.drawingCanvas = document.createElement('canvas');
        this.drawingCanvas.width = width;
        this.drawingCanvas.height = height;
        this.drawingCtx = this.drawingCanvas.getContext('2d', { willReadFrequently: true });
    }
    clear() {
        this.imageData.data.fill(0);
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    }
    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data.set([color.r, color.g, color.b, color.a], i);
        }
        this.drawingCtx.putImageData(this.imageData, 0, 0);
    }
}

// --- CanvasManager ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d');
        this.displayCanvas.width = 344; this.displayCanvas.height = 135;
        this.canvasArea = document.getElementById('canvas-area'); this.canvasContainer = document.getElementById('canvas-container');
        this.isDrawing = false; this.isPanning = false; this.isLayerTransforming = false;
        this.isSpaceDown = false; this.isVDown = false; this.isShiftDown = false;
        this.isScalingRotatingLayer = false; this.isScalingRotatingCanvas = false;
        this.currentTool = 'pen'; this.currentColor = '#800000'; this.currentSize = 1;
        this.points = [];
        this.dragStartX = 0; this.dragStartY = 0;
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.originalCanvasTransform = {};
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.originalLayerTransform = {};
        this.transformTargetLayerOriginalData = null; this.transformBgCache = null;
        this.createAndDrawFrame();
        this.bindEvents();
    }

    createAndDrawFrame() {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = 364; frameCanvas.height = 145;
        frameCanvas.style.cssText = "position:absolute;left:-10px;top:-5px;z-index:-1;pointer-events:none;";
        this.canvasContainer.insertBefore(frameCanvas, this.displayCanvas);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.fillStyle = '#ffffff'; frameCtx.strokeStyle = '#cccccc'; frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        if (frameCtx.roundRect) frameCtx.roundRect(0.5, 0.5, frameCanvas.width - 1, frameCanvas.height - 1, 8);
        else frameCtx.rect(0.5, 0.5, frameCanvas.width - 1, frameCanvas.height - 1);
        frameCtx.fill(); frameCtx.stroke();
    }

    renderAllLayers() {
        this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
        this.app.layerManager.layers.forEach(layer => {
            if (!layer.visible) return;
            const imageSource = layer.isDrawing ? layer.drawingCanvas : layer.imageData;
            if (imageSource instanceof ImageData) {
                if (imageSource.width > 0 && imageSource.height > 0) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = imageSource.width; tempCanvas.height = imageSource.height;
                    tempCanvas.getContext('2d').putImageData(imageSource, 0, 0);
                    this.displayCtx.drawImage(tempCanvas, 0, 0);
                }
            } else {
                this.displayCtx.drawImage(imageSource, 0, 0);
            }
        });
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        if (this.isLayerTransforming) { this.commitLayerTransform(); return; }
        const commonDragStart = () => { this.dragStartX = e.clientX; this.dragStartY = e.clientY; e.preventDefault(); };
        if (this.isVDown) { if (!this.isLayerTransforming) this.startLayerTransform(); commonDragStart(); this.isScalingRotatingLayer = this.isShiftDown; this.originalLayerTransform = { ...this.layerTransform }; return; }
        if (this.isSpaceDown) { commonDragStart(); this.isScalingRotatingCanvas = this.isShiftDown; this.isPanning = !this.isShiftDown; this.originalCanvasTransform = { ...this.transform }; return; }
        
        const coords = this.getCanvasCoordinates(e); if (!coords) return;
        const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer) return;

        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
            this.app.historyManager.saveState();
        } else {
            this.isDrawing = true;
            activeLayer.isDrawing = true;
            activeLayer.drawingCtx.clearRect(0, 0, activeLayer.drawingCanvas.width, activeLayer.drawingCanvas.height);
            activeLayer.drawingCtx.putImageData(activeLayer.imageData, 0, 0);
            activeLayer.drawingCtx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            activeLayer.drawingCtx.strokeStyle = this.currentColor;
            activeLayer.drawingCtx.lineCap = 'round';
            activeLayer.drawingCtx.lineJoin = 'round';
            this.points = [{ x: coords.x, y: coords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 }];
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }
    
    onPointerMove(e) {
        if (this.isDrawing) {
            // ペンタブのホバーバグ対策
            if (e.pointerType === 'pen' && e.buttons === 0) {
                 this.onPointerUp(e);
                 return;
            }
            const coords = this.getCanvasCoordinates(e); if (!coords) return;
            const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer) return;
            
            this.points.push({ x: coords.x, y: coords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 });

            // 描き味改善：筆圧と曲線補間
            if (this.points.length < 2) return;

            activeLayer.drawingCtx.clearRect(0, 0, activeLayer.drawingCanvas.width, activeLayer.drawingCanvas.height);
            activeLayer.drawingCtx.putImageData(activeLayer.imageData, 0, 0);
            
            let p1 = this.points[0];
            let p2 = this.points[1];
            
            activeLayer.drawingCtx.beginPath();
            activeLayer.drawingCtx.moveTo(p1.x, p1.y);

            for (let i = 1; i < this.points.length; i++) {
                let midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                activeLayer.drawingCtx.lineWidth = Math.max(0.1, this.currentSize * p2.pressure);
                activeLayer.drawingCtx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
                p1 = this.points[i];
                p2 = this.points[i + 1];
            }
            activeLayer.drawingCtx.stroke();
            this.renderAllLayers();
            return;
        }

        if (!e.buttons) return;
        if (this.isLayerTransforming) { this.applyLayerTransformPreview(e); return; }
        if (this.isPanning || this.isScalingRotatingCanvas) {
            const dx = e.clientX-this.dragStartX, dy = e.clientY-this.dragStartY;
            if (this.isScalingRotatingCanvas) { this.transform.scale = Math.max(0.1, this.originalCanvasTransform.scale * (1 - dy*0.005)); this.transform.rotation = this.originalCanvasTransform.rotation + (dx*0.5); } 
            else { this.transform.left = this.originalCanvasTransform.left+dx; this.transform.top = this.originalCanvasTransform.top+dy; }
            this.applyTransform();
        }
    }

    onPointerUp(e) {
        if (!this.isDrawing) return; // 既に終了処理が走っていたら何もしない
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) document.documentElement.releasePointerCapture(e.pointerId); } catch (err) {}
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer && activeLayer.isDrawing) {
            activeLayer.imageData = activeLayer.drawingCtx.getImageData(0, 0, activeLayer.drawingCanvas.width, activeLayer.drawingCanvas.height);
            activeLayer.isDrawing = false;
        }
        this.isDrawing = false;
        this.app.historyManager.saveState();
        this.renderAllLayers();
        this.points = [];

        this.isPanning = false; this.isScalingRotatingCanvas = false; this.isScalingRotatingLayer = false;
    }
    
    // ... 他のメソッドは変更なし ...
    startLayerTransform() { const a=this.app.layerManager.getCurrentLayer(); if(this.isLayerTransforming||!a||this.app.layerManager.activeLayerIndex===0)return; this.isLayerTransforming=true; this.transformTargetLayerOriginalData=new ImageData(new Uint8ClampedArray(a.imageData.data),a.imageData.width,a.imageData.height); this.originalLayerTransform={...this.layerTransform}; this.layerTransform={translateX:0,translateY:0,scale:1,rotation:0,flipX:1,flipY:1}; this.transformBgCache=document.createElement('canvas'); this.transformBgCache.width=this.displayCanvas.width; this.transformBgCache.height=this.displayCanvas.height; const b=this.transformBgCache.getContext('2d'); this.app.layerManager.layers.forEach((l,i)=>{if(l.visible&&i!==this.app.layerManager.activeLayerIndex){const c=document.createElement('canvas');c.width=l.imageData.width;c.height=l.imageData.height;c.getContext('2d').putImageData(l.imageData,0,0);b.drawImage(c,0,0)}}); this.displayCtx.drawImage(this.transformBgCache,0,0); }
    applyLayerTransformPreview(e) { if(!this.isLayerTransforming)return; const dX=e.clientX-this.dragStartX,dY=e.clientY-this.dragStartY; if(this.isScalingRotatingLayer){this.layerTransform.scale=Math.max(0.01,this.originalLayerTransform.scale*(1-dY*0.005));this.layerTransform.rotation=this.originalLayerTransform.rotation+(dX*0.5*Math.PI/180)}else{this.layerTransform.translateX=this.originalLayerTransform.translateX+dX/this.transform.scale;this.layerTransform.translateY=this.originalLayerTransform.translateY+dY/this.transform.scale} this.displayCtx.drawImage(this.transformBgCache,0,0); const tC=document.createElement('canvas');tC.width=this.displayCanvas.width;tC.height=this.displayCanvas.height;const tX=tC.getContext('2d');tX.putImageData(this.transformTargetLayerOriginalData,0,0);this.displayCtx.save();this.displayCtx.translate(this.displayCanvas.width/2,this.displayCanvas.height/2);this.displayCtx.translate(this.layerTransform.translateX,this.layerTransform.translateY);this.displayCtx.rotate(this.layerTransform.rotation);this.displayCtx.scale(this.layerTransform.scale*this.layerTransform.flipX,this.layerTransform.scale*this.layerTransform.flipY);this.displayCtx.translate(-this.displayCanvas.width/2,-this.displayCanvas.height/2);this.displayCtx.drawImage(tC,0,0);this.displayCtx.restore() }
    commitLayerTransform() { const a=this.app.layerManager.getCurrentLayer();if(!this.isLayerTransforming||!this.transformTargetLayerOriginalData||!a)return; const s=this.transformTargetLayerOriginalData,d=new ImageData(s.width,s.height); const m=new DOMMatrix().translate(s.width/2,s.height/2).translate(this.layerTransform.translateX,this.layerTransform.translateY).rotate(this.layerTransform.rotation*180/Math.PI).scale(this.layerTransform.scale*this.layerTransform.flipX,this.layerTransform.scale*this.layerTransform.flipY).translate(-s.width/2,-s.height/2); const i=m.inverse(); for(let y=0;y<d.height;y++){for(let x=0;x<d.width;x++){const p=new DOMPoint(x,y).matrixTransform(i); const sX=Math.round(p.x),sY=Math.round(p.y); if(sX>=0&&sX<s.width&&sY>=0&&sY<s.height){const sI=(sY*s.width+sX)*4,dI=(y*d.width+x)*4; d.data.set(s.data.subarray(sI,sI+4),dI)}}} a.imageData=d;a.drawingCtx.putImageData(d,0,0);this.isLayerTransforming=false;this.transformBgCache=null;this.transformTargetLayerOriginalData=null;this.renderAllLayers();this.app.historyManager.saveState() }
    fill(sX,sY,fC){const a=this.app.layerManager.getCurrentLayer();if(!a)return;const iD=a.imageData, {width:w,height:h,data:d}=iD,tC=hexToRgba(fC); const stack=[[sX,sY]]; const gP=(x,y)=>{const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]]}; const sC=gP(sX,sY); if(sC.every((v,i)=>v===[tC.r,tC.g,tC.b,tC.a][i]))return; const visited=new Uint8Array(w*h); while(stack.length>0){const[x,y]=stack.pop();if(x<0||x>=w||y<0||y>=h)continue;const p=y*w+x;if(visited[p])continue;if(gP(x,y).every((v,i)=>v===sC[i])){d.set([tC.r,tC.g,tC.b,tC.a],p*4);visited[p]=1;stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])}}a.drawingCtx.putImageData(iD,0,0);this.renderAllLayers()}
    getCanvasCoordinates(e){const r=this.canvasContainer.getBoundingClientRect();if(r.width===0)return null;const t=this.transform;let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const rad=-t.rotation*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);const rX=x*cos-y*sin,rY=x*sin+y*cos;return{x:(rX/(t.scale*t.flipX))+this.displayCanvas.width/2,y:(rY/(t.scale*t.flipY))+this.displayCanvas.height/2}}
    applyTransform(){const t=this.transform;this.canvasContainer.style.transform=`translate(${t.left}px,${t.top}px) scale(${t.scale*t.flipX},${t.scale*t.flipY}) rotate(${t.rotation}deg)`}
    updateCursor(){this.canvasArea.style.cursor=(this.isSpaceDown||(this.isVDown&&!this.isShiftDown))?'grab':(this.isVDown&&this.isShiftDown?'move':'crosshair')}
    flipHorizontal(){this.transform.flipX*=-1;this.applyTransform()}
    flipVertical(){this.transform.flipY*=-1;this.applyTransform()}
    zoom(f){this.transform.scale=Math.max(0.1,Math.min(this.transform.scale*f,10));this.applyTransform()}
    rotate(d){this.transform.rotation=(this.transform.rotation+d)%360;this.applyTransform()}
    resetView(){this.transform={scale:1,rotation:0,flipX:1,flipY:1,left:0,top:0};this.applyTransform()}
    handleWheel(e){if(this.isVDown){if(!this.isLayerTransforming)this.startLayerTransform();if(e.shiftKey)this.layerTransform.rotation+=(e.deltaY>0?-5:5)*Math.PI/180;else this.layerTransform.scale*=e.deltaY>0?0.95:1.05;this.applyLayerTransformPreview(e)}else{if(e.shiftKey)this.rotate(-e.deltaY*0.2);else this.zoom(e.deltaY>0?1/1.05:1.05)}}
    bindEvents(){this.canvasArea.addEventListener('pointerdown',this.onPointerDown.bind(this));document.addEventListener('pointermove',this.onPointerMove.bind(this));document.addEventListener('pointerup',this.onPointerUp.bind(this));document.addEventListener('contextmenu',e=>e.preventDefault());document.getElementById('saveMergedButton').addEventListener('click',()=>this.exportMergedImage())}
    setCurrentTool(t){this.currentTool=t}
    setCurrentColor(c){this.currentColor=c}
    setCurrentSize(s){this.currentSize=s}
    undo(){this.app.historyManager.undo()}
    redo(){this.app.historyManager.redo()}
    clearCanvas(){const l=this.app.layerManager.getCurrentLayer();if(l){l.clear();if(this.app.layerManager.activeLayerIndex===0)l.fill('#f0e0d6');this.renderAllLayers();this.app.historyManager.saveState()}}
    clearAllLayers(){this.app.layerManager.layers.forEach((l,i)=>{l.clear();if(i===0)l.fill('#f0e0d6')});this.renderAllLayers();this.app.historyManager.saveState()}
    exportMergedImage(){const m=document.createElement('canvas');m.width=this.displayCanvas.width;m.height=this.displayCanvas.height;const x=m.getContext('2d');this.app.layerManager.layers.forEach(l=>{if(l.visible&&l.imageData){const t=document.createElement('canvas');t.width=l.imageData.width;t.height=l.imageData.height;t.getContext('2d').putImageData(l.imageData,0,0);x.drawImage(t,0,0)}});const u=m.toDataURL('image/png');const a=document.createElement('a');a.href=u;a.download='TegakiImage.png';a.click()}
}

class LayerManager {
    constructor(app){this.app=app;this.layers=[];this.activeLayerIndex=-1;this.width=344;this.height=135}
    setupInitialLayers(){const b=new Layer('背景',this.width,this.height);b.fill('#f0e0d6');this.layers.push(b);this.layers.push(new Layer('レイヤー 1',this.width,this.height));this.switchLayer(1)}
    addLayer(){if(this.layers.length>=99)return;const i=this.activeLayerIndex+1;this.layers.splice(i,0,new Layer(`レイヤー ${this.layers.length}`,this.width,this.height));this.renameLayers();this.switchLayer(i);this.app.historyManager.saveState()}
    deleteActiveLayer(){if(this.activeLayerIndex<=0)return;const i=this.activeLayerIndex;this.layers.splice(i,1);this.renameLayers();this.switchLayer(Math.max(0,i-1));this.app.historyManager.saveState()}
    duplicateActiveLayer(){const a=this.getCurrentLayer();if(!a)return;const i=this.activeLayerIndex+1;const n=new Layer(`複製`,this.width,this.height);n.imageData.data.set(a.imageData.data);n.drawingCtx.putImageData(n.imageData,0,0);this.layers.splice(i,0,n);this.renameLayers();this.switchLayer(i);this.app.historyManager.saveState()}
    mergeDownActiveLayer(){if(this.activeLayerIndex<=0)return;const t=this.layers[this.activeLayerIndex],b=this.layers[this.activeLayerIndex-1];const tD=t.imageData.data,bD=b.imageData.data;for(let i=0;i<tD.length;i+=4){const sA=tD[i+3]/255;if(sA===0)continue;const dA=bD[i+3]/255,oA=sA+dA*(1-sA);if(oA===0)continue;bD[i]=(tD[i]*sA+bD[i]*dA*(1-sA))/oA;bD[i+1]=(tD[i+1]*sA+bD[i+1]*dA*(1-sA))/oA;bD[i+2]=(tD[i+2]*sA+bD[i+2]*dA*(1-sA))/oA;bD[i+3]=oA*255}b.drawingCtx.putImageData(b.imageData,0,0);this.layers.splice(this.activeLayerIndex,1);this.renameLayers();this.switchLayer(this.activeLayerIndex-1);this.app.historyManager.saveState()}
    switchLayer(i){if(i<0||i>=this.layers.length)return;this.activeLayerIndex=i;if(this.app.layerUIManager)this.app.layerUIManager.renderLayers()}
    renameLayers(){this.layers.forEach((l,i)=>l.name=i===0?'背景':`レイヤー ${i}`)}
    getCurrentLayer(){return this.layers[this.activeLayerIndex]}
}

class HistoryManager {
    constructor(app){this.app=app;this.history=[];this.historyIndex=-1}
    saveState(){const s={layers:this.app.layerManager.layers.map(l=>new ImageData(new Uint8ClampedArray(l.imageData.data),l.imageData.width,l.imageData.height)),activeLayerIndex:this.app.layerManager.activeLayerIndex};this.history=this.history.slice(0,this.historyIndex+1);this.history.push(s);this.historyIndex++}
    undo(){if(this.historyIndex<=0)return;this.historyIndex--;this.restoreState(this.history[this.historyIndex])}
    redo(){if(this.historyIndex<this.history.length-1){this.historyIndex++;this.restoreState(this.history[this.historyIndex])}}
    restoreState(s){this.app.layerManager.layers.forEach((l,i)=>{if(s.layers[i]){l.imageData.data.set(s.layers[i].data);l.drawingCtx.putImageData(l.imageData,0,0)}});this.app.layerManager.activeLayerIndex=s.activeLayerIndex;this.app.layerManager.switchLayer(s.activeLayerIndex);this.app.canvasManager.renderAllLayers()}
}

class ToshinkaTegakiTool {
    constructor() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.historyManager = new HistoryManager(this);
        this.layerUIManager = null; this.shortcutManager = null; this.topBarManager = null;
        this.penSettingsManager = null; this.colorManager = null; this.toolManager = null;
    }
    init() {
        this.layerManager.setupInitialLayers();
        this.historyManager.saveState();
        this.canvasManager.renderAllLayers();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        
        // ui.js側で各種UIマネージャーを初期化し、最後にapp.init()を呼び出す
        // そのため、ここではapp.init()を呼ばない
    }
});