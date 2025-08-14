/**
 * 🧽 消しゴムツール - ベクター消去実装
 * 🎯 AI_WORK_SCOPE: 消しゴム専用・ベクター消去・マスク処理
 * 🎯 DEPENDENCIES: main.js, app-core.js, managers/tool-manager.js
 * 🎯 CDN_USAGE: PIXI（Graphics・Mask）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 250行維持（消しゴム専用機能）
 * 
 * 📋 PHASE_TARGET: Phase1基本・Phase2高度化
 * 📋 V8_MIGRATION: PIXI.Graphics Mask API対応予定
 * 📋 PERFORMANCE_TARGET: 消去処理60FPS維持
 */

export class EraserTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.appCore = toolManager.appCore;
        this.app = toolManager.app;
        
        // 消去状態
        this.currentErasePath = null;
        this.erasePoints = [];
        this.isErasing = false;
        
        // 設定
        this.settings = {
            size: 20.0,
            opacity: 1.0,
            mode: 'vector' // vector, pixel (Phase2)
        };
        
        console.log('🧽 消しゴムツール初期化完了');
    }

    /**
     * ツール有効化
     */
    onActivate() {
        console.log('🧽 消しゴムツール有効化');
        this.updateSettings(this.toolManager.getToolSettings('eraser'));
        
        // カーソル変更
        if (this.app.view) {
            this.app.view.style.cursor = 'crosshair';
        }
    }

    /**
     * ツール無効化
     */
    onDeactivate() {
        console.log('🧽 消しゴムツール無効化');
        if (this.isErasing) {
            this.stopErasing();
        }
        
        // カーソル復元
        if (this.app.view) {
            this.app.view.style.cursor = 'crosshair';
        }
    }

    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        console.log('🔧 消しゴム設定更新:', this.settings);
    }

    /**
     * 消去開始
     */
    startDrawing(x, y) {
        this.isErasing = true;
        this.erasePoints = [];
        
        // 消去パス作成
        this.currentErasePath = this.createErasePath();
        
        // 開始点記録
        const startPoint = { x, y };
        this.erasePoints.push(startPoint);
        
        // 初期消去（点）
        this.eraseAtPoint(x, y);
        
        console.log(`🧽 消去開始: (${x}, ${y})`);
        return this.currentErasePath;
    }

    /**
     * 消去継続
     */
    continueDrawing(x, y) {
        if (!this.isErasing || !this.currentErasePath) return;
        
        const currentPoint = { x, y };
        this.erasePoints.push(currentPoint);
        
        // 連続消去処理
        this.eraseLine(currentPoint);
        
        // 消去パス更新
        this.updateErasePath(currentPoint);
    }

    /**
     * 消去終了
     */
    stopDrawing() {
        if (!this.isErasing) return;
        
        // 最終消去処理
        this.finalizeErase();
        
        this.isErasing = false;
        this.currentErasePath = null;
        this.erasePoints = [];
        
        console.log('🧽 消去終了');
    }

    /**
     * 消去パス作成
     */
    createErasePath() {
        const erasePath = new PIXI.Graphics();
        
        // 消去領域表示用（デバッグ・プレビュー）
        erasePath.lineStyle({
            width: 2,
            color: 0xff0000,
            alpha: 0.3
        });
        
        // 一時的に画面に追加（プレビュー用）
        const target = this.appCore.drawingContainer || this.app.stage;
        target.addChild(erasePath);
        
        return erasePath;
    }

    /**
     * 点での消去処理
     */
    eraseAtPoint(x, y) {
        const eraseRadius = this.settings.size / 2;
        
        // 描画コンテナ内のオブジェクトをチェック
        const target = this.appCore.drawingContainer || this.app.stage;
        const objectsToErase = [];
        
        for (const child of target.children) {
            if (child === this.currentErasePath) continue; // 消去パス自体は除外
            
            if (this.isObjectInEraseArea(child, x, y, eraseRadius)) {
                objectsToErase.push(child);
            }
        }
        
        // 消去実行
        this.executeErase(objectsToErase, x, y, eraseRadius);
    }

    /**
     * 線での消去処理
     */
    eraseLine(currentPoint) {
        if (this.erasePoints.length < 2) return;
        
        const prevPoint = this.erasePoints[this.erasePoints.length - 2];
        const distance = this.calculateDistance(prevPoint, currentPoint);
        
        // 線に沿って消去点を配置
        const steps = Math.max(1, Math.floor(distance / (this.settings.size / 4)));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = prevPoint.x + (currentPoint.x - prevPoint.x) * t;
            const y = prevPoint.y + (currentPoint.y - prevPoint.y) * t;
            
            this.eraseAtPoint(x, y);
        }
    }

    /**
     * オブジェクトが消去エリア内かチェック
     */
    isObjectInEraseArea(obj, eraseX, eraseY, eraseRadius) {
        if (!obj.getBounds) return false;
        
        const bounds = obj.getBounds();
        
        // 簡易的な円形との当たり判定
        const objCenterX = bounds.x + bounds.width / 2;
        const objCenterY = bounds.y + bounds.height / 2;
        
        const distance = Math.sqrt(
            Math.pow(eraseX - objCenterX, 2) + Math.pow(eraseY - objCenterY, 2)
        );
        
        return distance < (eraseRadius + Math.max(bounds.width, bounds.height) / 2);
    }

    /**
     * 消去実行
     */
    executeErase(objectsToErase, eraseX, eraseY, eraseRadius) {
        for (const obj of objectsToErase) {
            if (this.settings.mode === 'vector') {
                this.vectorErase(obj, eraseX, eraseY, eraseRadius);
            } else {
                // 📋 Phase2: ピクセル消去モード実装予定
                this.pixelErase(obj, eraseX, eraseY, eraseRadius);
            }
        }
    }

    /**
     * ベクター消去（Phase1実装）
     */
    vectorErase(obj, eraseX, eraseY, eraseRadius) {
        if (!(obj instanceof PIXI.Graphics)) return;
        
        // 簡易実装: オブジェクト全体を半透明化
        obj.alpha *= 0.8;
        
        // 完全に透明になった場合は削除
        if (obj.alpha < 0.1) {
            obj.parent.removeChild(obj);
            obj.destroy();
        }
        
        // 📋 Phase2: より精密なベクター消去実装予定
        // - パス分割
        // - マスク適用
        // - 非破壊消去
    }

    /**
     * ピクセル消去（Phase2準備）
     */
    pixelErase(obj, eraseX, eraseY, eraseRadius) {
        // 📋 Phase2: ピクセルレベル消去実装予定
        console.log('📋 Phase2準備: ピクセル消去機能');
    }

    /**
     * 消去パス更新（プレビュー用）
     */
    updateErasePath(point) {
        if (!this.currentErasePath) return;
        
        // 消去パスを視覚化
        if (this.erasePoints.length === 1) {
            this.currentErasePath.moveTo(point.x, point.y);
            this.currentErasePath.drawCircle(point.x, point.y, this.settings.size / 2);
        } else {
            this.currentErasePath.lineTo(point.x, point.y);
            this.currentErasePath.drawCircle(point.x, point.y, this.settings.size / 2);
        }
    }

    /**
     * 消去最終処理
     */
    finalizeErase() {
        if (!this.currentErasePath) return;
        
        // 消去パス（プレビュー）を削除
        if (this.currentErasePath.parent) {
            this.currentErasePath.parent.removeChild(this.currentErasePath);
            this.currentErasePath.destroy();
        }
        
        console.log(`🧽 消去完了: ${this.erasePoints.length}ポイント`);
    }

    /**
     * 距離計算
     */
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
        );
    }

    /**
     * 消しゴムプレビュー作成
     */
    createEraserPreview() {
        const preview = new PIXI.Graphics();
        preview.lineStyle(2, 0xff0000, 0.5);
        preview.drawCircle(0, 0, this.settings.size / 2);
        
        return preview;
    }

    /**
     * Phase2準備: 高度消去機能
     */
    prepareAdvancedErase() {
        // 📋 Phase2: マスクベース消去
        // 📋 Phase2: レイヤー対応消去
        // 📋 Phase2: アンドゥ対応消去
        console.log('📋 Phase2準備: 高度消去機能');
    }

    /**
     * 全消去（ショートカット用）
     */
    clearAll() {
        const target = this.appCore.drawingContainer || this.app.stage;
        
        // 全描画オブジェクトを削除
        const children = [...target.children];
        children.forEach(child => {
            if (child instanceof PIXI.Graphics) {
                target.removeChild(child);
                child.destroy();
            }
        });
        
        console.log('🧽 全消去実行');
    }

    /**
     * リソース解放
     */
    destroy() {
        if (this.isErasing) {
            this.stopDrawing();
        }
        
        this.currentErasePath = null;
        this.erasePoints = [];
        
        console.log('🗑️ 消しゴムツール リソース解放完了');
    }
}