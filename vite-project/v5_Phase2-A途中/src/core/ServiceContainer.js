// src/core/ServiceContainer.js

export class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
    }

    // サービスを登録
    register(name, factory) {
        this.services.set(name, factory);
    }

    // サービスを解決（シングルトン）
    resolve(name) {
        // 既にインスタンスが作成されている場合はそれを返す
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        // ファクトリー関数を取得
        const factory = this.services.get(name);
        if (!factory) {
            throw new Error(`Service '${name}' not found`);
        }

        // インスタンスを作成
        const instance = factory(this);
        
        // シングルトンとして保存
        this.instances.set(name, instance);
        
        return instance;
    }

    // サービスが登録されているかチェック
    has(name) {
        return this.services.has(name);
    }

    // 全てのインスタンスをクリア
    clear() {
        this.instances.clear();
    }
}