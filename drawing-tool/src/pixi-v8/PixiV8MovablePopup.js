/**
 * PixiJS v8移動可能ポップアップ・ドラッグ&ドロップ対応
 * モダンお絵かきツール v3.3 - Phase2移動可能UI統合システム
 * 
 * 機能:
 * - ドラッグ&ドロップ移動・タイトルバー操作
 * - 画面範囲制限・スナップ機能・リサイズ対応
 * - ふたば色統一・軽やか色適用・ブラー効果
 * - PixiJS v8統合・DOM最適化・GPU加速
 * - 複数ポップアップ管理・z-index制御・重複回避
 */

/**
 * PixiJS v8移動可能ポップアップ
 * ドラッグ&ドロップ・リサイズ・統一デザイン
 */
class PixiV8MovablePopup {
    constructor(pixiApp, config) {
        this.app = pixiApp;
        this.config = {
            title: config.title || '無題ポップアップ',
            content: config.content || '',
            position: { x: 100, y: 100, ...config.position },
            size: { width: 280, height: 200, ...config.size },
            resizable: config.resizable || false,
            closable: config.closable !== false,
            draggable: config.draggable !== false,
            modal: config.modal || false,
            zIndex: config.zIndex || 2000,
            className: config.className || ''
        };
        
        // DOM要素参照
        this.element = null;
        this.headerElement = null;
        this.contentElement = null;
        this.closeButton = null;
        
        // ドラッグ状態管理
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.lastPosition = { ...this.config.position };
        
        // リサイズ状態管理
        this.isResizing = false;
        this.resizeDirection = null;
        this.resizeStartSize = { ...this.config.size };
        this.resizeStartPos = { ...this.config.position };
        
        // イベントハンドラー（bind済み）
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
        
        // ポップアップ管理
        this.isVisible = false;
        this.isDestroyed = false;
        
        // パフォーマンス最適化
        this.useGPUAcceleration = true;
        this.snapThreshold = 10;
        this.constrainToScreen = true;
        
        // ふたば色設定
        this.colors = {
            background: 'linear-gradient(135deg, rgba(128,0,0,0.96) 0%, rgba(170,90,86,0.92) 100%