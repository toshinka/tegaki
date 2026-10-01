/**
 * ============================================================================
 * ファイル名: core-initializer.js
 * 責務: アプリケーションの初期化シーケンスを制御する（エントリーポイント）
 * 依存: pixi.js, config.js, system/event-bus.js, coordinate-system.js, core-engine.js等
 * 被依存: index.html
 * 公開API: CoreInitializer
 * イベント発火: core:ready
 * イベント受信: なし
 * グローバル登録: window.CoreInitializer
 * 実装状態: ♻️移植
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
import 'pixi.js/advanced-blend-modes';
import { TEGAKI_CONFIG } from './config.js';
import { TegakiEventBus } from './system/event-bus.js';
import { coordinateSystem } from './coordinate-system.js';
import { DrawingEngine } from './system/drawing/drawing-engine.js';
import { CameraSystem } from './system/camera-system.js';
import { LayerSystem } from './system/layer-system.js';
import { HistoryManager } from './system/history.js';
import { CoreEngine } from './core-engine.js';
import { CoreRuntime } from './core-runtime.js';

/**
 * 画面rendererの解像度。displayDevicePixelRatioが有効なら端末DPR(上限付き)、無効なら従来の固定値。
 * Layer RenderTexture・History・保存・書き出しは個別に1xを指定しており、この値に依存しない。
 */
function getDisplayResolution() {
    const rendererConfig = TEGAKI_CONFIG.renderer || {};
    const fixed = Number(rendererConfig.resolution) || 1;
    if (rendererConfig.displayDevicePixelRatio !== true) return fixed;
    const dpr = Number(window.devicePixelRatio) || 1;
    const max = Number(rendererConfig.maxDisplayDevicePixelRatio) || 2;
    return Math.max(1, Math.min(max, dpr));
}

export const CoreInitializer = {
    async initialize() {
        console.log('🚀 Tegaki Initializing...');
        
        try {
            // 1. PixiJS Applicationの作成
            const app = new PIXI.Application();
            await app.init({
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: TEGAKI_CONFIG.renderer.backgroundColor,
                backgroundAlpha: TEGAKI_CONFIG.renderer.backgroundAlpha,
                antialias: TEGAKI_CONFIG.renderer.antialias,
                resolution: getDisplayResolution(),
                autoDensity: true,
                resizeTo: window
            });
            
            document.body.appendChild(app.canvas);
            
            // 2. CoreEngineの初期化
            const coreEngine = new CoreEngine(app, {
                isBookmarkletMode: false
            });
            
            window.coreEngine = coreEngine;
            
            // 3. システムの接続と初期化
            await coreEngine.initialize();
            
            console.log('✅ Tegaki Initialized Successfully');
            
            if (TegakiEventBus) {
                TegakiEventBus.emit('core:ready', {
                    version: `v${PIXI.VERSION}-esm`,
                    timestamp: Date.now()
                });
            }
            
            return coreEngine;
            
        } catch (error) {
            console.error('❌ Tegaki Initialization Failed:', error);
            throw error;
        }
    }
};

// 下位互換性のためにグローバルに登録
window.CoreInitializer = CoreInitializer;

// 自動起動（Vite/ESM環境用）
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await CoreInitializer.initialize();
    } catch (e) {
        console.error('Startup failed:', e);
    }
});
