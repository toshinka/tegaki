/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🎯 DEPENDENCIES: js/app-core.js, js/managers/*
 * 🎯 NODE_MODULES: pixi.js@^7.4.3（CDN経由）
 * 🎯 PIXI_EXTENSIONS: 基本機能のみ
 * 🎯 ISOLATION_TEST: ❌ 全体統括のため
 * 🎯 SPLIT_THRESHOLD: 150行（超過時分割検討）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init() 対応予定
 */

import { AppCore } from './app-core.js';
import { UIManager } from '../managers/ui-manager.js';
import { ToolManager } from '../managers/tool-manager.js';
import { CanvasManager } from '../managers/canvas-manager.js';
import PenTool from '../tools/pen-tool.js';
import EraserTool from '../tools/eraser-tool.js';

/**
 * メインアプリケーションクラス
 * 元HTMLのFutabaDrawingToolを分割構造で再実装
 * DRY原則: 共通初期化処理の統合
 * SOLID原則: 単一責任 - アプリケーション統括のみ
 */
class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        
        console.log(`🎨 ${this.version} 初期化開始...`);
    }
    
    /**
     * アプリケーション初期化
     * 元HTMLのinitメソッドを分割構造で再実装
     */
    async init() {
        try {
            console.log('🔧 Phase1.1 分割構造での初期化開始');
            
            // Step 1: AppCore初期化
            await this.initializeAppCore();
            
            // Step 2: キャンバス管理システム初期化  
            await this.initializeCanvasManager();
            
            // Step 3: ツール管理システム初期化
            await this.initializeToolManager();
            
            // Step 4: UI管理システム初期化
            await this.initializeUIManager();
            
            // Step 5: イベントハンドリング設定
            this.setupEventHandlers();
            
            // Step 6: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 7: 初期状態設定
            this.setupInitialState();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ Phase1.1 初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log('📊 分割構造対応状況:');
            console.log('  - CanvasManager: PixiJS描画エンジン統合');
            console.log('  - ToolManager: ペン・消しゴムツール分離');
            console.log('  - UIManager: インターフェース統括');
            console.log('  - v8移行準備: コメント埋め込み完了');
            
        } catch (error) {
            console.error('❌ 初期化失敗:', error);
            this.showErrorMessage(error);
            throw error;
        }
    }
    
    /**
     * AppCore初期化
     */
    async initializeAppCore() {
        this.appCore = new AppCore();
        await this.appCore.init();
        console.log('✅ AppCore初期化完了');
    }
    
    /**
     * キャンバス管理システム初期化
     */
    async initializeCanvasManager() {
        this.canvasManager = new CanvasManager();
        await this.canvasManager.init('drawing-canvas');
        console.log('✅ CanvasManager初期化完了');
    }
    
    /**
     * ツール管理システム初期化
     */
    async initializeToolManager() {
        this.toolManager = new ToolManager();
        this.toolManager.init(this.canvasManager);
        
        // 個別ツール登録
        const penTool = new PenTool(this.toolManager);
        const eraserTool = new EraserTool(this.toolManager);
        
        penTool.init();
        eraserTool.init();
        
        console.log('✅ ToolManager初期化完了');
    }
    
    /**
     * UI管理システム初期化
     */
    async initializeUIManager() {
        // UIManagerファイルから読み込み（既存のUI統合）
        const { UIController } = await import('../managers/ui-manager.js');
        this.uiManager = new UIController(this.toolManager);
        this.uiManager.init();
        
        console.log('✅ UIManager初期化完了');
    }
    
    /**
     * イベントハンドリング設定
     * 元HTMLのsetupCanvasEventsを統合
     */
    setupEventHandlers() {
        if (!this.canvasManager.app) {
            console.warn('⚠️ キャンバスアプリケーション未初期化');
            return;
        }
        
        // PointerDown: 描画開始
        this.canvasManager.app.stage.on('pointerdown', (event) => {
            if (this.uiManager.activePopup) return; // ポップアップ表示中は無視
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        // PointerMove: 描画継続・座標更新
        this.canvasManager.app.stage.on('pointermove', (event) => {
            const point = this.canvasManager.getLocalPointerPosition(event);
            
            // 座標表示更新（元HTML機能維持）
            this.updateCoordinateDisplay(point.x, point.y);
            
            // 筆圧モニター更新（簡易実装）
            if (this.toolManager.isDrawing) {
                this.updatePressureMonitor();
            }
            
            // 描画継続
            if (!this.uiManager.activePopup) {
                this.toolManager.continueDrawing(point.x, point.y);
            }
        });
        
        // PointerUp: 描画終了
        this.canvasManager.app.stage.on('pointerup', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // PointerUpOutside: キャンバス外での描画終了
        this.canvasManager.app.stage.on('pointerupoutside', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // リサイズイベント統合
        this.setupResizeHandlers();
        
        console.log('✅ イベントハンドリング設定完了');
    }
    
    /**
     * リサイズハンドラー設定（元HTML機能統合）
     */
    setupResizeHandlers() {
        document.getElementById('apply-resize')?.addEventListener('click', () => {
            this.applyCanvasResize(false);
        });
        
        document.getElementById('apply-resize-center')?.addEventListener('click', () => {
            this.applyCanvasResize(true);
        });
    }
    
    /**
     * キャンバスリサイズ適用（元HTML機能）
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    applyCanvasResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (width && height) {
            this.canvasManager.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.uiManager.closeAllPopups();
        }
    }
    
    /**
     * パフォーマンス監視開始（元HTML機能統合）
     */
    startPerformanceMonitoring() {
        // 元HTMLのPerformanceMonitorクラス機能を統合
        this.performanceMonitor = {
            frameCount: 0,
            lastTime: performance.now()
        };
        
        const updatePerformance = () => {
            this.performanceMonitor.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.performanceMonitor.lastTime >= 1000) {
                const fps = Math.round((this.performanceMonitor.frameCount * 1000) / 
                    (currentTime - this.performanceMonitor.lastTime));
                
                document.getElementById('fps').textContent = fps;
                
                this.performanceMonitor.frameCount = 0;
                this.performanceMonitor.lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        updatePerformance();
        console.log('✅ パフォーマンス監視開始');
    }
    
    /**
     * 初期状態設定（元HTML機能維持）
     */
    setupInitialState() {
        // 初期ツール設定
        this.toolManager.setTool('pen');
        
        // 初期キャンバス情報更新
        this.updateCanvasInfo();
        
        // 初期色設定表示
        document.getElementById('current-color').textContent = '#800000';
        document.getElementById('current-tool').textContent = 'ベクターペン';
    }
    
    /**
     * 座標表示更新（元HTML機能）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    updateCoordinateDisplay(x, y) {
        document.getElementById('coordinates').textContent = 
            `x: ${Math.round(x)}, y: ${Math.round(y)}`;
    }
    
    /**
     * 筆圧モニター更新（元HTML機能）
     */
    updatePressureMonitor() {
        const pressure = Math.min(100, 
            this.toolManager.globalSettings.pressure * 100 + Math.random() * 20);
        document.getElementById('pressure-monitor').textContent = 
            pressure.toFixed(1) + '%';
    }
    
    /**
     * 筆圧モニターリセット（元HTML機能）
     */
    resetPressureMonitor() {
        document.getElementById('pressure-monitor').textContent = '0.0%';
    }
    
    /**
     * キャンバス情報更新（元HTML機能）
     */
    updateCanvasInfo() {
        const state = this.canvasManager.getCanvasState();
        document.getElementById('canvas-info').textContent = 
            `${state.width}×${state.height}px`;
    }
    
    /**
     * エラーメッセージ表示
     * @param {Error} error - エラーオブジェクト
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        errorDiv.innerHTML = `
            <strong>エラーが発生しました:</strong><br>
            ${error.message || error}
            <br><br>
            <button onclick="this.parentNode.remove()" 
                    style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 5秒後自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    /**
     * アプリケーション状態取得（デバッグ用）
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            canvasState: this.canvasManager?.getCanvasState(),
            toolState: this.toolManager?.getDrawingState(),
            performanceInfo: this.canvasManager?.getPerformanceInfo()
        };
    }
}

/**
 * アプリケーション起動
 * 元HTMLのDOMContentLoadedイベント統合
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('📋 Phase1.1: 分割再構成版');
        console.log('🚀 起動開始...');
        
        // グローバル変数として保存（元HTML同様）
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // フォールバック表示（ふたば風デザイン維持）
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:2px solid #aa5a56;border-radius:16px;">
                    <h2>🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p>申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <p style="font-family:monospace;font-size:12px;color:#666;margin:16px 0;">${error.message}</p>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">
                        再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});