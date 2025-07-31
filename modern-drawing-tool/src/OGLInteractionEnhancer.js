// OGLInteractionEnhancer.js - Phase1.5最小UI統合（400-500行）

/**
 * 🎨 OGL統一エンジン用最小UI統合
 * Phase1.5専用・Fresco風ふたば☆ちゃんねる色統合
 */
export class OGLInteractionEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.canvas = oglEngine.canvas;
        
        // UI要素参照
        this.uiContainer = null;
        this.sidebar = null;
        this.toolPopups = new Map();
        this.colorPicker = null;
        this.canvasResizer = null;
        
        // 状態管理
        this.activeToolPopup = null;
        this.currentColor = '#800000'; // ふたば色系デフォルト
        this.toolSettings = {
            pen: { width: 2, opacity: 1.0, color: [0.5, 0.0, 0.0] },
            eraser: { width: 10, opacity: 1.0 }
        };
        
        // アニメーション制御
        this.animationTimeouts = new Set();
        
        // Phase2以降拡張予定
        // this.frescoSidebar = null;          // Phase2でFresco風詳細UI
        // this.popupPalettes = null;          // Phase2でポップアップパレット詳細
        // this.toolPreview = null;            // Phase2でツールプレビュー
        // this.gestureUI = null;              // Phase2でジェスチャーUI
        
        console.log('🎨 OGL UI統合エンハンサー初期化');
    }
    
    /**
     * 🖌️ 基本ツールアイコン動的生成
     */
    createBasicToolIcons() {
        // UIコンテナ作成
        this.uiContainer = document.createElement('div');
        this.uiContainer.className = 'drawing-ui-container';
        this.uiContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.uiContainer);
        
        // 左側サイドバー作成
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'drawing-sidebar';
        this.sidebar.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            width: 60px;
            background: linear-gradient(135deg, #2a2a2a 0%, #252525 100%);
            border-radius: 12px;
            padding: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            pointer-events: auto;
            backdrop-filter: blur(10px);
        `;
        this.uiContainer.appendChild(this.sidebar);
        
        // ツールアイコン定義（Phosphor Icons使用）
        const tools = [
            { name: 'pen', icon: '✏️', title: 'ペンツール' },
            { name: 'eraser', icon: '🗑️', title: '消しゴム' },
        ];
        
        tools.forEach((tool, index) => {
            const toolIcon = this.createToolIcon(tool, index === 0);
            this.sidebar.appendChild(toolIcon);
        });
        
        // 設定・操作アイコン
        const settingsGroup = this.createSettingsGroup();
        this.sidebar.appendChild(settingsGroup);
        
        console.log('🖌️ 基本ツールアイコン生成完了');
    }
    
    /**
     * 🎯 ツールアイコン作成
     */
    createToolIcon(tool, isActive = false) {
        const icon = document.createElement('div');
        icon.className = `tool-icon ${isActive ? 'active' : ''}`;
        icon.dataset.tool = tool.name;
        icon.title = tool.title;
        
        icon.style.cssText = `
            width: 44px;
            height: 44px;
            margin: 4px 0;
            background: ${isActive ? 'rgba(0,122,204,0.2)' : 'transparent'};
            border-radius: 8px;
            border-left: ${isActive ? '3px solid #007acc' : '3px solid transparent'};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 200ms ease-out;
            font-size: 20px;
            color: ${isActive ? '#ffffff' : '#888888'};
            position: relative;
        `;
        
        icon.textContent = tool.icon;
        
        // ホバーエフェクト
        icon.addEventListener('mouseenter', () => {
            if (!icon.classList.contains('active')) {
                icon.style.background = 'rgba(255,255,255,0.1)';
                icon.style.color = '#cccccc';
                icon.style.transform = 'scale(1.1)';
            }
        });
        
        icon.addEventListener('mouseleave', () => {
            if (!icon.classList.contains('active')) {
                icon.style.background = 'transparent';
                icon.style.color = '#888888';
                icon.style.transform = 'scale(1)';
            }
        });
        
        // クリックイベント
        icon.addEventListener('click', () => {
            this.selectTool(tool.name);
        });
        
        return icon;
    }
    
    /**
     * ⚙️ 設定グループ作成
     */
    createSettingsGroup() {
        const group = document.createElement('div');
        group.style.cssText = `
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #444444;
        `;
        
        const settings = [
            { name: 'clear', icon: '🖼️', title: 'キャンバスクリア' },
            { name: 'resize', icon: '⤢', title: 'サイズ調整' }
        ];
        
        settings.forEach(setting => {
            const icon = document.createElement('div');
            icon.className = 'setting-icon';
            icon.dataset.setting = setting.name;
            icon.title = setting.title;
            
            icon.style.cssText = `
                width: 44px;
                height: 44px;
                margin: 4px 0;
                background: transparent;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 200ms ease-out;
                font-size: 18px;
                color: #888888;
            `;
            
            icon.textContent = setting.icon;
            
            // ホバーエフェクト
            icon.addEventListener('mouseenter', () => {
                icon.style.background = 'rgba(255,255,255,0.1)';
                icon.style.color = '#cccccc';
            });
            
            icon.addEventListener('mouseleave', () => {
                icon.style.background = 'transparent';
                icon.style.color = '#888888';
            });
            
            // クリックイベント
            icon.addEventListener('click', () => {
                this.handleSettingClick(setting.name);
            });
            
            group.appendChild(icon);
        });
        
        return group;
    }
    
    /**
     * 🔧 設定クリック処理
     */
    handleSettingClick(settingName) {
        switch (settingName) {
            case 'clear':
                if (confirm('キャンバスをクリアしますか？')) {
                    this.engine.clearCanvas();
                    this.showNotification('キャンバスをクリアしました', 'success');
                }
                break;
            case 'resize':
                this.showCanvasResizer();
                break;
        }
    }
    
    /**
     * 🎨 ツール選択処理
     */
    selectTool(toolName) {
        // エンジンにツール変更通知
        this.engine.selectTool(toolName);
        
        // UI更新
        this.updateToolSelection(toolName);
        
        // ツール固有ポップアップ表示
        this.showToolPopup(toolName);
        
        console.log(`🎨 ツール選択: ${toolName}`);
    }
    
    /**
     * 🔄 ツール選択UI更新
     */
    updateToolSelection(toolName) {
        // 全アイコンの選択状態リセット
        this.sidebar.querySelectorAll('.tool-icon').forEach(icon => {
            icon.classList.remove('active');
            icon.style.background = 'transparent';
            icon.style.color = '#888888';
            icon.style.borderLeft = '3px solid transparent';
        });
        
        // 選択されたツールをアクティブ化
        const activeIcon = this.sidebar.querySelector(`[data-tool="${toolName}"]`);
        if (activeIcon) {
            activeIcon.classList.add('active');
            activeIcon.style.background = 'rgba(0,122,204,0.2)';
            activeIcon.style.color = '#ffffff';
            activeIcon.style.borderLeft = '3px solid #007acc';
        }
    }
    
    /**
     * 💬 最小ポップアップ初期化
     */
    setupMinimalPopups() {
        // ペンツールポップアップ
        this.createToolPopup('pen', {
            title: 'ペンツール',
            controls: [
                { type: 'slider', name: 'width', label: 'サイズ', min: 1, max: 20, value: 2 },
                { type: 'slider', name: 'opacity', label: '不透明度', min: 0.1, max: 1, value: 1, step: 0.1 }
            ]
        });
        
        // 消しゴムポップアップ
        this.createToolPopup('eraser', {
            title: '消しゴム',
            controls: [
                { type: 'slider', name: 'width', label: 'サイズ', min: 5, max: 50, value: 10 }
            ]
        });
        
        console.log('💬 最小ポップアップ初期化完了');
    }
    
    /**
     * 📦 ツールポップアップ作成
     */
    createToolPopup(toolName, config) {
        const popup = document.createElement('div');
        popup.className = `tool-popup tool-popup-${toolName}`;
        popup.style.cssText = `
            position: absolute;
            top: 20px;
            left: 100px;
            width: 200px;
            background: rgba(42,42,42,0.95);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
            opacity: 0;
            transform: translateX(-20px);
            transition: all 250ms ease-out;
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        
        // タイトル
        const title = document.createElement('div');
        title.textContent = config.title;
        title.style.cssText = `
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            text-align: center;
        `;
        popup.appendChild(title);
        
        // コントロール追加
        config.controls.forEach(control => {
            const controlElement = this.createPopupControl(toolName, control);
            popup.appendChild(controlElement);
        });
        
        this.uiContainer.appendChild(popup);
        this.toolPopups.set(toolName, popup);
    }
    
    /**
     * 🎛️ ポップアップコントロール作成
     */
    createPopupControl(toolName, control) {
        const container = document.createElement('div');
        container.style.cssText = 'margin-bottom: 12px;';
        
        if (control.type === 'slider') {
            // ラベル
            const label = document.createElement('div');
            label.textContent = control.label;
            label.style.cssText = `
                color: #cccccc;
                font-size: 12px;
                margin-bottom: 6px;
            `;
            container.appendChild(label);
            
            // スライダー
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = control.min;
            slider.max = control.max;
            slider.step = control.step || 1;
            slider.value = control.value;
            slider.style.cssText = `
                width: 100%;
                height: 4px;
                background: #444444;
                border-radius: 2px;
                outline: none;
                -webkit-appearance: none;
            `;
            
            // 値表示
            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = control.value;
            valueDisplay.style.cssText = `
                color: #007acc;
                font-size: 12px;
                font-weight: 600;
                float: right;
                margin-top: -18px;
            `;
            
            // スライダーイベント
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueDisplay.textContent = value;
                this.updateToolSetting(toolName, control.name, value);
            });
            
            container.appendChild(slider);
            container.appendChild(valueDisplay);
        }
        
        return container;
    }
    
    /**
     * ⚙️ ツール設定更新
     */
    updateToolSetting(toolName, settingName, value) {
        if (!this.toolSettings[toolName]) {
            this.toolSettings[toolName] = {};
        }
        
        this.toolSettings[toolName][settingName] = value;
        
        // エンジンに設定反映
        this.engine.updateToolSettings(toolName, { [settingName]: value });
        
        console.log(`⚙️ ツール設定更新: ${toolName}.${settingName} = ${value}`);
    }
    
    /**
     * 📱 ツールポップアップ表示
     */
    showToolPopup(toolName) {
        // 既存のポップアップを隠す
        this.hideAllPopups();
        
        const popup = this.toolPopups.get(toolName);
        if (popup) {
            popup.style.pointerEvents = 'auto';
            popup.style.opacity = '1';
            popup.style.transform = 'translateX(0)';
            this.activeToolPopup = toolName;
            
            // 3秒後に自動で隠す
            const timeout = setTimeout(() => {
                this.hideToolPopup(toolName);
            }, 3000);
            this.animationTimeouts.add(timeout);
        }
    }
    
    /**
     * 🚫 ツールポップアップ非表示
     */
    hideToolPopup(toolName) {
        const popup = this.toolPopups.get(toolName);
        if (popup) {
            popup.style.opacity = '0';
            popup.style.transform = 'translateX(-20px)';
            popup.style.pointerEvents = 'none';
            
            if (this.activeToolPopup === toolName) {
                this.activeToolPopup = null;
            }
        }
    }
    
    /**
     * 🚫 全ポップアップ非表示
     */
    hideAllPopups() {
        this.toolPopups.forEach((popup, toolName) => {
            this.hideToolPopup(toolName);
        });
        
        // タイムアウトクリア
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts.clear();
    }
    
    /**
     * 🎨 簡易色選択初期化
     */
    initializeColorPicker() {
        // ふたば☆ちゃんねる色パレット
        const futabaColors = [
            '#8B0000', '#FF4500', '#FF6347', '#FFD700',
            '#228B22', '#4169E1', '#8A2BE2', '#000000',
            '#FFFFFF', '#FFDBAC', '#F4C2A1', '#E8A584'
        ];
        
        // カラーパレット作成
        const colorPalette = document.createElement('div');
        colorPalette.className = 'color-palette';
        colorPalette.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 200px;
            background: rgba(42,42,42,0.95);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
            pointer-events: auto;
        `;
        
        // タイトル
        const title = document.createElement('div');
        title.textContent = 'ふたば☆色パレット';
        title.style.cssText = `
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            text-align: center;
        `;
        colorPalette.appendChild(title);
        
        // カラーグリッド
        const colorGrid = document.createElement('div');
        colorGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
        `;
        
        futabaColors.forEach(color => {
            const colorSwatch = document.createElement('div');
            colorSwatch.style.cssText = `
                width: 32px;
                height: 32px;
                background: ${color};
                border-radius: 6px;
                cursor: pointer;
                border: 2px solid ${color === this.currentColor ? '#007acc' : 'transparent'};
                transition: all 200ms ease-out;
            `;
            
            colorSwatch.addEventListener('click', () => {
                this.selectColor(color);
            });
            
            colorSwatch.addEventListener('mouseenter', () => {
                colorSwatch.style.transform = 'scale(1.1)';
            });
            
            colorSwatch.addEventListener('mouseleave', () => {
                colorSwatch.style.transform = 'scale(1)';
            });
            
            colorGrid.appendChild(colorSwatch);
        });
        
        colorPalette.appendChild(colorGrid);
        this.uiContainer.appendChild(colorPalette);
        this.colorPicker = colorPalette;
        
        console.log('🎨 ふたば☆色パレット初期化完了');
    }
    
    /**
     * 🎨 色選択処理
     */
    selectColor(color) {
        this.currentColor = color;
        
        // カラー値をOGL形式に変換
        const r = parseInt(color.slice(1, 3), 16) / 255;
        const g = parseInt(color.slice(3, 5), 16) / 255;
        const b = parseInt(color.slice(5, 7), 16) / 255;
        
        // エンジンに色設定反映
        this.engine.updateToolSettings('pen', { color: [r, g, b] });
        
        // UI更新
        this.updateColorSelection(color);
        
        this.showNotification(`色を変更: ${color}`, 'info');
        console.log(`🎨 色選択: ${color} -> [${r}, ${g}, ${b}]`);
    }
    
    /**
     * 🔄 色選択UI更新
     */
    updateColorSelection(selectedColor) {
        const colorSwatches = this.colorPicker?.querySelectorAll('div[style*="background"]');
        colorSwatches?.forEach(swatch => {
            const bgColor = swatch.style.background;
            if (bgColor.includes(selectedColor)) {
                swatch.style.border = '2px solid #007acc';
            } else {
                swatch.style.border = '2px solid transparent';
            }
        });
    }
    
    /**
     * 📏 キャンバスサイズ調整UI設定
     */
    setupCanvasResizer() {
        console.log('📏 キャンバスリサイザー設定完了（Phase2で詳細実装）');
        // Phase2で詳細なリサイザーUI実装予定
    }
    
    /**
     * 📏 キャンバスリサイザー表示
     */
    showCanvasResizer() {
        // 簡易リサイザー（Phase2で高度化）
        const width = prompt('幅を入力してください', this.canvas.width);
        const height = prompt('高さを入力してください', this.canvas.height);
        
        if (width && height) {
            const w = parseInt(width);
            const h = parseInt(height);
            if (w > 0 && h > 0) {
                this.engine.resizeCanvas(w, h);
                this.showNotification(`キャンバスサイズ: ${w}x${h}`, 'success');
            }
        }
    }
    
    /**
     * 💡 通知表示
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            top: 100px;
            right: 20px;
            padding: 12px 16px;
            background: ${type === 'success' ? 'rgba(34,139,34,0.9)' : 
                        type === 'error' ? 'rgba(220,20,60,0.9)' : 'rgba(0,122,204,0.9)'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateX(20px);
            transition: all 300ms ease-out;
            pointer-events: none;
        `;
        notification.textContent = message;
        
        this.uiContainer.appendChild(notification);
        
        // アニメーション表示
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 50);
        
        // 3秒後に削除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * 👋 ウェルカムメッセージ表示
     */
    showWelcomeMessage() {
        this.showNotification('🎨 Phase1.5: OGL統一エンジン + 最小UI統合 起動完了!', 'success');
        
        // 5秒後にツールヒント
        setTimeout(() => {
            this.showNotification('💡 左側のペンツールをクリックして描画開始!', 'info');
        }, 5000);
    }
    
    /**
     * 🧹 リソース解放
     */
    dispose() {
        // タイムアウトクリア
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts.clear();
        
        // UI要素削除
        if (this.uiContainer && this.uiContainer.parentNode) {
            this.uiContainer.parentNode.removeChild(this.uiContainer);
        }
        
        // 参照クリア
        this.toolPopups.clear();
        this.uiContainer = null;
        this.sidebar = null;
        this.colorPicker = null;
        
        console.log('🧹 OGL UI統合エンハンサー 解放完了');
    }
    
    // Phase2以降拡張予定機能スタブ
    
    /**
     * Phase2: Fresco風詳細サイドバー
     */
    /*
    initializeFrescoSidebar() {
        // Phase2で実装: 配色・質感・アニメーション詳細
        // this.frescoSidebar = new FrescoSidebarRenderer();
    }
    
    createPopupPalettes() {
        // Phase2で実装: ポップアップパレット詳細・スライダー
        // this.popupPalettes = new PopupPaletteSystem();
    }
    
    initializeToolPreview() {
        // Phase2で実装: ツールプレビュー・カーソル変更
        // this.toolPreview = new ToolPreviewSystem();
    }
    */
}