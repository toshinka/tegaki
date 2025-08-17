/**
 * 🎨 Phase1.2-STEP3: キャンバスリサイズ機能拡張
 * 🎯 既存canvas-manager.jsへの追加実装
 * 
 * 🎯 AI_WORK_SCOPE: リサイズ機能有効化・中央寄せ・履歴管理・UI統合
 * 🎯 DEPENDENCIES: managers/canvas-manager.js, managers/memory-manager.js
 * 🎯 NODE_MODULES: pixi.js（Application）, gsap（アニメーション）
 * 🎯 車輪の再発明回避: PIXI Application.resize()・GSAP・Memory Manager活用
 */

/**
 * Canvas Manager リサイズ機能拡張
 * 既存のcanvas-manager.jsに追加するメソッド群
 */

// Canvas Manager拡張クラス（修正版）
class CanvasManagerExtension {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.version = 'v1.2-STEP3-Fixed';
        
        // リサイズ履歴管理
        this.resizeHistory = {
            entries: [],
            maxEntries: 20,
            currentIndex: -1
        };
        
        // リサイズ設定
        this.resizeSettings = {
            enabled: true,
            preserveContent: true,
            centerContent: true,
            animationDuration: 0.3,
            constrainProportions: false,
            minSize: { width: 100, height: 100 },
            maxSize: { width: 4096, height: 4096 }
        };
        
        console.log('📏 CanvasManagerExtension 構築完了');
    }
    
    /**
     * リサイズ機能初期化（修正版）
     */
    initializeResizeSystem() {
        console.log('📏 リサイズシステム初期化開始...');
        
        try {
            // UI要素取得・有効化
            this.setupResizeUI();
            
            // リサイズイベントハンドラー設定
            this.setupResizeEventHandlers();
            
            console.log('✅ リサイズシステム初期化完了');
        } catch (error) {
            console.error('❌ リサイズシステム初期化エラー:', error);
        }
    }
    
    /**
     * リサイズUI要素セットアップ
     */
    setupResizeUI() {
        // リサイズツールボタン有効化
        const resizeTool = document.getElementById('resize-tool');
        if (resizeTool) {
            resizeTool.classList.remove('disabled');
            resizeTool.style.opacity = '1';
            resizeTool.style.cursor = 'pointer';
        }
        
        // リサイズパネル要素取得
        this.resizeUI = {
            panel: document.getElementById('resize-settings'),
            widthInput: document.getElementById('canvas-width'),
            heightInput: document.getElementById('canvas-height'),
            applyButton: document.getElementById('apply-resize'),
            applyCenterButton: document.getElementById('apply-resize-center'),
            presetButtons: document.querySelectorAll('.resize-button[data-size]'),
            statusDisplay: document.getElementById('canvas-info')
        };
        
        // 現在サイズを入力欄に反映
        this.updateResizeUI();
        
        console.log('🎛️ リサイズUI要素セットアップ完了');
    }
    
    /**
     * リサイズイベントハンドラー設定
     */
    setupResizeEventHandlers() {
        const ui = this.resizeUI;
        
        // 適用ボタン
        if (ui.applyButton) {
            ui.applyButton.addEventListener('click', () => {
                this.applyResize(false);
            });
        }
        
        // 中央寄せ適用ボタン
        if (ui.applyCenterButton) {
            ui.applyCenterButton.addEventListener('click', () => {
                this.applyResize(true);
            });
        }
        
        // プリセットボタン
        if (ui.presetButtons) {
            ui.presetButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                    const sizeData = event.target.dataset.size;
                    if (sizeData) {
                        const [width, height] = sizeData.split(',').map(Number);
                        this.setResizePreset(width, height);
                    }
                });
            });
        }
        
        // 入力欄の変更監視
        if (ui.widthInput) {
            ui.widthInput.addEventListener('input', () => {
                this.validateResizeInput();
            });
        }
        
        if (ui.heightInput) {
            ui.heightInput.addEventListener('input', () => {
                this.validateResizeInput();
            });
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            this.handleResizeKeyboard(event);
        });
        
        console.log('⌨