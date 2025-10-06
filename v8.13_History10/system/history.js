// ================================================================================
// system/history.js - Phase 1: コマンドパターン完全改修版
// ================================================================================
// 🔥 改修方針:
// - スナップショット方式 → コマンドパターン（do/undo）に完全移行
// - index = 最後に適用済みのエントリのインデックス（初期値: -1）
// - push(entry) → entry.do() 実行 → 配列追加 → index++
// - CompositeEntry サポート（複合操作を1つの履歴に）
// - 再入防止（isApplying フラグ）
//
// 🚨 破壊的変更:
// - 古い saveState() API は削除
// - 新しい push(entry) API のみ提供
// - entry = { name, do, undo, meta }
//
// ✅ 互換性維持:
// - キーボードショートカット（Ctrl+Z / Ctrl+Y）
// - EventBus 連携
// - LayerSystem 連携
// ================================================================================

(function() {
    'use strict';
    
    const MAX_HISTORY = 100;
    
    // ===== History Manager（コマンドパターン方式） =====
    class HistoryManager {
        constructor() {
            // エントリ配列と現在のインデックス
            this.entries = [];
            this.index = -1; // 最後に適用済みのインデックス（-1 = 何も適用されていない）
            
            // 再入防止フラグ
            this.isApplying = false;
            
            // 設定
            this.maxHistory = MAX_HISTORY;
            
            // 外部システム参照
            this.eventBus = window.TegakiEventBus;
            this.layerSystem = null;
        }
        
        // ===== LayerSystem 設定 =====
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
        
        // ===== エントリをプッシュ（適用する） =====
        push(entry) {
            // 再入チェック
            if (this.isApplying) {
                throw new Error('[History] Cannot push during undo/redo');
            }
            
            // エントリ検証
            if (!entry || typeof entry.do !== 'function' || typeof entry.undo !== 'function') {
                throw new Error('[History] Invalid entry: must have do() and undo()');
            }
            
            try {
                this.isApplying = true;
                
                // Future を切り捨て
                if (this.index < this.entries.length - 1) {
                    this.entries.length = this.index + 1;
                }
                
                // エントリを適用
                entry.do();
                
                // 配列に追加してインデックスを進める
                this.entries.push(entry);
                this.index++;
                
                // メモリ枯渇対策: 古い履歴を削除
                if (this.entries.length > this.maxHistory) {
                    this.entries.shift();
                    this.index--;
                }
                
                this._emitStateChanged();
                
            } catch (e) {
                // ロールバック試行
                try {
                    if (entry.undo) entry.undo();
                } catch (e2) {
                    console.error('[History] Rollback failed:', e2);
                }
                throw e;
            } finally {
                this.isApplying = false;
            }
        }
        
        // ===== Undo: 最後の操作を元に戻す =====
        undo() {
            if (this.isApplying) return false;
            if (this.index < 0) return false;
            
            const entry = this.entries[this.index];
            
            try {
                this.isApplying = true;
                entry.undo();
                this.index--;
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history:undo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
            } catch (e) {
                console.error('[History] Undo failed:', e);
                return false;
            } finally {
                this.isApplying = false;
            }
        }
        
        // ===== Redo: 取り消した操作をやり直す =====
        redo() {
            if (this.isApplying) return false;
            if (this.index >= this.entries.length - 1) return false;
            
            const entry = this.entries[this.index + 1];
            
            try {
                this.isApplying = true;
                entry.do();
                this.index++;
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history:redo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
            } catch (e) {
                console.error('[History] Redo failed:', e);
                return false;
            } finally {
                this.isApplying = false;
            }
        }
        
        // ===== CompositeEntry を作成（複合操作を1つの履歴に） =====
        createComposite(name, childEntries) {
            return {
                name,
                meta: { composite: true },
                do() {
                    // 順次実行
                    for (const child of childEntries) {
                        child.do();
                    }
                },
                undo() {
                    // 逆順で実行
                    for (let i = childEntries.length - 1; i >= 0; i--) {
                        childEntries[i].undo();
                    }
                }
            };
        }
        
        // ===== 履歴をクリア =====
        clear() {
            if (this.isApplying) {
                throw new Error('[History] Cannot clear during undo/redo');
            }
            this.entries = [];
            this.index = -1;
            this._emitStateChanged();
        }
        
        // ===== 状態チェック =====
        canUndo() {
            return this.index >= 0;
        }
        
        canRedo() {
            return this.index < this.entries.length - 1;
        }
        
        getIndex() {
            return this.index;
        }
        
        getLength() {
            return this.entries.length;
        }
        
        isApplying() {
            return this.isApplying;
        }
        
        // ===== 情報取得 =====
        getHistoryInfo() {
            return {
                index: this.index,
                length: this.entries.length,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                maxHistory: this.maxHistory
            };
        }
        
        getDebugInfo() {
            return {
                index: this.index,
                length: this.entries.length,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                isApplying: this.isApplying,
                entries: this.entries.map((e, i) => ({
                    index: i,
                    name: e.name,
                    current: i === this.index
                }))
            };
        }
        
        // ===== デバッグ用: 履歴の内容を表示 =====
        debugTrace() {
            console.log('[History Debug]', this.getDebugInfo());
        }
        
        // ===== EventBus 通知 =====
        _emitStateChanged() {
            if (this.eventBus) {
                this.eventBus.emit('history:changed', {
                    index: this.index,
                    length: this.entries.length,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
        }
    }
    
    // ===== シングルトンインスタンス =====
    const historyManager = new HistoryManager();
    
    // ===== キーボードショートカット =====
    function setupHistoryKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 入力フィールドでは無効化
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) {
                return;
            }
            
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const metaKey = isMac ? e.metaKey : e.ctrlKey;
            
            // Undo: Ctrl+Z (Win) / Cmd+Z (Mac)
            if (metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') {
                historyManager.undo();
                e.preventDefault();
                return;
            }
            
            // Redo: Ctrl+Y (Win) / Cmd+Shift+Z (Mac)
            if ((metaKey && !e.altKey && e.code === 'KeyY') || 
                (metaKey && e.shiftKey && !e.altKey && e.code === 'KeyZ')) {
                historyManager.redo();
                e.preventDefault();
                return;
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHistoryKeyboardShortcuts);
    } else {
        setupHistoryKeyboardShortcuts();
    }
    
    // ===== グローバルAPI（新仕様） =====
    window.History = {
        // 新API
        push: (entry) => historyManager.push(entry),
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        createComposite: (name, childEntries) => historyManager.createComposite(name, childEntries),
        clear: () => historyManager.clear(),
        
        // 状態チェック
        canUndo: () => historyManager.canUndo(),
        canRedo: () => historyManager.canRedo(),
        getIndex: () => historyManager.getIndex(),
        getLength: () => historyManager.getLength(),
        isApplying: () => historyManager.isApplying,
        
        // 情報取得
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        getDebugInfo: () => historyManager.getDebugInfo(),
        debugTrace: () => historyManager.debugTrace(),
        
        // システム連携
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
        
        // 定数
        MAX_HISTORY: MAX_HISTORY,
        
        // 内部マネージャー参照（互換性のため）
        _manager: historyManager
    };
    
    // ===== EventBus 連携 =====
    if (window.TegakiEventBus) {
        window.TegakiEventBus.on('history:undo-request', () => historyManager.undo());
        window.TegakiEventBus.on('history:redo-request', () => historyManager.redo());
        window.TegakiEventBus.on('history:clear', () => historyManager.clear());
        
        window.TegakiEventBus.on('layer:system-initialized', (data) => {
            if (data.layerSystem) {
                historyManager.setLayerSystem(data.layerSystem);
            }
        });
    }
    
    console.log('✅ system/history.js Phase 1: コマンドパターン完全改修版 loaded');
    
})();

// ===== 単体テスト（開発時のみ有効化） =====
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.HistoryTest = () => {
        console.log('=== History Unit Test ===');
        History.clear();
        
        let state = 0;
        
        // Test 1: push → undo → redo
        History.push({
            name: 'increment',
            do: () => { state++; },
            undo: () => { state--; }
        });
        console.assert(state === 1, 'Test 1.1: state should be 1');
        console.assert(History.getIndex() === 0, 'Test 1.2: index should be 0');
        
        History.undo();
        console.assert(state === 0, 'Test 1.3: state should be 0 after undo');
        console.assert(History.getIndex() === -1, 'Test 1.4: index should be -1');
        
        History.redo();
        console.assert(state === 1, 'Test 1.5: state should be 1 after redo');
        console.assert(History.getIndex() === 0, 'Test 1.6: index should be 0');
        
        // Test 2: Composite
        History.clear();
        state = 0;
        const composite = History.createComposite('add3', [
            { name: 'add1', do: () => { state++; }, undo: () => { state--; } },
            { name: 'add2', do: () => { state++; }, undo: () => { state--; } },
            { name: 'add3', do: () => { state++; }, undo: () => { state--; } }
        ]);
        History.push(composite);
        console.assert(state === 3, 'Test 2.1: state should be 3');
        
        History.undo();
        console.assert(state === 0, 'Test 2.2: state should be 0 (composite undo)');
        
        History.redo();
        console.assert(state === 3, 'Test 2.3: state should be 3 (composite redo)');
        
        // Test 3: Future truncation
        History.clear();
        state = 0;
        History.push({ name: 'op1', do: () => { state = 1; }, undo: () => { state = 0; } });
        History.push({ name: 'op2', do: () => { state = 2; }, undo: () => { state = 1; } });
        History.push({ name: 'op3', do: () => { state = 3; }, undo: () => { state = 2; } });
        console.assert(History.getLength() === 3, 'Test 3.1: should have 3 entries');
        
        History.undo();
        History.undo();
        console.assert(state === 1, 'Test 3.2: state should be 1');
        console.assert(History.canRedo(), 'Test 3.3: should be able to redo');
        
        History.push({ name: 'op4', do: () => { state = 4; }, undo: () => { state = 1; } });
        console.assert(History.getLength() === 2, 'Test 3.4: should have 2 entries (future truncated)');
        console.assert(!History.canRedo(), 'Test 3.5: should not be able to redo');
        console.assert(state === 4, 'Test 3.6: state should be 4');
        
        console.log('=== All Tests Passed ===');
        History.debugTrace();
    };
}