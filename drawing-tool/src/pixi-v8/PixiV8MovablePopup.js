/**
 * PixiJS v8移動可能ポップアップシステム
 * モダンお絵かきツール v3.3 - Phase2移動可能UI実装
 * 
 * 機能:
 * - ドラッグ&ドロップ移動可能ポップアップ
 * - ふたば色統一デザイン・ブラー背景
 * - 複数ポップアップ管理・Z-index制御
 * - 画面範囲制限・衝突回避・スナッピング
 * - アニメーション・フェード効果・GPU最適化
 */

import { Container, Graphics, Text } from 'pixi.js';

/**
 * PixiJS v8移動可能ポップアップシステム
 * ドラッグ移動・複数管理・レスポンシブデザイン
 */
class PixiV8MovablePopup {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        
        // ポップアップ管理
        this.activePopups = new Map();
        this.popupZIndex = 2000;
        this.maxPopups = 8;
        
        // ドラッグ状態管理
        this.dragState = {
            isDragging: false,
            currentPopup: null,
            offset: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 }
        };
        
        // レイアウト設定
        this.layout = {
            margin: 20,
            snapDistance: 15,
            defaultSize: { width: 280, height: 200 },
            minSize: { width: 200, height: 150 },
            maxSize: { width: 600, height: 500 }
        };
        
        // アニメーション設定
        this.animation = {
            duration: 300,
            easing: 'ease-out',
            useGPU: true
        };
        
        // ふたば色パレット
        this.colors = {
            background: 'rgba(128,0,0,0.96)',
            headerBg: 'rgba(170,90,86,0.8)',
            border: 'rgba(240,224,214,0.3)',
            text: '#f0e0d6',
            accent: '#ffffee'
        };
        
        // ポップアップコンテナ確保
        this.popupContainer = this.ensurePopupContainer();
        
        this.setupEventListeners();
        this.setupGlobalDragHandling();
        
        console.log('✅ PixiV8MovablePopup初期化完了 - 移動可能UI');
    }
    
    /**
     * ポップアップコンテナ確保・作成
     */
    ensurePopupContainer() {
        let container = document.getElementById('popupContainer');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'popupContainer';
            container.className = 'popup-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2000;
            `;
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * EventStore統合設定
     */
    setupEventListeners() {
        // ポップアップ表示要求
        this.eventStore.on('popup-request', (data) => {
            this.show(data.type, data.config);
        });
        
        // ポップアップ非表示要求
        this.eventStore.on('popup-hide', (data) => {
            this.hide(data.target);
        });
        
        // 全ポップアップ非表示
        this.eventStore.on('popup-hide-all', () => {
            this.hideAll();
        });
        
        // UI位置リセット要求
        this.eventStore.on('ui-reset-positions', () => {
            this.resetAllPositions();
        });
        
        // ウィンドウリサイズ対応
        this.eventStore.on('canvas-resize', (data) => {
            this.handleWindowResize(data);
        });
        
        console.log('🔗 EventStore統合完了');
    }
    
    /**
     * グローバルドラッグハンドリング設定
     */
    setupGlobalDragHandling() {
        // グローバルマウスイベント
        document.addEventListener('mousemove', (e) => {
            this.handleGlobalMouseMove(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.handleGlobalMouseUp(e);
        });
        
        // タッチイベント対応
        document.addEventListener('touchmove', (e) => {
            this.handleGlobalTouchMove(e);
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            this.handleGlobalTouchEnd(e);
        });
        
        console.log('👆 グローバルドラッグハンドリング設定完了');
    }
    
    /**
     * ポップアップ表示
     * タイプ別設定・位置計算・アニメーション
     */
    show(type, config = {}) {
        // 既存ポップアップ確認
        if (this.activePopups.has(type)) {
            this.bringToFront(type);
            return this.activePopups.get(type);
        }
        
        // 最大数制限チェック
        if (this.activePopups.size >= this.maxPopups) {
            console.warn('⚠️ ポップアップ最大数に達しました');
            return null;
        }
        
        // 設定統合
        const popupConfig = this.mergeConfig(type, config);
        
        // ポップアップ作成
        const popup = this.createPopup(type, popupConfig);
        
        // 位置計算・設定
        const position = this.calculateOptimalPosition(popupConfig);
        this.setPopupPosition(popup, position);
        
        // DOM挿入
        this.popupContainer.appendChild(popup);
        this.activePopups.set(type, popup);
        
        // 表示アニメーション
        this.animateShow(popup);
        
        // イベント通知
        this.eventStore.emit('popup-shown', { type, popup });
        
        console.log(`📋 ポップアップ表示: ${type}`);
        return popup;
    }
    
    /**
     * 設定統合・デフォルト値適用
     */
    mergeConfig(type, config) {
        const defaults = {
            title: type,
            content: '',
            position: 'auto',
            size: { ...this.layout.defaultSize },
            closable: true,
            draggable: true,
            resizable: false,
            modal: false,
            fadeIn: true
        };
        
        // タイプ別デフォルト設定
        const typeDefaults = this.getTypeDefaults(type);
        
        return { ...defaults, ...typeDefaults, ...config };
    }
    
    /**
     * タイプ別デフォルト設定取得
     */
    getTypeDefaults(type) {
        const typeDefaults = {
            'color-palette': {
                title: 'カラーパレット',
                size: { width: 240, height: 200 },
                position: { x: 80, y: 100 }
            },
            'tool-settings': {
                title: 'ツール設定',
                size: { width: 280, height: 250 },
                position: { x: 100, y: 80 }
            },
            'layer-properties': {
                title: 'レイヤープロパティ',
                size: { width: 300, height: 220 },
                position: { x: 120, y: 120 }
            },
            'canvas-settings': {
                title: 'キャンバス設定',
                size: { width: 320, height: 280 },
                position: { x: 150, y: 100 }
            },
            'export-dialog': {
                title: 'エクスポート',
                size: { width: 350, height: 300 },
                position: 'center',
                modal: true
            },
            'shortcut-help': {
                title: 'ショートカット一覧',
                size: { width: 400, height: 350 },
                position: 'center'
            }
        };
        
        return typeDefaults[type] || {};
    }
    
    /**
     * ポップアップ作成
     * DOM構造・スタイル・イベント設定
     */
    createPopup(type, config) {
        const popup = document.createElement('div');
        popup.className = 'movable-popup';
        popup.dataset.type = type;
        popup.style.cssText = `
            position: absolute;
            background: ${this.colors.background};
            backdrop-filter: blur(12px);
            border: 1px solid ${this.colors.border};
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            pointer-events: auto;
            z-index: ${this.popupZIndex++};
            width: ${config.size.width}px;
            min-height: ${config.size.height}px;
            opacity: 0;
            transform: translateZ(0) scale(0.95);
            transition: all ${this.animation.duration}ms ${this.animation.easing};
            user-select: none;
            contain: layout style paint;
            will-change: transform, opacity;
        `;
        
        // ヘッダー作成
        const header = this.createPopupHeader(config);
        popup.appendChild(header);
        
        // コンテンツ作成
        const content = this.createPopupContent(config);
        popup.appendChild(content);
        
        // ドラッグ機能設定
        if (config.draggable) {
            this.makeDraggable(popup, header);
        }
        
        // リサイズ機能設定
        if (config.resizable) {
            this.makeResizable(popup);
        }
        
        return popup;
    }
    
    /**
     * ポップアップヘッダー作成
     */
    createPopupHeader(config) {
        const header = document.createElement('div');
        header.className = 'popup-header';
        header.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid ${this.colors.border};
            background: ${this.colors.headerBg};
            border-radius: 16px 16px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: ${config.draggable ? 'move' : 'default'};
            user-select: none;
        `;
        
        // タイトル
        const title = document.createElement('span');
        title.className = 'popup-title';
        title.textContent = config.title;
        title.style.cssText = `
            color: ${this.colors.text};
            font-size: 14px;
            font-weight: 600;
            flex: 1;
        `;
        
        header.appendChild(title);
        
        // 閉じるボタン
        if (config.closable) {
            const closeBtn = this.createCloseButton();
            header.appendChild(closeBtn);
        }
        
        return header;
    }
    
    /**
     * 閉じるボタン作成
     */
    createCloseButton() {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'popup-close';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            width: 24px;
            height: 24px;
            background: transparent;
            border: none;
            color: ${this.colors.text};
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: background 200ms ease;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'transparent';
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const popup = closeBtn.closest('.movable-popup');
            const type = popup.dataset.type;
            this.hide(type);
        });
        
        return closeBtn;
    }
    
    /**
     * ポップアップコンテンツ作成
     */
    createPopupContent(config) {
        const content = document.createElement('div');
        content.className = 'popup-content';
        content.style.cssText = `
            padding: 16px;
            color: ${this.colors.text};
            overflow-y: auto;
            max-height: 400px;
        `;
        
        // コンテンツ設定
        if (config.content instanceof HTMLElement) {
            content.appendChild(config.content);
        } else if (typeof config.content === 'string') {
            content.innerHTML = config.content;
        } else if (typeof config.content === 'function') {
            const generatedContent = config.content();
            if (generatedContent instanceof HTMLElement) {
                content.appendChild(generatedContent);
            } else {
                content.innerHTML = generatedContent;
            }
        }
        
        return content;
    }
    
    /**
     * ドラッグ機能実装
     */
    makeDraggable(popup, handle) {
        const handleMouseDown = (e) => {
            this.startDrag(popup, e);
        };
        
        const handleTouchStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrag(popup, touch);
        };
        
        handle.addEventListener('mousedown', handleMouseDown);
        handle.addEventListener('touchstart', handleTouchStart, { passive: false });
        
        // ドラッグ開始時のカーソル設定
        handle.style.cursor = 'move';
    }
    
    /**
     * ドラッグ開始
     */
    startDrag(popup, event) {
        const rect = popup.getBoundingClientRect();
        
        this.dragState = {
            isDragging: true,
            currentPopup: popup,
            offset: {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            },
            startPosition: {
                x: rect.left,
                y: rect.top
            }
        };
        
        // ドラッグ中スタイル
        popup.style.zIndex = this.popupZIndex++;
        popup.style.cursor = 'grabbing';
        
        // 選択無効化
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        
        // 前面表示
        this.bringToFront(popup.dataset.type);
    }
    
    /**
     * グローバルマウス移動処理
     */
    handleGlobalMouseMove(e) {
        if (!this.dragState.isDragging) return;
        
        this.updateDragPosition(e.clientX, e.clientY);
    }
    
    /**
     * グローバルタッチ移動処理
     */
    handleGlobalTouchMove(e) {
        if (!this.dragState.isDragging) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        this.updateDragPosition(touch.clientX, touch.clientY);
    }
    
    /**
     * ドラッグ位置更新
     */
    updateDragPosition(clientX, clientY) {
        const popup = this.dragState.currentPopup;
        if (!popup) return;
        
        const x = clientX - this.dragState.offset.x;
        const y = clientY - this.dragState.offset.y;
        
        // 画面範囲制限
        const constrainedPosition = this.constrainToScreen(popup, x, y);
        
        // スナッピング処理
        const snappedPosition = this.applySnapping(constrainedPosition);
        
        this.setPopupPosition(popup, snappedPosition);
    }
    
    /**
     * グローバルマウスアップ処理
     */
    handleGlobalMouseUp(e) {
        this.endDrag();
    }
    
    /**
     * グローバルタッチ終了処理
     */
    handleGlobalTouchEnd(e) {
        this.endDrag();
    }
    
    /**
     * ドラッグ終了
     */
    endDrag() {
        if (!this.dragState.isDragging) return;
        
        const popup = this.dragState.currentPopup;
        
        // ドラッグ状態リセット
        this.dragState = {
            isDragging: false,
            currentPopup: null,
            offset: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 }
        };
        
        // スタイルリセット
        if (popup) {
            popup.style.cursor = '';
            const header = popup.querySelector('.popup-header');
            if (header) {
                header.style.cursor = 'move';
            }
        }
        
        // 選択復元
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
    }
    
    /**
     * 画面範囲制限
     */
    constrainToScreen(popup, x, y) {
        const rect = popup.getBoundingClientRect();
        const margin = this.layout.margin;
        
        const maxX = window.innerWidth - rect.width - margin;
        const maxY = window.innerHeight - rect.height - margin;
        
        return {
            x: Math.max(margin, Math.min(maxX, x)),
            y: Math.max(margin, Math.min(maxY, y))
        };
    }
    
    /**
     * スナッピング処理
     * 画面端・他ポップアップとの吸着
     */
    applySnapping(position) {
        const snapDistance = this.layout.snapDistance;
        let { x, y } = position;
        
        // 画面端スナッピング
        if (Math.abs(x - this.layout.margin) < snapDistance) {
            x = this.layout.margin;
        }
        
        if (Math.abs(y - this.layout.margin) < snapDistance) {
            y = this.layout.margin;
        }
        
        const screenWidth = window.innerWidth - this.layout.margin;
        const screenHeight = window.innerHeight - this.layout.margin;
        
        if (Math.abs(x - screenWidth + 280) < snapDistance) { // 想定幅280px
            x = screenWidth - 280;
        }
        
        if (Math.abs(y - screenHeight + 200) < snapDistance) { // 想定高さ200px
            y = screenHeight - 200;
        }
        
        return { x, y };
    }
    
    /**
     * ポップアップ位置設定
     */
    setPopupPosition(popup, position) {
        popup.style.left = position.x + 'px';
        popup.style.top = position.y + 'px';
    }
    
    /**
     * 最適位置計算
     * 既存ポップアップとの重複回避・画面中央配置等
     */
    calculateOptimalPosition(config) {
        if (config.position === 'center') {
            return this.getCenterPosition(config.size);
        }
        
        if (config.position === 'auto') {
            return this.getAutoPosition(config.size);
        }
        
        if (typeof config.position === 'object') {
            return { ...config.position };
        }
        
        return this.getDefaultPosition();
    }
    
    /**
     * 中央位置取得
     */
    getCenterPosition(size) {
        return {
            x: (window.innerWidth - size.width) / 2,
            y: (window.innerHeight - size.height) / 2
        };
    }
    
    /**
     * 自動位置取得（重複回避）
     */
    getAutoPosition(size) {
        const step = 30;
        let x = 100;
        let y = 100;
        
        // 既存ポップアップとの重複チェック
        for (let attempt = 0; attempt < 10; attempt++) {
            const testPosition = { x: x + (attempt * step), y: y + (attempt * step) };
            
            if (!this.isPositionOccupied(testPosition, size)) {
                return this.constrainToScreen({ getBoundingClientRect: () => ({ width: size.width, height: size.height }) }, testPosition.x, testPosition.y);
            }
        }
        
        return this.getDefaultPosition();
    }
    
    /**
     * 位置占有チェック
     */
    isPositionOccupied(position, size) {
        const testRect = {
            left: position.x,
            top: position.y,
            right: position.x + size.width,
            bottom: position.y + size.height
        };
        
        for (const popup of this.activePopups.values()) {
            const popupRect = popup.getBoundingClientRect();
            
            if (this.rectsOverlap(testRect, popupRect)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 矩形重複判定
     */
    rectsOverlap(rect1, rect2) {
        return !(rect1.right < rect2.left || 
                 rect1.left > rect2.right || 
                 rect1.bottom < rect2.top || 
                 rect1.top > rect2.bottom);
    }
    
    /**
     * デフォルト位置取得
     */
    getDefaultPosition() {
        return { x: 120, y: 120 };
    }
    
    /**
     * 表示アニメーション
     */
    animateShow(popup) {
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translateZ(0) scale(1)';
        });
    }
    
    /**
     * ポップアップ非表示
     */
    hide(target) {
        if (target === 'all') {
            this.hideAll();
            return;
        }
        
        const popup = this.activePopups.get(target);
        if (!popup) return;
        
        // 非表示アニメーション
        this.animateHide(popup, () => {
            popup.remove();
            this.activePopups.delete(target);
            
            // イベント通知
            this.eventStore.emit('popup-hidden', { type: target });
            
            console.log(`🗑️ ポップアップ非表示: ${target}`);
        });
    }
    
    /**
     * 非表示アニメーション
     */
    animateHide(popup, callback) {
        popup.style.opacity = '0';
        popup.style.transform = 'translateZ(0) scale(0.95)';
        
        setTimeout(() => {
            callback();
        }, this.animation.duration);
    }
    
    /**
     * 全ポップアップ非表示
     */
    hideAll() {
        const types = Array.from(this.activePopups.keys());
        types.forEach(type => this.hide(type));
        
        console.log('🗑️ 全ポップアップ非表示');
    }
    
    /**
     * 前面表示
     */
    bringToFront(type) {
        const popup = this.activePopups.get(type);
        if (popup) {
            popup.style.zIndex = this.popupZIndex++;
        }
    }
    
    /**
     * リサイズ機能実装（将来拡張）
     */
    makeResizable(popup) {
        // Phase3以降で実装予定
        console.log('📏 リサイズ機能（Phase3で実装予定）');
    }
    
    /**
     * 全ポップアップ位置リセット
     */
    resetAllPositions() {
        let offsetX = 100;
        let offsetY = 100;
        const step = 30;
        
        this.activePopups.forEach((popup, type) => {
            const position = { x: offsetX, y: offsetY };
            const constrainedPosition = this.constrainToScreen(popup, position.x, position.y);
            
            this.setPopupPosition(popup, constrainedPosition);
            
            offsetX += step;
            offsetY += step;
        });
        
        console.log('🔄 全ポップアップ位置リセット完了');
    }
    
    /**
     * ウィンドウリサイズ対応
     */
    handleWindowResize(data) {
        // 全ポップアップの位置を画面内に調整
        this.activePopups.forEach((popup, type) => {
            const rect = popup.getBoundingClientRect();
            const constrainedPosition = this.constrainToScreen(popup, rect.left, rect.top);
            this.setPopupPosition(popup, constrainedPosition);
        });
        
        console.log('📐 ポップアップ位置リサイズ調整完了');
    }
    
    /**
     * ポップアップ存在確認
     */
    has(type) {
        return this.activePopups.has(type);
    }
    
    /**
     * ポップアップ取得
     */
    get(type) {
        return this.activePopups.get(type);
    }
    
    /**
     * アクティブポップアップ一覧取得
     */
    getActiveTypes() {
        return Array.from(this.activePopups.keys());
    }
    
    /**
     * ポップアップ数取得
     */
    getCount() {
        return this.activePopups.size;
    }
    
    /**
     * 特定タイプのポップアップ内容更新
     */
    updateContent(type, content) {
        const popup = this.activePopups.get(type);
        if (!popup) return false;
        
        const contentElement = popup.querySelector('.popup-content');
        if (!contentElement) return false;
        
        if (content instanceof HTMLElement) {
            contentElement.innerHTML = '';
            contentElement.appendChild(content);
        } else {
            contentElement.innerHTML = content;
        }
        
        return true;
    }
    
    /**
     * ポップアップタイトル更新
     */
    updateTitle(type, title) {
        const popup = this.activePopups.get(type);
        if (!popup) return false;
        
        const titleElement = popup.querySelector('.popup-title');
        if (!titleElement) return false;
        
        titleElement.textContent = title;
        return true;
    }
    
    /**
     * カスタムポップアップ作成ヘルパー
     */
    createCustomPopup(type, options) {
        const customConfig = {
            title: options.title || type,
            content: options.content || '',
            size: options.size || this.layout.defaultSize,
            position: options.position || 'auto',
            ...options
        };
        
        return this.show(type, customConfig);
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            activePopups: this.getActiveTypes(),
            popupCount: this.getCount(),
            maxPopups: this.maxPopups,
            dragState: { ...this.dragState },
            layout: { ...this.layout },
            zIndex: this.popupZIndex,
            containerExists: !!this.popupContainer
        };
    }
    
    /**
     * パフォーマンス統計取得
     */
    getPerformanceStats() {
        return {
            activePopups: this.activePopups.size,
            maxPopups: this.maxPopups,
            memoryUsage: this.estimateMemoryUsage(),
            animationCount: 0, // 今後追加
            gpuAcceleration: this.animation.useGPU
        };
    }
    
    /**
     * メモリ使用量推定
     */
    estimateMemoryUsage() {
        const baseSize = 1024; // 基本サイズ (bytes)
        const popupSize = 2048; // ポップアップあたりのサイズ (bytes)
        
        return baseSize + (this.activePopups.size * popupSize);
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        if (newSettings.layout) {
            Object.assign(this.layout, newSettings.layout);
        }
        
        if (newSettings.animation) {
            Object.assign(this.animation, newSettings.animation);
        }
        
        if (newSettings.colors) {
            Object.assign(this.colors, newSettings.colors);
        }
        
        console.log('⚙️ ポップアップ設定更新完了');
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 全ポップアップ削除
        this.hideAll();
        
        // イベントリスナー削除
        document.removeEventListener('mousemove', this.handleGlobalMouseMove);
        document.removeEventListener('mouseup', this.handleGlobalMouseUp);
        document.removeEventListener('touchmove', this.handleGlobalTouchMove);
        document.removeEventListener('touchend', this.handleGlobalTouchEnd);
        
        // ドラッグ状態リセット
        this.endDrag();
        
        // 参照クリア
        this.activePopups.clear();
        this.popupContainer = null;
        
        // Body スタイルリセット
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        
        console.log('🗑️ PixiV8MovablePopup リソース解放完了');
    }
}

export default PixiV8MovablePopup;