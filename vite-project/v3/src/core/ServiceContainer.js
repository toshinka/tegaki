/**
 * ServiceContainer.js - Phase2-A DIコンテナ基盤
 * 責務: 全サービス・エンジン・ストアの依存関係管理
 * Phase2-A最重要ファイル - 他の全てがこれに依存する
 */

export class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
        this.singletons = new Map();
    }

    /**
     * シングルトンインスタンス取得
     */
    static getInstance() {
        if (!ServiceContainer._instance) {
            ServiceContainer._instance = new ServiceContainer();
        }
        return ServiceContainer._instance;
    }

    /**
     * サービス登録（インスタンス直接登録）
     */
    register(name, instance) {
        if (this.services.has(name)) {
            console.warn(`🔄 ServiceContainer: "${name}" を上書き登録`);
        }
        this.services.set(name, instance);
        console.log(`✅ ServiceContainer: "${name}" サービス登録完了`);
        return this;
    }

    /**
     * ファクトリー関数登録（遅延生成）
     */
    registerFactory(name, factory, singleton = true) {
        this.factories.set(name, { factory, singleton });
        console.log(`✅ ServiceContainer: "${name}" ファクトリー登録完了 (singleton: ${singleton})`);
        return this;
    }

    /**
     * サービス解決・取得
     */
    resolve(name) {
        // 直接登録されたサービスを優先
        if (this.services.has(name)) {
            return this.services.get(name);
        }

        // ファクトリーによる生成
        if (this.factories.has(name)) {
            const { factory, singleton } = this.factories.get(name);
            
            if (singleton && this.singletons.has(name)) {
                return this.singletons.get(name);
            }

            const instance = factory(this);
            
            if (singleton) {
                this.singletons.set(name, instance);
            }
            
            return instance;
        }

        throw new Error(`❌ ServiceContainer: サービス "${name}" が見つかりません`);
    }

    /**
     * サービス存在確認
     */
    has(name) {
        return this.services.has(name) || this.factories.has(name);
    }

    /**
     * 登録されているサービス一覧取得
     */
    getRegisteredServices() {
        const direct = Array.from(this.services.keys());
        const factories = Array.from(this.factories.keys());
        return { direct, factories, all: [...direct, ...factories] };
    }

    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const info = this.getRegisteredServices();
        console.log('🔍 ServiceContainer Debug Info:');
        console.log('  直接登録:', info.direct);
        console.log('  ファクトリー:', info.factories);
        console.log('  シングルトン生成済み:', Array.from(this.singletons.keys()));
        return info;
    }

    /**
     * サービス登録解除
     */
    unregister(name) {
        const removed = this.services.delete(name) || this.factories.delete(name);
        this.singletons.delete(name);
        
        if (removed) {
            console.log(`🗑️ ServiceContainer: "${name}" サービス削除完了`);
        } else {
            console.warn(`⚠️ ServiceContainer: "${name}" は登録されていません`);
        }
        
        return removed;
    }

    /**
     * 全サービスクリア
     */
    clear() {
        const totalCount = this.services.size + this.factories.size;
        this.services.clear();
        this.factories.clear();
        this.singletons.clear();
        console.log(`🧹 ServiceContainer: ${totalCount}個のサービスをクリアしました`);
    }
}

// グローバル参照用（デバッグ用）
window._ServiceContainer = ServiceContainer;