/**
 * 🧹 EraserTool - 座標修正・真の消去機能版
 * 📋 RESPONSIBILITY: 描画内容の消去処理のみ（アクティブレイヤー対象）
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換
 * ✅ PERMISSION: PIXI.Graphics作成・消去処理・CanvasManagerへの渡し
 * 
 * 📏 DESIGN_PRINCIPLE: 消しゴム専門・ERASEブレンドモード活用
 * 🔄 INTEGRATION: CanvasManagerのaddEraseGraphicsToLayer使用
 * 🔧 FIX: ERASEブレンドモード修正・座標問題解決・消去機能完成
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * EraserTool - 座標修正・真の消去機能版
 * アクティブレイヤーの描画内容を正確な座標で消去する専任クラス
 */
class EraserTool {
    constructor() {
        console.log('🧹 EraserTool 座標修正・真の消去機能版 作成');
        
        this.canvasManager = null;
        this.isErasing = false;
        this.currentErasePath = null;
        this.points = [];
        
        // 消しゴム設定
        this.eraserSize = 20;         // デフォルト消しゴムサイズ
        this.eraserOpacity = 1.0;     // 消去強度（完全消去）
        this.smoothErasing = true;    // スムーズ消去
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('🧹 EraserTool - CanvasManager設定完了');
    }
    
    /**
     * 消去開始（座標修正版）
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) {
            console.warn('⚠️ CanvasManager not set');
            return;
        }
        
        // アクティブレイヤー確認（背景レイヤーは保護）
        const activeLayerId = this.canvasManager.getActiveLayerId();
        if (activeLayerId === 'layer0') {
            console.warn('⚠️ 背景レイヤーへの消去は禁止されています');
            return;
        }
        
        console.log(`🧹 消去開始: layer=${activeLayerId}, pos=(${Math.round(x)}, ${Math.round(y)}), size=${this.eraserSize}`);
        
        this.isErasing = true;
        this.points = [{x, y}];
        
        // 🧹 新しい消去パス作成
        this.currentErasePath = new PIXI.Graphics();
        
        // 🔧 消去用円形描画（白色で描画後ERASEブレンドモード適用）
        this.drawEraseCircle(x, y);
        
        // 🧹 ERASEブレンドモード設定（重要：描画後に設定）
        this.currentErasePath.blendMode = PIXI.BLEND_MODES.ERASE;
        
        // アクティブレイヤーに追加（専用メソッド使用）
        this.canvasManager.addEraseGraphicsToLayer(this.currentErasePath);
    }
    
    /**
     * 消去継続（座標修正版）
     */
    onPointerMove(x, y, event) {
        if (!this.isErasing || !this.currentErasePath) return;
        
        // 点を記録
        this.points.push({x, y});
        
        // 現在位置に消去円描画
        this.drawEraseCircle(x, y);
        
        // スムーズ消去：前の点との間を補間
        if (this.smoothErasing && this.points.length > 1) {
            const prevPoint = this.points[this.points.length - 2];
            const distance = Math.sqrt(
                Math.pow(x - prevPoint.x, 2) + Math.pow(y - prevPoint.y, 2)
            );
            
            // 距離が離れている場合は間を埋める
            if (distance > this.eraserSize / 3) {
                const steps = Math.ceil(distance / (this.eraserSize / 4));
                for (let i = 1; i < steps; i++) {
                    const ratio = i / steps;
                    const interpX = prevPoint.x + (x - prevPoint.x) * ratio;
                    const interpY = prevPoint.y + (y - prevPoint.y) * ratio;
                    
                    this.drawEraseCircle(interpX, interpY);
                }
            }
        }
    }
    
    /**
     * 消去終了（座標修正版）
     */
    onPointerUp(x, y, event) {
        if (!this.isErasing || !this.currentErasePath) return;
        
        // 最終点追加
        this.points.push({x, y});
        
        // 最終点に消去円追加
        this.drawEraseCircle(x, y);
        
        // 消去完了処理
        this.isErasing = false;
        const pathLength = this.points.length;
        const activeLayerId = this.canvasManager.getActiveLayerId();
        
        console.log(`✅ 消去完了: layer=${activeLayerId}, pathPoints=${pathLength}, size=${this.eraserSize}`);
        
        // リセット
        this.currentErasePath = null;
        this.points = [];
    }
    
    /**
     * 🧹 消去円描画（座標精度修正）
     * 指定座標に正確な円形の消去エリアを描画
     */
    drawEraseCircle(x, y) {
        if (!this.currentErasePath) return;
        
        // 白色で円形描画（ERASEブレンドモードで消去に変換される）
        this.currentErasePath.beginFill(0xffffff, this.eraserOpacity);
        this.currentErasePath.drawCircle(x, y, this.eraserSize / 2);
        this.currentErasePath.endFill();
    }
    
    /**
     * 消しゴムサイズ設定
     */
    setEraserSize(size) {
        if (size > 0 && size <= 200) {
            this.eraserSize = size;
            console.log(`🧹 消しゴムサイズ変更: ${size}px`);
        } else {
            console.warn(`⚠️ 無効な消しゴムサイズ: ${size} (1-200の範囲で指定してください)`);
        }
    }
    
    /**
     * 消しゴム透明度（消去強度）設定
     */
    setEraserOpacity(opacity) {
        if (opacity >= 0 && opacity <= 1) {
            this.eraserOpacity = opacity;
            console.log(`🧹 消去強度変更: ${opacity}`);
        } else {
            console.warn(`⚠️ 無効な消去強度: ${opacity} (0.0-1.0の範囲で指定してください)`);
        }
    }
    
    /**
     * スムーズ消去設定
     */
    setSmoothErasing(enabled) {
        this.smoothErasing = enabled;
        console.log(`🧹 スムーズ消去: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            eraserSize: this.eraserSize,
            eraserOpacity: this.eraserOpacity,
            smoothErasing: this.smoothErasing
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            isErasing: this.isErasing,
            canvasManagerSet: !!this.canvasManager,
            hasCurrentPath: !!this.currentErasePath,
            pathLength: this.points.length,
            settings: this.getSettings()
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.EraserTool = EraserTool;

console.log('🧹 EraserTool 座標修正・真の消去機能版 Loaded');
console.log('🧹 eraser-tool.js loaded - 座標修正・消去機能完成');