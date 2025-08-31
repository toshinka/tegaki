/**
 * PenTool - 座標変換のみ修正版（既存システム完全互換）
 * 元のPenToolをベースに座標変換ロジックのみ修正
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor() {
        super('pen');
        
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        
        this.strokeWidth = 3;
        this.strokeColor = 0x800000; // futaba-maroon
        
        console.log('🖊️ PenTool v8 座標修正版 作成完了');
    }
    
    onPointerDown(e) {
        console.log('🖊️ PenTool: onPointerDown() 開始');
        
        if (!e) {
            console.warn('⚠️ イベントが null');
            return;
        }
        
        const coords = this.convertEventToCoords(e);
        if (!coords) {
            console.warn('⚠️ 座標変換失敗');
            return;
        }
        
        console.log('🖊️ 描画開始座標:', coords);
        
        this.isDrawing = true;
        this.currentPath = [coords];
        this.startStroke(coords);
        
        e.preventDefault();
    }
    
    onPointerMove(e) {
        if (!this.isDrawing || !e) return;
        
        const coords = this.convertEventToCoords(e);
        if (!coords) return;
        
        this.currentPath.push(coords);
        this.updateStroke(coords);
        
        e.preventDefault();
    }
    
    onPointerUp(e) {
        console.log('🖊️ onPointerUp - isDrawing:', this.isDrawing);
        
        if (!this.isDrawing) return;
        
        this.finishStroke();
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        
        console.log('🖊️ 描画完了');
        
        if (e) e.preventDefault();
    }
    
    /**
     * 座標変換（修正版・フォールバック付き）
     */
    convertEventToCoords(e) {
        if (!e) return null;
        
        const clientCoords = this.getClientXY(e);
        if (!clientCoords) {
            console.warn('⚠️ clientX/Y取得失敗');
            return null;
        }
        
        // Method 1: 既存CoordinateManager使用
        if (this.coordinateManager) {
            try {
                if (typeof this.coordinateManager.clientToWorld === 'function') {
                    const result = this.coordinateManager.clientToWorld(clientCoords.x, clientCoords.y);
                    if (result && typeof result.x === 'number' && typeof result.y === 'number') {
                        return result;
                    }
                }
                
                if (typeof this.coordinateManager.toCanvasCoords === 'function') {
                    const result = this.coordinateManager.toCanvasCoords(clientCoords.x, clientCoords.y);
                    if (result && typeof result.x === 'number' && typeof result.y === 'number') {
                        return result;
                    }
                }
            } catch (error) {
                console.warn('⚠️ CoordinateManager変換失敗:', error);
            }
        }
        
        // Method 2: 直接計算フォールバック
        return this.fallbackCoordinateConversion(clientCoords);
    }
    
    /**
     * 座標変換フォールバック（DPR対応・NaN防止）
     */
    fallbackCoordinateConversion(clientCoords) {
        try {
            const canvas = this.canvasManager?.getCanvasElement();
            if (!canvas) {
                console.error('❌ Canvas要素が取得できません');
                return null;
            }
            
            const rect = canvas.getBoundingClientRect();
            
            // DPR適用（最大2.0に制限）
            const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
            
            // Canvas座標計算
            const x = (clientCoords.x - rect.left) * dpr;
            const y = (clientCoords.y - rect.top) * dpr;
            
            // NaN検証
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                console.warn('⚠️ 座標計算でNaN発生');
                return null;
            }
            
            console.log('📐 座標変換:', {
                client: clientCoords,
                rect: { left: rect.left, top: rect.top },
                dpr: dpr,
                result: { x, y }
            });
            
            return { x, y };
            
        } catch (error) {
            console.error('❌ フォールバック座標変換失敗:', error);
            return null;
        }
    }
    
    /**
     * clientX/Y取得（TouchEvent対応）
     */
    getClientXY(e) {
        if (!e) return null;
        
        // PointerEvent/MouseEvent
        if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
            return { x: e.clientX, y: e.clientY };
        }
        
        // TouchEvent
        const touch = e.touches?.[0] || e.changedTouches?.[0];
        if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
            return { x: touch.clientX, y: touch.clientY };
        }
        
        return null;
    }
    
    /**
     * ストローク開始
     */
    startStroke(coords) {
        try {
            const drawContainer = this.canvasManager?.getDrawContainer();
            if (!drawContainer) {
                console.error('❌ DrawContainer取得失敗');
                return;
            }
            
            this.currentStroke = new PIXI.Graphics();
            
            this.currentStroke.lineStyle({
                width: this.strokeWidth,
                color: this.strokeColor,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            this.currentStroke.moveTo(coords.x, coords.y);
            drawContainer.addChild(this.currentStroke);
            
        } catch (error) {
            console.error('❌ ストローク開始エラー:', error);
        }
    }
    
    /**
     * ストローク更新
     */
    updateStroke(coords) {
        if (!this.currentStroke) return;
        
        try {
            this.currentStroke.lineTo(coords.x, coords.y);
        } catch (error) {
            console.error('❌ ストローク更新エラー:', error);
        }
    }
    
    /**
     * ストローク完成
     */
    finishStroke() {
        if (!this.currentStroke || this.currentPath.length < 2) return;
        
        try {
            if (this.recordManager && typeof this.recordManager.recordStroke === 'function') {
                const strokeData = {
                    type: 'pen',
                    path: [...this.currentPath],
                    style: {
                        width: this.strokeWidth,
                        color: this.strokeColor
                    },
                    timestamp: Date.now()
                };
                
                this.recordManager.recordStroke(strokeData);
            }
        } catch (error) {
            console.error('❌ ストローク記録エラー:', error);
        }
    }
    
    activate() {
        super.activate();
        console.log('🖊️ PenTool アクティブ化');
    }
    
    deactivate() {
        if (this.isDrawing) {
            this.finishStroke();
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentPath = [];
        }
        
        super.deactivate();
        console.log('🖊️ PenTool 非アクティブ化');
    }
}

// グローバル登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool 座標修正版 Loaded - 既存システム互換・フォールバック対応');