/**
 * Modern Drawing Tool - メインエントリーポイント
 * モダンブラウザ対応お絵かきツール
 */

import Stats from 'stats.js';

// 開発用：フレームレート監視
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.getElementById('stats').appendChild(stats.dom);

// アプリケーション初期化
class ModernDrawingTool {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.isWebGPUSupported = false;
        this.isWebGL2Supported = false;
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Modern Drawing Tool initializing...');
            
            // GPU対応チェック
            this.checkGPUSupport();
            
            // Canvas初期化
            this.initCanvas();
            
            // ローディング完了
            this.hideLoading();
            
            // 描画ループ開始
            this.startRenderLoop();
            
            console.log('✅ Modern Drawing Tool initialized successfully');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showError('初期化に失敗しました: ' + error.message);
        }
    }
    
    checkGPUSupport() {
        // WebGPU対応チェック
        this.isWebGPUSupported = !!navigator.gpu;
        console.log('🎮 WebGPU support:', this.isWebGPUSupported);
        
        // WebGL2対応チェック
        const testCanvas = document.createElement('canvas');
        const testGL = testCanvas.getContext('webgl2');
        this.isWebGL2Supported = !!testGL;
        console.log('🎯 WebGL2 support:', this.isWebGL2Supported);
        
        if (!this.isWebGL2Supported) {
            throw new Error('WebGL2 is required but not supported');
        }
    }
    
    initCanvas() {
        this.canvas = document.getElementById('main-canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        // WebGL2コンテキスト取得
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            alpha: true,
            premultipliedAlpha: false
        });
        
        if (!this.gl) {
            throw new Error('Failed to get WebGL2 context');
        }
        
        // Canvas サイズ設定
        this.resizeCanvas();
        
        // リサイズイベント
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 基本的な描画設定
        this.setupBasicRendering();
        
        console.log('🎨 Canvas initialized');
    }
    
    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        
        // Canvas実サイズ設定
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        
        // CSS表示サイズ設定
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // WebGLビューポート設定
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    setupBasicRendering() {
        const gl = this.gl;
        
        // 基本的なWebGL設定
        gl.clearColor(0.1, 0.1, 0.1, 1.0); // ダークグレー背景
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // 深度テスト無効化（2D描画のため）
        gl.disable(gl.DEPTH_TEST);
    }
    
    startRenderLoop() {
        const render = () => {
            stats.begin();
            
            // 描画処理
            this.render();
            
            stats.end();
            requestAnimationFrame(render);
        };
        
        requestAnimationFrame(render);
    }
    
    render() {
        const gl = this.gl;
        
        // 画面クリア
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // TODO: 実際の描画処理を実装
        // 現在はテスト用のクリア処理のみ
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        const mainContent = document.getElementById('main-content');
        
        loading.style.display = 'none';
        mainContent.style.display = 'flex';
    }
    
    showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `<div class="error">${message}</div>`;
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    new ModernDrawingTool();
});

// 開発用：グローバルに公開
window.ModernDrawingTool = ModernDrawingTool;