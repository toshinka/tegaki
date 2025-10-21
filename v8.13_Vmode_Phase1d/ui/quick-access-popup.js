// ===== ui/quick-access-popup.js - PopupManager対応改修版 =====
// 責務: クイックアクセスUI表示・管理
// 🔥 改修: PopupManager統合、共通インターフェース適用

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.QuickAccessPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.popup = null;
        this.isVisible = false;
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('quick-access-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            // 既存要素の初期化
            this.popup.classList.remove('show');
            this.popup.style.display = '';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'quick-access-popup';
        popupDiv.className = 'popup-panel';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.minWidth = '280px';
        popupDiv.style.maxWidth = '320px';
        
        popupDiv.innerHTML = `
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center;">
                クイックアクセス
            </div>
            
            <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; line-height: 1.6;">
                <div style="font-size: 24px; margin-bottom: 12px;">🎨</div>
                <div style="font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">準備中</div>
                <div style="font-size: 11px; margin-top: 16px; text-align: left; background: var(--futaba-background); padding: 12px; border-radius: 6px; border: 1px solid var(--futaba-light-medium);">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--futaba-maroon);">将来実装予定:</div>
                    <div>• ドラッグ移動機能</div>
                    <div>• 消しゴムクイック切替</div>
                    <div>• カラーパレット調整</div>
                    <div>• ブラシプリセット</div>
                    <div>• 自由配置（位置記憶）</div>
                </div>
                <div style="font-size: 10px; margin-top: 12px; color: var(--text-secondary); background: var(--futaba-cream); padding: 8px; border-radius: 4px;">
                    ショートカット: <strong style="color: var(--futaba-maroon);">Q</strong> キー / ペンアイコンクリック
                </div>
            </div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
    }
    
    // ===== 必須インターフェース =====
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.classList.add('show');
        this.isVisible = true;
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup;
    }
    
    destroy() {
        // cleanup if needed
    }
};

// グローバル公開
window.QuickAccessPopup = window.TegakiUI.QuickAccessPopup;

console.log('✅ quick-access-popup.js (PopupManager対応版) loaded');