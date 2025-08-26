/**
 * ⌨️ ShortcutManager - キーボードショートカットシステム（Phase1.5スタブ版）
 * 📋 RESPONSIBILITY: キーボードショートカット・入力処理・アクション管理
 * 🚫 PROHIBITION: 描画処理・UI操作・ツール管理・直接機能実行
 * ✅ PERMISSION: キーボードイベント・ショートカット登録・アクション委譲
 * 
 * 📏 DESIGN_PRINCIPLE: イベント委譲・コンテキスト管理・段階的機能追加
 * 🔄 INTEGRATION: 全Manager・ツール・UI連携・EventBus使用
 * 🎯 Phase1.5: 基本ショートカット（Ctrl+Z/Y, P, E）・コンテキスト管理基盤
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ShortcutManager - キーボードショートカットシステム（スタブ版）
 * Phase1.5で段階的に実装予定・現在は基本構造のみ
 */
class ShortcutManager {
    constructor() {
        console.log('⌨️ ShortcutManager Phase1.5 スタブ版 - 基本クラス定義のみ');
        
        // 基本状態
        this.isInitialized = false;
        this.eventBus = null;
        
        // ショートカット定義
        this.shortcuts = new Map();
        this.contextStack = ['default']; // コンテキストスタック
        this.currentPhase = '1.5';
        
        // キーボード状態
        this.pressedKeys = new Set();
        this.isListening = false;
        
        // アクション参照
        this.actionHandlers = new Map();
        
        console.log('⌨️ ShortcutManager スタブ作成完了 - Phase1.5で詳細実装予定');
    }
    
    /**
     * 初期化（EventBus連携）
     */
    initialize(eventBus) {
        if (!eventBus) {
            console.warn('⚠️ ShortcutManager: EventBus required');
            return false;
        }
        
        this.eventBus = eventBus;
        this.isInitialized = true;
        
        // 基本イベントリスナー設定
        this.setupEventListeners();
        
        // Phase1基本ショートカット設定
        this.setupPhase1Shortcuts();
        
        console.log('⌨️ ShortcutManager 初期化完了（EventBus連携）');
        return true;
    }
    
    /**
     * イベントリスナー設定（基本）
     */
    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleKeydown(event));
        document.addEventListener('keyup', (event) => this.handleKeyup(event));
        
        // フォーカス処理
        window.addEventListener('blur', () => this.clearPressedKeys());
        
        this.isListening = true;
        console.log('⌨️ キーボードイベントリスナー設定完了');
    }
    
    /**
     * Phase1基本ショートカット設定
     */
    setupPhase1Shortcuts() {
        // Phase1: 最小限の基本操作
        this.registerShortcut('Ctrl+Z', 'undo', 'default');
        this.registerShortcut('Ctrl+Y', 'redo', 'default');
        this.registerShortcut('KeyP', 'selectTool:pen', 'default');
        this.registerShortcut('KeyE', 'selectTool:eraser', 'default');
        
        console.log('⌨️ Phase1基本ショートカット設定完了');
    }
    
    /**
     * ショートカット登録（スタブ）
     */
    registerShortcut(keyCombo, action, context = 'default') {
        if (!keyCombo || !action) {
            console.warn('⚠️ Invalid shortcut parameters');
            return false;
        }
        
        const shortcutKey = `${context}:${keyCombo}`;
        const shortcut = {
            keyCombo: keyCombo,
            action: action,
            context: context,
            enabled: true,
            registered: Date.now()
        };
        
        this.shortcuts.set(shortcutKey, shortcut);
        
        console.log(`⌨️ ショートカット登録（スタブ）: ${keyCombo} → ${action} [${context}]`);
        return true;
    }
    
    /**
     * ショートカット削除
     */
    unregisterShortcut(keyCombo, context = 'default') {
        const shortcutKey = `${context}:${keyCombo}`;
        const removed = this.shortcuts.delete(shortcutKey);
        
        if (removed) {
            console.log(`⌨️ ショートカット削除: ${keyCombo} [${context}]`);
        }
        
        return removed;
    }
    
    /**
     * キーダウン処理（スタブ）
     */
    handleKeydown(event) {
        if (!this.isInitialized || !this.isListening) return;
        
        // 押下キー記録
        this.pressedKeys.add(event.code);
        
        // ショートカット判定
        const keyCombo = this.buildKeyCombo(event);
        const context = this.getCurrentContext();
        const shortcutKey = `${context}:${keyCombo}`;
        
        const shortcut = this.shortcuts.get(shortcutKey);
        
        if (shortcut && shortcut.enabled) {
            console.log(`⌨️ ショートカット実行（スタブ）: ${keyCombo} → ${shortcut.action}`);
            
            // デフォルト動作防止
            event.preventDefault();
            event.stopPropagation();
            
            // アクション実行
            this.executeAction(shortcut.action, event);
            return true;
        }
        
        return false;
    }
    
    /**
     * キーアップ処理（スタブ）
     */
    handleKeyup(event) {
        if (!this.isInitialized || !this.isListening) return;
        
        // 押下キー削除
        this.pressedKeys.delete(event.code);
        
        // Space キー等の特殊処理（Phase1.5で実装）
        if (event.code === 'Space') {
            console.log('⌨️ Space キー離し（スタブ）');
            // パンモード終了等の処理（Phase1.5で実装）
        }
    }
    
    /**
     * キーコンビネーション構築
     */
    buildKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        if (event.metaKey) parts.push('Meta');
        
        parts.push(event.code);
        
        return parts.join('+');
    }
    
    /**
     * アクション実行（スタブ）
     */
    executeAction(action, event) {
        if (!this.eventBus) {
            console.warn('⚠️ EventBus not available');
            return false;