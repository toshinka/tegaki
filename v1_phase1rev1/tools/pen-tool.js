/**
 * 🖊️ PenTool Simple - 描画問題修正版
 * 📋 RESPONSIBILITY: 確実な線の描画のみ
 * 🚫 PROHIBITION: 複雑な筆圧処理・レイヤー操作・座標変換
 * ✅ PERMISSION: PIXI.Graphics作成・確実な線描画・CanvasManagerに渡す
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル・確実・描画専門
 * 🔄 INTEGRATION: 車輪の再発明回避・PixiJSの標準機能活用
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.PenTool) {
    /**
     * PenTool - 描画問題修正版
     * 確実な線描画の専任
     */
    class PenTool {
        constructor() {
            console.log('🖊️ PenTool 描画問題修正版作成');
            
            this.canvasManager = null;
            this.isDrawing = false;
            this.currentPath = null;
            this.points = [];
            
            // 描画設定
            this.color = 0x800000;  // ふたば風赤
            this.lineWidth = 4;
            this.opacity = 1.0;     // 完全不透明で確実に表示
        }
        
        /**
         * CanvasManager設定
         */
        setCanvasManager(canvasManager) {
            this.canvasManager = canvasManager;
            console.log('✅ PenTool - CanvasManager設定完了');
        }
        
        /**
         * 描画開始 - シンプル&確実
         */
        onPointerDown(x, y, event) {
            if (!this.canvasManager || !this.canvasManager.pixiApp) {
                console.warn('⚠️ PenTool - CanvasManager/PixiApp not available');
                return;
            }
            
            console.log(`🖊️ PenTool - 描画開始: (${x}, ${y})`);
            
            this.isDrawing = true;
            this.points = [{ x, y }];
            
            // 新しいGraphics作成 - シンプル設定
            this.currentPath = new PIXI.Graphics();
            
            // 線スタイル設定 - 確実に見える設定
            this.currentPath.lineStyle({
                width: this.lineWidth,
                color: this.color,
                alpha: this.opacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            // 開始点設定
            this.currentPath.moveTo(x, y);
            
            // 開始点に点を描画（確実に表示）
            this.currentPath.beginFill(this.color, this.opacity);
            this.currentPath.drawCircle(x, y, this.lineWidth / 2);
            this.currentPath.endFill();
            
            // すぐにステージに追加（確実な表示）
            this.canvasManager.pixiApp.stage.addChild(this.currentPath);
            
            console.log('✅ PenTool - 描画パス作成・ステージ追加完了');
        }
        
        /**
         * 描画継続 - 滑らかな線
         */
        onPointerMove(x, y, event) {
            if (!this.isDrawing || !this.currentPath) return;
            
            // 点を記録
            this.points.push({ x, y });
            
            // 直線描画
            this.currentPath.lineTo(x, y);
            
            // 線の接続点に小さな円を描画（滑らかさ向上）
            this.currentPath.beginFill(this.color, this.opacity);
            this.currentPath.drawCircle(x, y, Math.max(1, this.lineWidth / 4));
            this.currentPath.endFill();
            
            // デバッグログ（最初の数回のみ）
            if (this.points.length <= 3) {
                console.log(`🖊️ PenTool - 描画継続: (${x}, ${y}), 点数: ${this.points.length}`);
            }
        }
        
        /**
         * 描画終了
         */
        onPointerUp(x, y, event) {
            if (!this.isDrawing || !this.currentPath) return;
            
            console.log(`🖊️ PenTool - 描画終了: (${x}, ${y}), 総点数: ${this.points.length}`);
            
            // 最終点まで描画
            this.currentPath.lineTo(x, y);
            
            // 終了点に点を描画
            this.currentPath.beginFill(this.color, this.opacity);
            this.currentPath.drawCircle(x, y, this.lineWidth / 2);
            this.currentPath.endFill();
            
            // 描画完了
            this.isDrawing = false;
            this.currentPath = null;
            this.points = [];
            
            console.log('✅ PenTool - 描画完了');
        }
        
        /**
         * ペン設定変更
         */
        setPenColor(color) {
            if (typeof color === 'string') {
                this.color = parseInt(color.replace('#', '0x'), 16);
            } else {
                this.color = color;
            }
            console.log(`✅ PenTool - 色変更: 0x${this.color.toString(16).padStart(6, '0')}`);
        }
        
        setPenWidth(width) {
            this.lineWidth = Math.max(1, Math.min(50, width));
            console.log(`✅ PenTool - 線幅変更: ${this.lineWidth}px`);
        }
        
        setPenOpacity(opacity) {
            this.opacity = Math.max(0.1, Math.min(1.0, opacity));
            console.log(`✅ PenTool - 透明度変更: ${this.opacity}`);
        }
        
        /**
         * 現在の設定取得
         */
        getSettings() {
            return {
                color: `0x${this.color.toString(16).padStart(6, '0')}`,
                lineWidth: this.lineWidth,
                opacity: this.opacity,
                isDrawing: this.isDrawing,
                pointCount: this.points.length
            };
        }
        
        /**
         * デバッグ情報
         */
        getDebugInfo() {
            return {
                ...this.getSettings(),
                hasCanvasManager: !!this.canvasManager,
                hasPixiApp: !!this.canvasManager?.pixiApp,
                currentPath: !!this.currentPath
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.PenTool = PenTool;
    
    console.log('🖊️ PenTool 描画問題修正版 Loaded - 確実な線描画');
} else {
    console.log('⚠️ PenTool already defined - skipping redefinition');
}

console.log('🎨 pen-tool.js loaded - 描画問題修正完了');