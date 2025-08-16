/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * メインアプリケーション初期化 - エラー修繕版
 * 
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・拡張ライブラリ統合・エラーハンドリング
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/app-core.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, 全拡張ライブラリ
 * 🎯 PIXI_EXTENSIONS: 統合機能活用
 * 🎯 ISOLATION_TEST: 可能（app-core.js依存）
 * 📋 PHASE_TARGET: Phase1 エラー修繕版
 * 📋 V8_MIGRATION: Application.init()対応予定
 */

console.log('🎨 ふたば☆ちゃんねる風お絵描きツール main.js 読み込み開始...');

/**
 * アプリケーション初期化管理クラス - エラー修繕版
 */
class AppInitializer {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.errors = [];
        console.log('🎨 AppInitializer 構築開始...');
    }
    
    /**
     * アプリケーション初期化
     */
    async init() {
        console.group('🎨 アプリケーション初期化開始 エラー修繕版');
        
        try {
            // Phase1: 拡張ライブラリ初期化（必須）
            await this.initializeExtensions();
            
            // Phase2: アプリケーション基盤初期化
            await this.initializeAppCore();
            
            // Phase3: UI初期化
            await this.initializeUI();
            
            // Phase4: ツール初期化
            await this.initializeTools();
            
            this.initialized = true;
            console.log('✅ アプリケーション初期化完了');
            
        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.errors.push(error.message);
            
            // エラー時のフォールバック初期化
            await this.initializeFallback();
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 拡張ライブラリ初期化
     */
    async initializeExtensions() {
        console.log('🔧 拡張ライブラリ初期化中...');
        
        // PixiExtensions の存在確認
        if (!window.PixiExtensions) {
            throw new Error('PixiExtensions が読み込まれていません');
        }
        
        // 拡張ライブラリ初期化実行
        await window.PixiExtensions.initialize();
        
        const stats = window.PixiExtensions.getStats();
        console.log(`✅ 拡張ライブラリ初期化完了: ${stats.coverage} (${stats.loaded}/${stats.total})`);
        
        if (stats.errors.length > 0) {
            console.warn('⚠️ 拡張ライブラリエラー:', stats.errors);
        }
    }
    
    /**
     * アプリケーション基盤初期化
     */
    async initializeAppCore() {
        console.log('🏗️ アプリケーション基盤初期化中...');
        
        // AppCore の存在確認
        if (typeof AppCore === 'undefined') {
            console.warn('⚠️ AppCore が未定義 - 基本初期化を実行');
            await this.initializeBasicApp();
            return;
        }
        
        // AppCore初期化
        this.appCore = new AppCore();
        await this.appCore.init();
        
        console.log('✅ アプリケーション基盤初期化完了');
    }
    
    /**
     * 基本アプリケーション初期化（AppCore未定義時）
     */
    async initializeBasicApp() {
        console.log('🆘 基本アプリケーション初期化中...');
        
        try {
            // 基本的なPixiJSアプリケーション作成
            const app = new PIXI.Application({
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6,
                antialias: true
            });
            
            // キャンバス要素に追加
            const canvasContainer = document.getElementById('drawing-canvas');
            if (canvasContainer) {
                canvasContainer.appendChild(app.view);
            }
            
            // グローバルに公開
            window.app = app;
            
            console.log('✅ 基本アプリケーション初期化完了');
            
        } catch (error) {
            console.error('❌ 基本アプリケーション初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * UI初期化
     */
    async initializeUI() {
        console.log('🎨 UI初期化中...');
        
        try {
            // ツールボタンイベント設定
            this.setupToolButtons();
            
            // ポップアップ設定
            this.setupPopups();
            
            // スライダー設定
            this.setupSliders();
            
            console.log('✅ UI初期化完了');
            
        } catch (error) {
            console.error('❌ UI初期化エラー:', error);
            // UIエラーは致命的ではないため継続
        }
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        // ペンツールボタン
        const penTool = document.getElementById('pen-tool');
        if (penTool) {
            penTool.addEventListener('click', () => {
                this.setActiveTool('pen');
            });
        }
        
        // 消しゴムツールボタン
        const eraserTool = document.getElementById('eraser-tool');
        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                this.setActiveTool('eraser');
            });
        }
        
        // リサイズツールボタン
        const resizeTool = document.getElementById('resize-tool');
        if (resizeTool) {
            resizeTool.addEventListener('click', () => {
                this.togglePopup('resize-settings');
            });
        }
        
        console.log('✅ ツールボタン設定完了');
    }
    
    /**
     * アクティブツール設定
     */
    setActiveTool(toolName) {
        try {
            // 全てのツールボタンからactiveクラス除去
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 指定ツールボタンにactiveクラス追加
            const toolButton = document.getElementById(`${toolName}-tool`);
            if (toolButton) {
                toolButton.classList.add('active');
            }
            
            // ステータス更新
            this.updateToolStatus(toolName);
            
            console.log(`✅ アクティブツール変更: ${toolName}`);
            
        } catch (error) {
            console.error('❌ アクティブツール設定エラー:', error);
        }
    }
    
    /**
     * ツールステータス更新
     */
    updateToolStatus(toolName) {
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '範囲選択'
        };
        
        const statusElement = document.getElementById('current-tool');
        if (statusElement) {
            statusElement.textContent = toolNames[toolName] || toolName;
        }
    }
    
    /**
     * ポップアップ設定
     */
    setupPopups() {
        // ペンツール設定ポップアップ
        const penSettings = document.getElementById('pen-settings');
        if (penSettings) {
            this.setupDraggablePopup(penSettings);
        }
        
        // リサイズ設定ポップアップ
        const resizeSettings = document.getElementById('resize-settings');
        if (resizeSettings) {
            this.setupDraggablePopup(resizeSettings);
            this.setupResizeControls();
        }
        
        console.log('✅ ポップアップ設定完了');
    }
    
    /**
     * ドラッグ可能ポップアップ設定
     */
    setupDraggablePopup(popupElement) {
        if (!popupElement) return;
        
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        const title = popupElement.querySelector('.popup-title');
        if (!title) return;
        
        title.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(popupElement.style.left) || 0;
            initialY = parseInt(popupElement.style.top) || 0;
            
            title.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            popupElement.style.left = (initialX + deltaX) + 'px';
            popupElement.style.top = (initialY + deltaY) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                title.style.cursor = 'grab';
            }
        });
    }
    
    /**
     * リサイズコントロール設定
     */
    setupResizeControls() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                const size = button.dataset.size.split(',');
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput) widthInput.value = size[0];
                if (heightInput) heightInput.value = size[1];
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.applyCanvasResize();
            });
        }
        
        const applyCenterButton = document.getElementById('apply-resize-center');
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => {
                this.applyCanvasResize(true);
            });
        }
    }
    
    /**
     * キャンバスリサイズ適用
     */
    applyCanvasResize(center = false) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) return;
            
            const width = parseInt(widthInput.value) || 400;
            const height = parseInt(heightInput.value) || 400;
            
            // アプリケーション存在確認
            if (window.app && window.app.renderer) {
                window.app.renderer.resize(width, height);
            } else if (this.appCore && this.appCore.resizeCanvas) {
                this.appCore.resizeCanvas(width, height, center);
            }
            
            // ステータス更新
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo) {
                canvasInfo.textContent = `${width}×${height}px`;
            }
            
            console.log(`✅ キャンバスリサイズ適用: ${width}×${height} (center: ${center})`);
            
        } catch (error) {
            console.error('❌ キャンバスリサイズエラー:', error);
        }
    }
    
    /**
     * ポップアップ表示切り替え
     */
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        const isVisible = popup.style.display !== 'none';
        popup.style.display = isVisible ? 'none' : 'block';
        
        console.log(`ポップアップ ${popupId}: ${isVisible ? '非表示' : '表示'}`);
    }
    
    /**
     * スライダー設定
     */
    setupSliders() {
        // ペンサイズスライダー
        this.setupSlider('pen-size', 16, 1, 100, (value) => {
            document.getElementById('pen-size-value').textContent = value.toFixed(1) + 'px';
            this.updatePenSettings();
        });
        
        // ペン不透明度スライダー
        this.setupSlider('pen-opacity', 85, 0, 100, (value) => {
            document.getElementById('pen-opacity-value').textContent = value.toFixed(1) + '%';
            this.updatePenSettings();
        });
        
        // ペン筆圧スライダー
        this.setupSlider('pen-pressure', 50, 0, 100, (value) => {
            document.getElementById('pen-pressure-value').textContent = value.toFixed(1) + '%';
            this.updatePenSettings();
        });
        
        // ペン線補正スライダー
        this.setupSlider('pen-smoothing', 30, 0, 100, (value) => {
            document.getElementById('pen-smoothing-value').textContent = value.toFixed(1) + '%';
            this.updatePenSettings();
        });
        
        console.log('✅ スライダー設定完了');
    }
    
    /**
     * スライダーセットアップ
     */
    setupSlider(id, defaultValue, min, max, callback) {
        const slider = document.getElementById(`${id}-slider`);
        const handle = document.getElementById(`${id}-handle`);
        const track = document.getElementById(`${id}-track`);
        
        if (!slider || !handle || !track) return;
        
        let isDragging = false;
        let currentValue = defaultValue;
        
        // 初期位置設定
        const updateSliderDisplay = (value) => {
            const percentage = ((value - min) / (max - min)) * 100;
            handle.style.left = percentage + '%';
            track.style.width = percentage + '%';
            if (callback) callback(value);
        };
        
        updateSliderDisplay(currentValue);
        
        // マウスイベント
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = slider.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const value = min + (percentage / 100) * (max - min);
            
            currentValue = value;
            updateSliderDisplay(value);
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        // クリックイベント
        slider.addEventListener('click', (e) => {
            if (e.target === handle) return;
            
            const rect = slider.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = (x / rect.width) * 100;
            const value = min + (percentage / 100) * (max - min);
            
            currentValue = value;
            updateSliderDisplay(value);
        });
        
        // 増減ボタン
        document.getElementById(`${id}-decrease-small`)?.addEventListener('click', () => {
            currentValue = Math.max(min, currentValue - 0.1);
            updateSliderDisplay(currentValue);
        });
        
        document.getElementById(`${id}-decrease`)?.addEventListener('click', () => {
            currentValue = Math.max(min, currentValue - 1);
            updateSliderDisplay(currentValue);
        });
        
        document.getElementById(`${id}-decrease-large`)?.addEventListener('click', () => {
            currentValue = Math.max(min, currentValue - 10);
            updateSliderDisplay(currentValue);
        });
        
        document.getElementById(`${id}-increase-small`)?.addEventListener('click', () => {
            currentValue = Math.min(max, currentValue + 0.1);
            updateSliderDisplay(currentValue);
        });
        
        document.getElementById(`${id}-increase`)?.addEventListener('click', () => {
            currentValue = Math.min(max, currentValue + 1);
            updateSliderDisplay(currentValue);
        });
        
        document.getElementById(`${id}-increase-large`)?.addEventListener('click', () => {
            currentValue = Math.min(max, currentValue + 10);
            updateSliderDisplay(currentValue);
        });
    }
    
    /**
     * ペン設定更新
     */
    updatePenSettings() {
        if (this.appCore && this.appCore.updatePenSettings) {
            const settings = {
                size: parseFloat(document.getElementById('pen-size-value').textContent),
                opacity: parseFloat(document.getElementById('pen-opacity-value').textContent) / 100,
                pressure: parseFloat(document.getElementById('pen-pressure-value').textContent) / 100,
                smoothing: parseFloat(document.getElementById('pen-smoothing-value').textContent) / 100
            };
            
            this.appCore.updatePenSettings(settings);
        }
    }
    
    /**
     * ツール初期化
     */
    async initializeTools() {
        console.log('🔧 ツール初期化中...');
        
        try {
            // デフォルトツール設定
            this.setActiveTool('pen');
            
            // ツールイベント設定
            if (this.appCore && this.appCore.setupTools) {
                this.appCore.setupTools();
            }
            
            console.log('✅ ツール初期化完了');
            
        } catch (error) {
            console.error('❌ ツール初期化エラー:', error);
        }
    }
    
    /**
     * フォールバック初期化
     */
    async initializeFallback() {
        console.warn('🆘 フォールバック初期化開始');
        
        try {
            // 最低限のアプリケーション初期化
            await this.initializeBasicApp();
            
            // 基本UI設定
            this.setupToolButtons();
            
            this.initialized = true;
            console.log('🆘 フォールバック初期化完了');
            
        } catch (error) {
            console.error('❌ フォールバック初期化エラー:', error);
        }
    }
    
    /**
     * 初期化状態確認
     */
    isInitialized() {
        return this.initialized;
    }
    
    /**
     * エラー情報取得
     */
    getErrors() {
        return this.errors;
    }
}

// ==== グローバル初期化実行 ====
console.log('🎨 AppInitializer グローバル初期化...');

// DOM読み込み完了後に実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeApp();
    });
} else {
    // 既にDOM読み込み完了している場合
    setTimeout(async () => {
        await initializeApp();
    }, 100);
}

/**
 * アプリケーション初期化関数
 */
async function initializeApp() {
    console.group('🎨 ふたば☆ちゃんねる風お絵描きツール 初期化開始');
    
    try {
        const appInitializer = new AppInitializer();
        await appInitializer.init();
        
        // グローバル公開
        window.appInitializer = appInitializer;
        
        console.log('🎉 アプリケーション初期化完了');
        
        // エラーがある場合は警告表示
        const errors = appInitializer.getErrors();
        if (errors.length > 0) {
            console.warn('⚠️ 初期化時のエラー:', errors);
        }
        
    } catch (error) {
        console.error('❌ アプリケーション初期化失敗:', error);
    } finally {
        console.groupEnd();
    }
}

console.log('✅ main.js 読み込み完了 エラー修繕版');