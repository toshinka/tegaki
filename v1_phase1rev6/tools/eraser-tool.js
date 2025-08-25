/**
 * 🧹 EraserTool - 真の消去機能版（修正版）
 * 📋 RESPONSIBILITY: 描画レイヤーから真に消去する処理のみ
 * 🚫 PROHIBITION: 背景レイヤー操作・複雑な範囲計算・レイヤー跨ぎ操作
 * ✅ PERMISSION: PIXI.BLEND_MODES.ERASE使用・アクティブレイヤーのみ消去
 * 
 * 📏 DESIGN_PRINCIPLE: PixiJSのERASEブレンドモード活用・真の消去実現
 * 🔄 INTEGRATION: CanvasManagerのaddGraphicsToLayer使用・背景保護
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.EraserTool) {
    /**
     * EraserTool - 真の消去機能版
     * PixiJS ERASEブレンドモードによる真の消去処理
     */
    class EraserTool {
        constructor() {
            console.log('🧹 EraserTool 真の消去機能版 作成');
            
            this.canvasManager = null;
            this.isErasing = false;
            this.currentGraphics = null;
            this.eraserPath = [];
            
            // 消しゴム設定
            this.eraserSize = 20;
            this.eraserOpacity = 1.0;
        }
        
        /**
         * CanvasManager設定
         */
        setCanvasManager(canvasManager) {
            this.canvasManager = canvasManager;
            console.log('🧹 EraserTool - CanvasManager設定完了');
        }
        
        /**
         * 消去開始 - 真の消去モード
         */
        onPointerDown(x, y, event) {
            if (!this.canvasManager) {
                console.warn('⚠️ CanvasManager not set');
                return;
            }
            
            // アクティブレイヤー確認（背景レイヤー保護）
            const activeLayerId = this.canvasManager.getActiveLayerId();
            if (activeLayerId === 'layer0') {
                console.warn('⚠️ 背景レイヤーの消去は禁止されています');
                return;
            }
            
            this.isErasing = true;
            this.eraserPath = [{x, y}];
            
            // 消去用Graphics作成（ERASEブレンドモード使用）
            this.currentGraphics = new PIXI.Graphics();
            this.currentGraphics.blendMode = PIXI.BLEND_MODES.ERASE; // 真の消去モード
            
            // 消去線のスタイル設定
            this.currentGraphics.lineStyle({
                width: this.eraserSize,
                color: 0x000000, // 色は関係ない（ERASEモードなので）
                alpha: this.eraserOpacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            // 消去開始点設定
            this.currentGraphics.moveTo(x, y);
            
            // 消去開始点に円描画（点消去対応）
            this.currentGraphics.beginFill(0x000000, this.eraserOpacity);
            this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
            this.currentGraphics.endFill();
            
            // アクティブレイヤーに追加（消去処理）
            this.canvasManager.addGraphicsToLayer(this.currentGraphics);
            
            console.log(`🧹 消去開始: layer=${activeLayerId}, pos=(${x}, ${y}), size=${this.eraserSize}`);
        }
        
        /**
         * 消去継続
         */
        onPointerMove(x, y, event) {
            if (!this.isErasing || !this.currentGraphics) return;
            
            // パス記録
            this.eraserPath.push({x, y});
            
            // 消去線を描画
            this.currentGraphics.lineTo(x, y);
            
            // 消去円を描画（線の隙間を埋める）
            this.currentGraphics.beginFill(0x000000, this.eraserOpacity);
            this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
            this.currentGraphics.endFill();
            
            // 連続する点同士も線で結ぶ（滑らかな消去）
            if (this.eraserPath.length > 1) {
                const prevPoint = this.eraserPath[this.eraserPath.length - 2];
                this.currentGraphics.moveTo(prevPoint.x, prevPoint.y);
                this.currentGraphics.lineTo(x, y);
            }
        }
        
        /**
         * 消去終了
         */
        onPointerUp(x, y, event) {
            if (!this.isErasing || !this.currentGraphics) return;
            
            // 最終消去点
            this.eraserPath.push({x, y});
            this.currentGraphics.lineTo(x, y);
            
            // 最終点に円描画
            this.currentGraphics.beginFill(0x000000, this.eraserOpacity);
            this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
            this.currentGraphics.endFill();
            
            // 消去処理完了
            this.isErasing = false;
            const pathLength = this.eraserPath.length;
            const activeLayerId = this.canvasManager.getActiveLayerId();
            
            console.log(`✅ 消去完了: layer=${activeLayerId}, pathPoints=${pathLength}, size=${this.eraserSize}`);
            
            // リセット
            this.currentGraphics = null;
            this.eraserPath = [];
        }
        
        /**
         * 消しゴムサイズ設定
         */
        setEraserSize(size) {
            if (size > 0 && size <= 100) {
                this.eraserSize = size;
                console.log(`🧹 消しゴムサイズ変更: ${size}px`);
            } else {
                console.warn(`⚠️ 無効な消しゴムサイズ: ${size} (1-100の範囲で指定してください)`);
            }
        }
        
        /**
         * 消しゴム透明度設定
         */
        setEraserOpacity(opacity) {
            if (opacity >= 0 && opacity <= 1) {
                this.eraserOpacity = opacity;
                console.log(`🧹 消しゴム透明度変更: ${opacity}`);
            } else {
                console.warn(`⚠️ 無効な透明度: ${opacity} (0.0-1.0の範囲で指定してください)`);
            }
        }
        
        /**
         * 設定取得
         */
        getSettings() {
            return {
                eraserSize: this.eraserSize,
                eraserOpacity: this.eraserOpacity
            };
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                isErasing: this.isErasing,
                canvasManagerSet: !!this.canvasManager,
                hasCurrentGraphics: !!this.currentGraphics,
                pathLength: this.eraserPath.length,
                settings: this.getSettings()
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.EraserTool = EraserTool;
    
    console.log('🧹 EraserTool 真の消去機能版 Loaded');
} else {
    console.log('⚠️ EraserTool already defined - skipping redefinition');
}

console.log('🧹 eraser-tool.js loaded - 真の消去機能完成');