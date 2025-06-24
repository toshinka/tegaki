// Toshinka Tegaki Tool core.js v1.6 rev5.3 (ImageData-based, Hotfix 3)

// --- Color Utility ---
function hexToRgba(hex) {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return {r,g,b,a:255};
}

// --- CanvasManager (描画とビュー操作を担当) ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas'); this.displayCtx = this.displayCanvas.getContext('2d');
        this.displayCanvas.width = 344; this.displayCanvas.height = 135;
        this.canvasArea = document.getElementById('canvas-area'); this.canvasContainer = document.getElementById('canvas-container');
        this.isDrawing=false; this.isPanning=false; this.isLayerTransforming=false; this.isSpaceDown=false; this.isVDown=false; this.isShiftDown=false; this.isScalingRotatingLayer=false; this.isScalingRotatingCanvas=false;
        this.currentTool='pen'; this.currentColor='#800000'; this.currentSize=1;
        this.points=[]; this.animationFrameId=null; this.lastRenderedPointIndex=0;
        this.dragStartX=0; this.dragStartY=0;
        this.transform={scale:1,rotation:0,flipX:1,flipY:1,left:0,top:0}; this.originalCanvasTransform={};
        this.layerTransform={translateX:0,translateY:0,scale:1,rotation:0,flipX:1,flipY:1}; this.originalLayerTransform={}; this.transformTargetLayerOriginalData=null;
        this.lastWheelTime=0; this.wheelThrottle=50;
        this.createAndDrawFrame(); this.bindEvents();
    }
    
    createAndDrawFrame() {
        const fC=document.createElement('canvas');fC.width=364;fC.height=145;fC.style.cssText="position:absolute;left:-10px;top:-5px;z-index:-1;pointer-events:none;";
        this.canvasContainer.insertBefore(fC,this.displayCanvas); const fX=fC.getContext('2d');
        fX.fillStyle='#fff'; fX.strokeStyle='#ccc'; fX.lineWidth=1; fX.beginPath();
        if(fX.roundRect)fX.roundRect(.5,.5,fC.width-1,fC.height-1,8); else fX.rect(.5,.5,fC.width-1,fC.height-1);
        fX.fill();fX.stroke();
    }

    renderAllLayers(){if(!this.app.layerManager.layers.length)return;this.displayCtx.clearRect(0,0,this.displayCanvas.width,this.displayCanvas.height);const tC=document.createElement('canvas');tC.width=this.displayCanvas.width;tC.height=this.displayCanvas.height;const tX=tC.getContext('2d');this.app.layerManager.layers.forEach(l=>{if(l.imageData&&l.visible){tX.putImageData(l.imageData,0,0);this.displayCtx.drawImage(tC,0,0)}});if(this.isLayerTransforming&&this.transformTargetLayerOriginalData)this.applyLayerTransformPreview()}
    
    // ★★★ アンチエイリアス処理を実装 ★★★
    _drawOnImageData(pointsToDraw) {
        const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer || pointsToDraw.length < 1) return;
        const imageData = activeLayer.imageData, color = hexToRgba(this.currentColor), tool = this.currentTool;

        const drawPixel = (x, y, alpha) => {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height || alpha <= 0) return;
            const i = (y * imageData.width + x) * 4;
            if (tool === 'eraser') {
                const currentAlpha = imageData.data[i + 3] / 255;
                imageData.data[i + 3] = Math.max(0, currentAlpha - alpha) * 255;
            } else {
                const srcA = (color.a / 255) * alpha; if(srcA === 0) return;
                const destR=imageData.data[i],destG=imageData.data[i+1],destB=imageData.data[i+2],destA=imageData.data[i+3]/255;
                const outA = srcA + destA * (1 - srcA); if(outA === 0) return;
                imageData.data[i] = (color.r*srcA+destR*destA*(1-srcA))/outA;
                imageData.data[i+1] = (color.g*srcA+destG*destA*(1-srcA))/outA;
                imageData.data[i+2] = (color.b*srcA+destB*destA*(1-srcA))/outA;
                imageData.data[i+3] = outA*255;
            }
        };

        const drawCircle = (cx, cy, radius, pressure) => {
            const r = Math.max(0.5, (radius / 2) * pressure);
            const searchR = r + 1;
            for (let y = Math.floor(cy-searchR); y <= Math.ceil(cy+searchR); y++) {
                for (let x = Math.floor(cx-searchR); x <= Math.ceil(cx+searchR); x++) {
                    const dist = Math.sqrt((x - cx)**2 + (y - cy)**2);
                    const alpha = Math.max(0, Math.min(1, r - dist + 0.5));
                    drawPixel(x, y, alpha);
                }
            }
        };

        if (pointsToDraw.length === 1) drawCircle(pointsToDraw[0].x, pointsToDraw[0].y, this.currentSize, pointsToDraw[0].pressure);
        for (let i = 0; i < pointsToDraw.length - 1; i++) {
             const p1=pointsToDraw[i],p2=pointsToDraw[i+1],dist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2),steps=Math.max(1,Math.ceil(dist));
             for (let j=0; j<steps; j++) {
                 const t=j/steps,x=p1.x+(p2.x-p1.x)*t,y=p1.y+(p2.y-p1.y)*t,pressure=p1.pressure+(p2.pressure-p1.pressure)*t;
                 drawCircle(x,y,this.currentSize,pressure);
             }
        }
    }

    onPointerDown(e){if(e.button!==0)return;if(this.isLayerTransforming){this.commitLayerTransform();return}const cD=()=>{this.dragStartX=e.clientX;this.dragStartY=e.clientY;e.preventDefault()};if(this.isVDown){if(!this.isLayerTransforming)this.startLayerTransform();cD();this.isScalingRotatingLayer=this.isShiftDown;this.originalLayerTransform={...this.layerTransform};return}if(this.isSpaceDown){cD();this.isScalingRotatingCanvas=this.isShiftDown;this.isPanning=!this.isShiftDown;this.originalCanvasTransform={...this.transform};return}const crds=this.getCanvasCoordinates(e);if(!crds||crds.x<0||crds.x>=this.displayCanvas.width||crds.y<0||crds.y>=this.displayCanvas.height)return;if(this.currentTool==='bucket'){this.fill(Math.floor(crds.x),Math.floor(crds.y),this.currentColor);this.app.historyManager.saveState()}else{this.isDrawing=true;this.points=[{x:crds.x,y:crds.y,pressure:e.pressure===0?1.0:e.pressure||1.0}];this.startSmoothDrawing()}try{document.documentElement.setPointerCapture(e.pointerId)}catch(err){}}
    
    // ★★★ ペンタブ対応のため、isDrawingフラグを先にチェック ★★★
    onPointerMove(e) {
        if (this.isDrawing) {
            const currentCoords = this.getCanvasCoordinates(e);
            if(!currentCoords) return;
            this.points.push({ x: currentCoords.x, y: currentCoords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 });
            return;
        }
        if (!e.buttons) return;
        if(this.isScalingRotatingCanvas||this.isPanning){const dX=e.clientX-this.dragStartX,dY=e.clientY-this.dragStartY;if(this.isScalingRotatingCanvas){this.transform.scale=Math.max(0.1,this.originalCanvasTransform.scale*(1-dY*0.005));this.transform.rotation=this.originalCanvasTransform.rotation+(dX*0.5)}else{this.transform.left=this.originalCanvasTransform.left+dX;this.transform.top=this.originalCanvasTransform.top+dY}this.applyTransform();return}
        if(this.isLayerTransforming){const dX=e.clientX-this.dragStartX,dY=e.clientY-this.dragStartY;if(this.isScalingRotatingLayer){this.layerTransform.scale=Math.max(0.01,this.originalLayerTransform.scale*(1-dY*0.005));this.layerTransform.rotation=this.originalLayerTransform.rotation+(dX*0.5*Math.PI/180)}else{this.layerTransform.translateX=this.originalLayerTransform.translateX+dX/this.transform.scale;this.layerTransform.translateY=this.originalLayerTransform.translateY+dY/this.transform.scale}this.renderAllLayers();return}
    }

    onPointerUp(e){if(e.button!==0)return;try{if(document.documentElement.hasPointerCapture(e.pointerId))document.documentElement.releasePointerCapture(e.pointerId)}catch(err){}if(this.isDrawing){this.isDrawing=false;this.stopSmoothDrawing();this._drawOnImageData(this.points);this.renderAllLayers();this.app.historyManager.saveState();this.points=[]}this.isScalingRotatingLayer=false;this.isScalingRotatingCanvas=false;this.isPanning=false}
    
    startSmoothDrawing(){this.lastRenderedPointIndex=0;if(this.animationFrameId)cancelAnimationFrame(this.animationFrameId);this.animationFrameId=requestAnimationFrame(this.smoothDrawLoop.bind(this))}
    stopSmoothDrawing(){if(this.animationFrameId){cancelAnimationFrame(this.animationFrameId);this.animationFrameId=null}}
    smoothDrawLoop(){if(!this.isDrawing)return;if(this.lastRenderedPointIndex<this.points.length){const pTR=this.points.slice(this.lastRenderedPointIndex>0?this.lastRenderedPointIndex-1:0);this._drawOnImageData(pTR);this.lastRenderedPointIndex=this.points.length;this.renderAllLayers()}this.animationFrameId=requestAnimationFrame(this.smoothDrawLoop.bind(this))}

    getCanvasCoordinates(e){const r=this.canvasContainer.getBoundingClientRect();if(r.width===0)return null;const t=this.transform;let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const rad=-t.rotation*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);const rX=x*cos-y*sin,rY=x*sin+y*cos;return{x:(rX/(t.scale*t.flipX))+this.displayCanvas.width/2,y:(rY/(t.scale*t.flipY))+this.displayCanvas.height/2}}
    applyTransform(){const t=this.transform;this.canvasContainer.style.transform=`translate(${t.left}px, ${t.top}px) scale(${t.scale*t.flipX},${t.scale*t.flipY}) rotate(${t.rotation}deg)`}
    startLayerTransform(){const aL=this.app.layerManager.getCurrentLayer();if(this.isLayerTransforming||!aL||this.app.layerManager.activeLayerIndex===0)return;this.isLayerTransforming=true;this.transformTargetLayerOriginalData=new ImageData(new Uint8ClampedArray(aL.imageData.data),aL.imageData.width,aL.imageData.height);aL.clear();this.layerTransform={translateX:0,translateY:0,scale:1,rotation:0,flipX:1,flipY:1};this.renderAllLayers()}
    applyLayerTransformPreview(){const oD=this.transformTargetLayerOriginalData;if(!oD)return;const tC=document.createElement('canvas');tC.width=this.displayCanvas.width;tC.height=this.displayCanvas.height;const tX=tC.getContext('2d');tX.putImageData(oD,0,0);this.displayCtx.save();this.displayCtx.translate(this.displayCanvas.width/2,this.displayCanvas.height/2);this.displayCtx.translate(this.layerTransform.translateX,this.layerTransform.translateY);this.displayCtx.rotate(this.layerTransform.rotation);this.displayCtx.scale(this.layerTransform.scale*this.layerTransform.flipX,this.layerTransform.scale*this.layerTransform.flipY);this.displayCtx.translate(-this.displayCanvas.width/2,-this.displayCanvas.height/2);this.displayCtx.drawImage(tC,0,0);this.displayCtx.restore()}
    commitLayerTransform(){const aL=this.app.layerManager.getCurrentLayer();if(!this.isLayerTransforming||!this.transformTargetLayerOriginalData||!aL)return;this.isLayerTransforming=false;const tC=document.createElement('canvas');tC.width=this.displayCanvas.width;tC.height=this.displayCanvas.height;const tX=tC.getContext('2d');const sC=document.createElement('canvas');sC.width=this.displayCanvas.width;sC.height=this.displayCanvas.height;sC.getContext('2d').putImageData(this.transformTargetLayerOriginalData,0,0);tX.save();tX.translate(tC.width/2,tC.height/2);tX.translate(this.layerTransform.translateX,this.layerTransform.translateY);tX.rotate(this.layerTransform.rotation);tX.scale(this.layerTransform.scale*this.layerTransform.flipX,this.layerTransform.scale*this.layerTransform.flipY);tX.translate(-tC.width/2,-tC.height/2);tX.drawImage(sC,0,0);tX.restore();aL.imageData=tX.getImageData(0,0,tC.width,tC.height);this.transformTargetLayerOriginalData=null;this.renderAllLayers();this.app.historyManager.saveState()}
    clearCanvas(){const aL=this.app.layerManager.getCurrentLayer();if(aL){aL.clear();if(this.app.layerManager.activeLayerIndex===0)aL.fill('#f0e0d6');this.renderAllLayers();this.app.historyManager.saveState()}}
    clearAllLayers(){this.app.layerManager.layers.forEach((l,i)=>{l.clear();if(i===0)l.fill('#f0e0d6')});this.renderAllLayers();this.app.historyManager.saveState()}
    exportMergedImage(){const mC=document.createElement('canvas');mC.width=this.displayCanvas.width;mC.height=this.displayCanvas.height;const mX=mC.getContext('2d');const tC=document.createElement('canvas');tC.width=this.displayCanvas.width;tC.height=this.displayCanvas.height;const tX=tC.getContext('2d');this.app.layerManager.layers.forEach(l=>{if(l.imageData){tX.clearRect(0,0,tC.width,tC.height);tX.putImageData(l.imageData,0,0);mX.drawImage(tC,0,0)}});const dU=mC.toDataURL('image/png');const l=document.createElement('a');l.href=dU;l.download='TegakiImage.png';l.click()}
    flipHorizontal(){this.transform.flipX*=-1;this.applyTransform()}
    flipVertical(){this.transform.flipY*=-1;this.applyTransform()}
    zoom(f){this.transform.scale=Math.max(0.1,Math.min(this.transform.scale*f,10));this.applyTransform()}
    rotate(d){this.transform.rotation=(this.transform.rotation+d)%360;this.applyTransform()}
    resetView(){this.transform={scale:1,rotation:0,flipX:1,flipY:1,left:0,top:0};this.applyTransform()}
    handleWheel(e){e.preventDefault();const n=Date.now();if(n-this.lastWheelTime<this.wheelThrottle)return;this.lastWheelTime=n;let dY=Math.max(-30,Math.min(30,e.deltaY));if(this.isVDown){if(!this.isLayerTransforming)this.startLayerTransform();if(e.shiftKey)this.layerTransform.rotation+=(dY>0?-5:5)*Math.PI/180;else this.layerTransform.scale*=dY>0?0.95:1.05;this.renderAllLayers()}else{if(e.shiftKey)this.rotate(-dY*0.2);else this.zoom(dY>0?1/1.05:1.05)}}
    fill(sX,sY,fC){const aL=this.app.layerManager.getCurrentLayer();if(!aL)return;const{width:w,height:h,data:d}=aL.imageData;const tC=hexToRgba(fC);const stack=[[sX,sY]];const gP=(x,y)=>{const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]]};const sC=gP(sX,sY);if(sC.every((v,i)=>(v===[tC.r,tC.g,tC.b,tC.a][i])))return;const visited=new Uint8Array(w*h);while(stack.length>0){const[x,y]=stack.pop();if(x<0||x>=w||y<0||y>=h)continue;const pos=y*w+x;if(visited[pos])continue;if(gP(x,y).every((v,i)=>v===sC[i])){const i=pos*4;d[i]=tC.r;d[i+1]=tC.g;d[i+2]=tC.b;d[i+3]=tC.a;visited[pos]=1;stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])}}this.renderAllLayers()}
    bindEvents(){this.canvasArea.addEventListener('pointerdown',this.onPointerDown.bind(this));document.addEventListener('pointermove',this.onPointerMove.bind(this));document.addEventListener('pointerup',this.onPointerUp.bind(this));this.canvasArea.addEventListener('wheel',this.handleWheel.bind(this),{passive:false});document.addEventListener('contextmenu',e=>e.preventDefault());document.getElementById('saveMergedButton').addEventListener('click',()=>this.exportMergedImage())}
    updateCursor(){this.canvasArea.style.cursor=(this.isSpaceDown||(this.isVDown&&!this.isShiftDown))?'grab':(this.isVDown&&this.isShiftDown?'move':'crosshair')}
    setCurrentTool(t){this.currentTool=t;this.updateCursor()}
    setCurrentColor(c){this.currentColor=c}
    setCurrentSize(s){this.currentSize=s}
    // ★★★ undo/redoのラッパーメソッドを追加 ★★★
    undo() { this.app.historyManager.undo(); }
    redo() { this.app.historyManager.redo(); }
}
class Layer{constructor(n,w,h){this.name=n;this.imageData=new ImageData(w,h);this.visible=true}clear(){this.imageData.data.fill(0)}fill(hC){const c=hexToRgba(hC);for(let i=0;i<this.imageData.data.length;i+=4)this.imageData.data.set([c.r,c.g,c.b,c.a],i)}}
class LayerManager{constructor(a){this.app=a;this.layers=[];this.activeLayerIndex=-1;this.width=344;this.height=135}setupInitialLayers(){const b=new Layer('背景',this.width,this.height);b.fill('#f0e0d6');this.layers.push(b);this.layers.push(new Layer('レイヤー 1',this.width,this.height));this.switchLayer(1)}addLayer(){if(this.layers.length>=99)return;const i=this.activeLayerIndex+1;this.layers.splice(i,0,new Layer(`レイヤー ${this.layers.length}`,this.width,this.height));this.renameLayers();this.switchLayer(i);this.app.historyManager.saveState()}deleteActiveLayer(){if(this.activeLayerIndex<=0)return;this.layers.splice(this.activeLayerIndex,1);const i=Math.max(1,this.activeLayerIndex-1);this.renameLayers();this.switchLayer(i);this.app.historyManager.saveState()}duplicateActiveLayer(){const a=this.getCurrentLayer();if(!a)return;const i=this.activeLayerIndex+1;const n=new Layer(`複製`,this.width,this.height);n.imageData.data.set(a.imageData.data);this.layers.splice(i,0,n);this.renameLayers();this.switchLayer(i);this.app.historyManager.saveState()}mergeDownActiveLayer(){if(this.activeLayerIndex<=0)return;const tL=this.layers[this.activeLayerIndex],bL=this.layers[this.activeLayerIndex-1];const tD=tL.imageData.data,bD=bL.imageData.data;for(let i=0;i<tD.length;i+=4){const sA=tD[i+3]/255;if(sA===0)continue;const dA=bD[i+3]/255,oA=sA+dA*(1-sA);bD[i]=(tD[i]*sA+bD[i]*dA*(1-sA))/oA;bD[i+1]=(tD[i+1]*sA+bD[i+1]*dA*(1-sA))/oA;bD[i+2]=(tD[i+2]*sA+bD[i+2]*dA*(1-sA))/oA;bD[i+3]=oA*255}this.layers.splice(this.activeLayerIndex,1);this.renameLayers();this.switchLayer(this.activeLayerIndex-1);this.app.historyManager.saveState()}switchLayer(i){if(i<0||i>=this.layers.length)return;this.activeLayerIndex=i;if(this.app.layerUIManager)this.app.layerUIManager.renderLayers()}renameLayers(){this.layers.forEach((l,i)=>l.name=i===0?'背景':`レイヤー ${i}`)}getCurrentLayer(){return this.layers[this.activeLayerIndex]}}
class HistoryManager{constructor(a){this.app=a;this.history=[];this.historyIndex=-1}saveState(){const s=this.app.layerManager.layers.map(l=>({name:l.name,visible:l.visible,imageData:new ImageData(new Uint8ClampedArray(l.imageData.data),l.imageData.width,l.imageData.height)}));this.history=this.history.slice(0,this.historyIndex+1);this.history.push({layers:s,activeLayerIndex:this.app.layerManager.activeLayerIndex});this.historyIndex++}undo(){if(this.historyIndex<=0)return;this.historyIndex--;this.restoreState(this.history[this.historyIndex])}redo(){if(this.historyIndex>=this.history.length-1)return;this.historyIndex++;this.restoreState(this.history[this.historyIndex])}restoreState(s){this.app.layerManager.layers=s.layers.map(d=>{const l=new Layer(d.name,d.imageData.width,d.imageData.height);l.imageData.data.set(d.imageData.data);l.visible=d.visible;return l});this.app.layerManager.switchLayer(s.activeLayerIndex);this.app.canvasManager.renderAllLayers()}}
class PenSettingsManager{constructor(a){this.app=a;this.bindEvents();this.setSize(1)}bindEvents(){document.querySelectorAll('.size-btn').forEach(b=>b.addEventListener('click',()=>this.setSize(parseInt(b.dataset.size))))}setSize(s){this.currentSize=s;document.querySelectorAll('.size-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.size)===s));this.app.canvasManager.setCurrentSize(s)}changeSize(i){const s=[1,3,5,10,30];let n=s.indexOf(this.currentSize);n+=i?1:-1;n=Math.max(0,Math.min(n,s.length-1));this.setSize(s[n])}}
class ColorManager{constructor(a){this.app=a;this.mainColor='#800000';this.subColor='#f0e0d6';this.mainD=document.getElementById('main-color-display');this.subD=document.getElementById('sub-color-display');this.bindEvents();this.setColor(this.mainColor)}bindEvents(){document.querySelectorAll('.color-btn').forEach(b=>b.addEventListener('click',()=>this.setColor(b.dataset.color)));document.querySelector('.color-mode-display').addEventListener('click',()=>this.swapColors())}setColor(c){this.mainColor=c;document.querySelectorAll('.color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===c));this.updateDisplays();this.app.canvasManager.setCurrentColor(c)}updateDisplays(){this.mainD.style.backgroundColor=this.mainColor;this.subD.style.backgroundColor=this.subColor}swapColors(){[this.mainColor,this.subColor]=[this.subColor,this.mainColor];this.setColor(this.mainColor)}resetColors(){this.setColor('#800000');this.subColor='#f0e0d6';this.updateDisplays()}changeColor(i){const c=Array.from(document.querySelectorAll('.color-btn')).map(b=>b.dataset.color);let n=c.indexOf(this.mainColor);n+=i?1:-1;n=(n+c.length)%c.length;this.setColor(c[n])}}
class ToolManager{constructor(a){this.app=a;this.bindEvents()}bindEvents(){document.getElementById('pen-tool').addEventListener('click',()=>this.setTool('pen'));document.getElementById('eraser-tool').addEventListener('click',()=>this.setTool('eraser'));document.getElementById('bucket-tool').addEventListener('click',()=>this.setTool('bucket'))}setTool(t){this.currentTool=t;document.querySelectorAll('.tools .tool-btn').forEach(b=>b.classList.remove('active'));const btn=document.getElementById(t+'-tool');if(btn)btn.classList.add('active');this.app.canvasManager.setCurrentTool(t)}}
class ToshinkaTegakiTool{constructor(){this.canvasManager=new CanvasManager(this);this.layerManager=new LayerManager(this);this.historyManager=new HistoryManager(this);this.penSettingsManager=new PenSettingsManager(this);this.toolManager=new ToolManager(this);this.colorManager=new ColorManager(this);this.layerUIManager=null;this.shortcutManager=null;this.topBarManager=null}init(){this.layerManager.setupInitialLayers();this.toolManager.setTool('pen');this.penSettingsManager.setSize(1);this.colorManager.setColor('#800000');this.historyManager.saveState();this.canvasManager.renderAllLayers()}}
window.addEventListener('DOMContentLoaded',()=>{if(!window.toshinkaTegakiInitialized){window.toshinkaTegakiInitialized=true;const a=new ToshinkaTegakiTool();window.toshinkaTegakiTool=a;a.init()}});