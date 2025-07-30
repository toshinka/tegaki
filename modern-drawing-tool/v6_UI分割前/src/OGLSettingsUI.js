// Phase 1.5: OGL統一設定UI管理システム
export class OGLSettingsUI {
    constructor(settingsManager) {
        this.settings = settingsManager;
        this.modal = null;
        this.isOpen = false;
        
        this.setupSettingsButton();
    }
    
    // 設定ボタン追加
    setupSettingsButton() {
        const button = document.createElement('button');
        button.className = 'action-button settings-button';
        button.innerHTML = '⚙️ 設定';
        button.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--main-color);
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            position: absolute;
            top: 10px;
            right: 180px;
            transition: all 0.2s ease;
            color: var(--main-color);
        `;
        
        button.addEventListener('click', () => this.toggleSettings());
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--main-color)';
            button.style.color = 'white';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.color = 'var(--main-color)';
        });
        
        document.body.appendChild(button);
    }
    
    // 設定モーダル表示切り替え
    toggleSettings() {
        if (this.isOpen) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    }
    
    // 設定モーダル作成・表示
    openSettings() {
        this.modal = document.createElement('div');
        this.modal.className = 'settings-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            max-height: 70vh;
            overflow-y: auto;
            box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2);
            font-family: Arial, sans-serif;
        `;
        
        content.innerHTML = this.generateSettingsHTML();
        this.modal.appendChild(content);
        
        // CSS追加
        this.addSettingsCSS();
        
        // イベントリスナー設定
        this.setupSettingsEvents(content);
        
        document.body.appendChild(this.modal);
        this.isOpen = true;
        
        // 外部クリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeSettings();
        });
    }
    
    // 設定HTML生成
    generateSettingsHTML() {
        return `
            <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px;">描画設定</h2>
            
            <div class="settings-section">
                <h3>ショートカットキー</h3>
                ${this.generateShortcutSettings()}
            </div>
            
            <div class="settings-section">
                <h3>描画設定</h3>
                ${this.generateDrawingSettings()}
            </div>
            
            <div class="settings-section">
                <h3>品質設定</h3>
                ${this.generateQualitySettings()}
            </div>
            
            <div class="settings-footer">
                <button id="resetSettings" class="footer-button reset-button">デフォルトに戻す</button>
                <button id="closeSettings" class="footer-button close-button">閉じる</button>
            </div>
        `;
    }
    
    generateShortcutSettings() {
        const shortcuts = this.settings.get('shortcuts');
        return Object.entries(shortcuts).map(([key, value]) => `
            <div class="setting-item">
                <label class="setting-label">${this.getShortcutLabel(key)}</label>
                <input type="text" class="setting-input" data-setting="shortcuts.${key}" value="${value}">
            </div>
        `).join('');
    }
    
    generateDrawingSettings() {
        const drawing = this.settings.get('drawing');
        return `
            <div class="setting-item">
                <label class="setting-label">ペンサイズ</label>
                <div class="range-container">
                    <input type="range" class="setting-range" data-setting="drawing.penSize" 
                           min="1" max="50" value="${drawing.penSize}">
                    <span class="value">${drawing.penSize}</span>
                </div>
            </div>
            <div class="setting-item">
                <label class="setting-label">不透明度</label>
                <div class="range-container">
                    <input type="range" class="setting-range" data-setting="drawing.opacity" 
                           min="1" max="100" value="${drawing.opacity}">
                    <span class="value">${drawing.opacity}%</span>
                </div>
            </div>
            <div class="setting-item">
                <label class="setting-label">筆圧感度</label>
                <div class="range-container">
                    <input type="range" class="setting-range" data-setting="drawing.pressureSensitivity" 
                           min="0" max="100" value="${drawing.pressureSensitivity}">
                    <span class="value">${drawing.pressureSensitivity}%</span>
                </div>
            </div>
            <div class="setting-item">
                <label class="setting-label checkbox-label">
                    <input type="checkbox" class="setting-checkbox" data-setting="drawing.smoothing" 
                           ${drawing.smoothing ? 'checked' : ''}>
                    スムージング
                </label>
            </div>
        `;
    }
    
    generateQualitySettings() {
        const quality = this.settings.get('quality');
        return `
            <div class="setting-item">
                <label class="setting-label checkbox-label">
                    <input type="checkbox" class="setting-checkbox" data-setting="quality.antialiasing" 
                           ${quality.antialiasing ? 'checked' : ''}>
                    アンチエイリアシング
                </label>
            </div>
            <div class="setting-item">
                <label class="setting-label">筆圧カーブ</label>
                <select class="setting-select" data-setting="quality.pressureCurve">
                    <option value="linear" ${quality.pressureCurve === 'linear' ? 'selected' : ''}>リニア</option>
                    <option value="quadratic" ${quality.pressureCurve === 'quadratic' ? 'selected' : ''}>2次</option>
                    <option value="cubic" ${quality.pressureCurve === 'cubic' ? 'selected' : ''}>3次</option>
                </select>
            </div>
            <div class="setting-item">
                <label class="setting-label">スムージング強度</label>
                <div class="range-container">
                    <input type="range" class="setting-range" data-setting="quality.smoothingFactor" 
                           min="0" max="100" value="${quality.smoothingFactor * 100}" step="1">
                    <span class="value">${Math.round(quality.smoothingFactor * 100)}%</span>
                </div>
            </div>
        `;
    }
    
    // 設定CSS追加
    addSettingsCSS() {
        if (document.getElementById('settings-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'settings-styles';
        style.textContent = `
            .settings-section {
                margin-bottom: 24px;
            }
            .settings-section h3 {
                margin: 0 0 12px 0;
                color: #555;
                font-size: 14px;
                font-weight: bold;
            }
            .setting-item {
                margin-bottom: 12px;
            }
            .setting-label {
                display: block;
                margin-bottom: 4px;
                color: #666;
                font-size: 12px;
                font-weight: 500;
            }
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .setting-input, .setting-select {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
            }
            .setting-range {
                width: 100%;
                margin: 0;
            }
            .range-container {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .range-container .value {
                min-width: 40px;
                text-align: right;
                font-size: 11px;
                color: #666;
            }
            .setting-checkbox {
                margin: 0;
            }
            .settings-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #eee;
            }
            .footer-button {
                padding: 8px 16px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .reset-button {
                background: #f8f9fa;
                color: #666;
            }
            .reset-button:hover {
                background: #e9ecef;
                border-color: #adb5bd;
            }
            .close-button {
                background: var(--main-color, #800000);
                color: white;
                border-color: var(--main-color, #800000);
            }
            .close-button:hover {
                background: #a00000;
                border-color: #a00000;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 設定イベント設定
    setupSettingsEvents(content) {
        // 入力要素の変更監視
        content.querySelectorAll('[data-setting]').forEach(input => {
            const setting = input.dataset.setting;
            
            input.addEventListener('input', () => {
                let value = input.value;
                
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'range') {
                    value = parseInt(value);
                    
                    // 特殊な値変換処理
                    if (setting === 'quality.smoothingFactor') {
                        value = value / 100; // 0-1の範囲に正規化
                    }
                    
                    // 値表示更新
                    const valueSpan = input.parentElement.querySelector('.value');
                    if (valueSpan) {
                        if (setting.includes('opacity') || setting.includes('Sensitivity')) {
                            valueSpan.textContent = `${input.value}%`;
                        } else if (setting === 'quality.smoothingFactor') {
                            valueSpan.textContent = `${input.value}%`;
                        } else {
                            valueSpan.textContent = input.value;
                        }
                    }
                }
                
                this.settings.set(setting, value);
            });
        });
        
        // ボタンイベント
        content.querySelector('#resetSettings').addEventListener('click', () => {
            if (confirm('設定をデフォルトに戻しますか？')) {
                this.settings.resetToDefaults();
                this.closeSettings();
            }
        });
        
        content.querySelector('#closeSettings').addEventListener('click', () => {
            this.closeSettings();
        });
    }
    
    // ショートカットラベル取得
    getShortcutLabel(key) {
        const labels = {
            penTool: 'ペンツール',
            undo: '取り消し',
            clear: 'クリア',
            fullscreen: 'フルスクリーン',
            togglePanel: 'パネル切り替え',
            penSizeUp: 'ペンサイズ+',
            penSizeDown: 'ペンサイズ-',
            opacityUp: '不透明度+',
            opacityDown: '不透明度-'
        };
        return labels[key] || key;
    }
    
    // モーダル閉じる
    closeSettings() {
        if (this.modal) {
            document.body.removeChild(this.modal);
            this.modal = null;
        }
        this.isOpen = false;
    }
}