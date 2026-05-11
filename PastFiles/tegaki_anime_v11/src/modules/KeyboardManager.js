// ========================================
// KeyboardManager.js - キーボード入力管理
// ========================================

(function() {
    'use strict';
    
    class KeyboardManager {
        constructor() {
            this.handlers = new Map();
            this.enabled = true;
            this.boundHandler = this.handleKeyDown.bind(this);
        }
        
        /**
         * キーバインドを登録
         */
        register(key, modifier, handler, description) {
            const keyStr = this.normalizeKey(key, modifier);
            this.handlers.set(keyStr, { handler, description });
        }
        
        /**
         * キーバインドを解除
         */
        unregister(key, modifier) {
            const keyStr = this.normalizeKey(key, modifier);
            this.handlers.delete(keyStr);
        }
        
        /**
         * 全バインドを取得
         */
        getBindings() {
            return Array.from(this.handlers.entries()).map(([key, binding]) => ({
                key,
                description: binding.description
            }));
        }
        
        /**
         * キー文字列を正規化
         */
        normalizeKey(key, modifier = {}) {
            const parts = [];
            if (modifier.ctrl) parts.push('ctrl');
            if (modifier.shift) parts.push('shift');
            if (modifier.alt) parts.push('alt');
            parts.push(key.toLowerCase());
            return parts.join('+');
        }
        
        /**
         * キーイベントハンドラ
         */
        handleKeyDown(e) {
            if (!this.enabled) return;
            
            const keyStr = this.normalizeKey(e.key, {
                ctrl: e.ctrlKey || e.metaKey, // Macの⌘キー対応
                shift: e.shiftKey,
                alt: e.altKey
            });
            
            const binding = this.handlers.get(keyStr);
            if (binding) {
                e.preventDefault();
                binding.handler(e);
            }
        }
        
        /**
         * イベントリスナーを有効化
         */
        enable() {
            if (this.enabled) return;
            this.enabled = true;
            document.addEventListener('keydown', this.boundHandler);
        }
        
        /**
         * イベントリスナーを無効化
         */
        disable() {
            if (!this.enabled) return;
            this.enabled = false;
            document.removeEventListener('keydown', this.boundHandler);
        }
        
        /**
         * イベントリスナーをアタッチ
         */
        attach() {
            document.addEventListener('keydown', this.boundHandler);
        }
        
        /**
         * イベントリスナーをデタッチ
         */
        detach() {
            document.removeEventListener('keydown', this.boundHandler);
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.detach();
            this.handlers.clear();
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.KeyboardManager = KeyboardManager;
        console.log('✅ KeyboardManager loaded');
    }
})();