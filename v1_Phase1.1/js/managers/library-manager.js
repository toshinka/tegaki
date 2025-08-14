/**
 * 🔧 CDNライブラリマネージャー - 統一ライブラリ管理
 * 🎯 AI_WORK_SCOPE: CDNライブラリ検証・バージョン管理・互換性チェック
 * 🎯 DEPENDENCIES: main.js
 * 🎯 CDN_USAGE: 全CDNライブラリ管理対象
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 200行維持（機能集約のため）
 * 
 * 📋 PHASE_TARGET: Phase1-4全対応
 * 📋 V8_MIGRATION: PixiJS v8ライブラリ検出対応
 * 📋 PERFORMANCE_TARGET: 検証処理50ms以内
 * 
 * 📋 PLANNED_LIBRARIES: @pixi/layers（Phase2）, @pixi/gif（Phase3）
 */

export class LibraryManager {
    static instance = null;

    constructor() {
        if (LibraryManager.instance) {
            return LibraryManager.instance;
        }

        this.libraries = new Map();
        this.validationResults = new Map();
        this.startTime = performance.now();
        
        LibraryManager.instance = this;
        return this;
    }

    /**
     * ライブラリ定義（Phase対応版）
     */
    static get LIBRARY_DEFINITIONS() {
        return [
            // Phase1: 必須ライブラリ
            {
                name: 'PIXI',
                global: 'PIXI',
                version: () => window.PIXI?.VERSION,
                required: true,
                phase: 1,
                description: 'PixiJS本体',
                // 📋 V8_MIGRATION: バージョン8検出準備
                v8Ready: () => window.PIXI?.VERSION.startsWith('8')
            },
            {
                name: 'PIXI_UI',
                global: 'PIXI_UI',
                version: () => window.PIXI_UI?.version || 'unknown',
                required: true,
                phase: 1,
                description: '@pixi/ui UIコンポーネント'
            },

            // Phase1: 推奨ライブラリ
            {
                name: 'Viewport',
                global: 'Viewport',
                version: () => window.Viewport?.version || 'unknown',
                required: false,
                phase: 1,
                description: 'pixi-viewport キャンバス操作',
                fallback: '基本キャンバス操作のみ利用'
            },
            {
                name: 'PIXI.filters',
                global: 'PIXI',
                property: 'filters',
                version: () => window.PIXI?.filters ? 'available' : null,
                required: false,
                phase: 1,
                description: 'pixi-filters エフェクト',
                fallback: '高度エフェクトは無効'
            },
            {
                name: 'PIXI.svg',
                global: 'PIXI',
                property: 'svg',
                version: () => window.PIXI?.svg ? 'available' : null,
                required: false,
                phase: 1,
                description: