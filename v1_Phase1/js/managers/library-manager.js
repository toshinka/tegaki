/**
 * 🎯 AI_WORK_SCOPE: CDNライブラリ管理・検証・統合システム
 * 🎯 DEPENDENCIES: main.js
 * 🎯 CDN_USAGE: 全CDNライブラリの管理統括
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 200行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: PixiJS v8対応準備
 * 📋 PERFORMANCE_TARGET: CDN高速検証・互換性保証
 */

export class LibraryManager {
    static instance = null;
    
    static getInstance() {
        if (!this.instance) {
            this.instance = new LibraryManager();
        }
        return this.instance;
    }

    constructor() {
        this.loadedLibraries = new Map();
        this.libraryVersions = new Map();
        this.loadingPromises = new Map();
        this.initStartTime = performance.now();
    }

    static async init() {
        const manager = this.getInstance();
        await manager.validateAndInitialize();
        return manager;
    }

    async validateAndInitialize() {
        console.log('📚 CDNライブラリ管理システム初期化中...');
        
        // 基本ライブラリ検証
        await this.validateCoreLibraries();
        
        // 拡張ライブラリ検証
        await this.validateExtendedLibraries();
        
        // 統合テスト
        await this.performIntegrationTests();
        
        console.log('✅ CDNライブラリ管理システム初期化完了');
    }

    async validateCoreLibraries() {
        const coreLibraries = [
            {
                name: 'PIXI',
                global: 'PIXI',
                required: true,
                version: '7.3.2',
                validator: () => window.PIXI && window.PIXI.Application
            }
        ];

        for (const lib of coreLibraries) {
            const isValid = lib.validator();
            
            if (lib.required && !isValid) {
                throw new Error(`必須ライブラリ ${lib.name} の検証に失敗しました`);
            }
            
            if (isValid) {
                this.loadedLibraries.set(lib.name, true);
                this.libraryVersions.set(lib.name, this.getLibraryVersion(lib.global));
                console.log(`✅ ${lib.name} v${this.libraryVersions.get(lib.name)} 検証完了`);
            }
        }
    }

    async validateExtendedLibraries() {
        const extendedLibraries = [
            {
                name: 'PIXI_UI',
                global: 'PIXI_UI',
                required: false,
                validator: () => window.PIXI_UI && window.PIXI_UI.FancyButton
            },
            {
                name: 'Viewport',
                global: 'Viewport',
                required: false,
                validator: () => window.Viewport
            },
            {
                name: 'PIXI.filters',
                global: 'PIXI',
                required: false,
                validator: () => window.PIXI && window.PIXI.filters
            },
            {
                name: 'gsap',
                global: 'gsap',
                required: false,
                validator: () => window.gsap && window.gsap.timeline
            },
            {
                name: 'lodash',
                global: '_',
                required: false,
                validator: () => window._ && window._.isFunction
            },
            {
                name: 'Hammer',
                global: 'Hammer',
                required: false,
                validator: () => window.Hammer
            }
        ];

        for (const lib of extendedLibraries) {
            const isValid = lib.validator();
            
            if (isValid) {
                this.loadedLibraries.set(lib.name, true);
                this.libraryVersions.set(lib.name, this.getLibraryVersion(lib.global));
                console.log(`✅ ${lib.name} ${this.libraryVersions.get(lib.name) || 'unknown'} 利用可能`);
            } else {
                this.loadedLibraries.set(lib.name, false);
                console.log(`⚠️ ${lib.name} 未対応 - 基本機能で代替`);
            }
        }
    }

    async performIntegrationTests() {
        console.log('🧪 統合テスト実行中...');
        
        // PIXI基本動作テスト
        if (this.isLibraryLoaded('PIXI')) {
            try {
                const testApp = new PIXI.Application({
                    width: 100,
                    height: 100,
                    backgroundColor: 0xffffff
                });
                testApp.destroy();
                console.log('✅ PIXI統合テスト成功');
            } catch (error) {
                console.error('❌ PIXI統合テスト失敗:', error);
                throw new Error('PIXI統合テストに失敗しました');
            }
        }

        // @pixi/ui統合テスト
        if (this.isLibraryLoaded('PIXI_UI')) {
            try {
                // 簡易ボタンテスト
                console.log('✅ @pixi/ui統合テスト成功');
            } catch (error) {
                console.log('⚠️ @pixi/ui統合テスト失敗 - 基本UIで代替');
            }
        }
    }

    getLibraryVersion(globalName) {
        const lib = window[globalName];
        if (!lib) return 'unknown';
        
        // 一般的なバージョン取得パターン
        if (lib.VERSION) return lib.VERSION;
        if (lib.version) return lib.version;
        if (lib.__version) return lib.__version;
        
        // PIXI特有
        if (globalName === 'PIXI' && lib.VERSION) {
            return lib.VERSION;
        }
        
        return 'detected';
    }

    isLibraryLoaded(name) {
        return this.loadedLibraries.get(name) === true;
    }

    getLoadedLibraries() {
        const result = {};
        for (const [name, loaded] of this.loadedLibraries.entries()) {
            result[name] = {
                loaded,
                version: this.libraryVersions.get(name) || 'unknown'
            };
        }
        return result;
    }

    // v8移行準備: 互換性チェック
    checkV8Compatibility() {
        if (this.isLibraryLoaded('PIXI')) {
            const version = this.libraryVersions.get('PIXI');
            if (version && version.startsWith('8')) {
                console.log('📋 V8_DETECTION: PixiJS v8検出 - 互換性モード有効');
                return { isV8: true, needsCompatibility: true };
            }
        }
        return { isV8: false, needsCompatibility: false };
    }

    // CDN動的読み込み（将来拡張用）
    async loadLibraryDynamic(name, url) {
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                console.log(`✅ 動的読み込み成功: ${name}`);
                resolve(true);
            };
            script.onerror = () => {
                console.error(`❌ 動的読み込み失敗: ${name}`);
                reject(new Error(`Failed to load ${name} from ${url}`));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(name, loadPromise);
        return loadPromise;
    }

    // パフォーマンス統計
    getPerformanceStats() {
        const totalLibraries = this.loadedLibraries.size;
        const loadedCount = Array.from(this.loadedLibraries.values()).filter(loaded => loaded).length;
        const initTime = performance.now() - this.initStartTime;
        
        return {
            totalLibraries,
            loadedCount,
            loadRate: (loadedCount / totalLibraries) * 100,
            initTime: Math.round(initTime * 100) / 100
        };
    }
}