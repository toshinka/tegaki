// Toolbar.ts - ツールバーUI・80px幅・Phase2新規実装
// 2_TECHNICAL_DESIGN準拠・ふたば色統一・アクセシビリティ対応

import type { EventBus, IEventData } from '../core/EventBus.js';
import { UI_CONSTANTS } from '../constants/ui-constants.js';
import { DRAWING_CONSTANTS, type ToolName } from '../constants/drawing-constants.js';

/**
 * ツールボタン情報・UI表示・アイコン・状態管理
 */
interface IToolButton {
  name: ToolName;
  icon: string;
  label: string;
  shortcut: string;
  category: 'drawing' | 'editing' | 'selection';
  element?: HTMLElement;
}

/**
 * ツールバー状態・アクティブツール・設定
 */
interface IToolbarState {
  activeToolName: ToolName;
  isCollapsed: boolean;
  orientation: 'vertical' | 'horizontal';
  position: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * ツールバーUI・Phase2新規実装
 * 80px幅・56pxアイコン・縦配置・ふたば色統一・2_TECHNICAL_DESIGN準拠
 */
export class Toolbar {
  private eventBus: EventBus;
  private container: HTMLElement;
  private toolbarElement: HTMLElement;
  private toolButtons: Map<ToolName, IToolButton> = new Map();
  
  // ツールバー状態管理
  private state: IToolbarState = {
    activeToolName: 'pen',     // デフォルトペンツール
    isCollapsed: false,        // 展開状態
    orientation: 'vertical',   // 縦配置
    position: 'left',          // 左配置
  };
  
  // ツールボタン定義・Phase2対応ツール
  private readonly TOOL_DEFINITIONS: IToolButton[] = [
    {
      name: 'pen',
      icon: '✏️',
      label: 'ペンツール',
      shortcut: 'P',
      category: 'drawing',
    },
    {
      name: 'brush',
      icon: '🖌️',
      label: 'ブラシツール',
      shortcut: 'B',
      category: 'drawing',
    },
    {
      name: 'eraser',
      icon: '🧽',
      label: '消しゴムツール',
      shortcut: 'E',
      category: 'editing',
    },
    {
      name: 'fill',
      icon: '🪣',
      label: '塗りつぶしツール',
      shortcut: 'F',
      category: 'drawing',
    },
    {
      name: 'shape',
      icon: '📐',
      label: '図形ツール',
      shortcut: 'S',
      category: 'drawing',
    },
  ];

  constructor(eventBus: EventBus, container: HTMLElement) {
    this.eventBus = eventBus;
    this.container = container;
    
    this.initializeToolbar();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    
    console.log('🔧 Toolbar初期化完了・80px幅・縦配置');
  }

  /**
   * ツールバー初期化・DOM構築・CSS適用
   */
  private initializeToolbar(): void {
    // ツールバーCSS注入・ふたば色統一
    this.injectToolbarCSS();
    
    // ツールバーHTML構築
    this.createToolbarHTML();
    
    // ツールボタン生成・イベント設定
    this.createToolButtons();
    
    // デフォルトツール選択
    this.selectTool('pen');
  }

  /**
   * ツールバーCSS注入・2_TECHNICAL_DESIGN準拠・ふたば色統一
   */
  private injectToolbarCSS(): void {
    const cssId = 'toolbar-styles';
    if (document.getElementById(cssId)) return;

    const style = document.createElement('style');
    style.id = cssId;
    style.textContent = `
      /* ツールバー・80px幅・縦配置・Phase2新規 */
      .drawing-toolbar {
        position: fixed;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: ${UI_CONSTANTS.TOOLBAR.WIDTH}px;
        background: ${UI_CONSTANTS.COLORS.BACKGROUND};
        border: 2px solid ${UI_CONSTANTS.COLORS.MAROON};
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
        z-index: 1000;
        user-select: none;
        font-family: 'Noto Sans JP', sans-serif;
      }
      
      /* ツールボタン・56pxアイコン・Phase2統一 */
      .tool-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${UI_CONSTANTS.TOOLBAR.WIDTH - 16}px;
        height: ${UI_CONSTANTS.TOOLBAR.ICON_SIZE + 8}px;
        margin-bottom: ${UI_CONSTANTS.TOOLBAR.BUTTON_SPACING}px;
        background: #ffffff;
        border: 2px solid #cccccc;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        font-size: ${UI_CONSTANTS.TOOLBAR.ICON_SIZE - 16}px;
      }
      
      .tool-button:last-child {
        margin-bottom: 0;
      }
      
      /* ホバー効果・視覚フィードバック */
      .tool-button:hover {
        background: #f0f8ff;
        border-color: ${UI_CONSTANTS.COLORS.NAVY};
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 128, 0.2);
      }
      
      /* アクティブ状態・ふたば色強調 */
      .tool-button.active {
        background: ${UI_CONSTANTS.COLORS.MAROON};
        color: white;
        border-color: ${UI_CONSTANTS.COLORS.MAROON};
        box-shadow: 0 2px 8px rgba(128, 0, 0, 0.4);
      }
      
      .tool-button.active:hover {
        background: #900000;
      }
      
      /* ツールチップ・ショートカット表示 */
      .tool-button::after {
        content: attr(data-tooltip);
        position: absolute;
        left: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        z-index: 1001;
      }
      
      .tool-button:hover::after {
        opacity: 1;
      }
      
      /* ショートカットキー表示 */
      .tool-shortcut {
        position: absolute;
        bottom: 2px;
        right: 4px;
        font-size: 10px;
        font-weight: bold;
        color: #666;
        background: rgba(255, 255, 255, 0.8);
        padding: 1px 3px;
        border-radius: 2px;
        line-height: 1;
      }
      
      .tool-button.active .tool-shortcut {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(0, 0, 0, 0.2);
      }
      
      /* ツールバー折りたたみボタン・Phase2後半実装予定 */
      .toolbar-toggle {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 20px;
        height: 20px;
        background: ${UI_CONSTANTS.COLORS.ACCENT};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
        font-weight: bold;
      }
      
      /* レスポンシブ・小画面対応・2.5K環境考慮 */
      @media (max-width: 768px) {
        .drawing-toolbar {
          position: fixed;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          top: auto;
          width: auto;
          display: flex;
          flex-direction: row;
          padding: 6px;
        }
        
        .tool-button {
          width: ${UI_CONSTANTS.TOOLBAR.ICON_SIZE}px;
          height: ${UI_CONSTANTS.TOOLBAR.ICON_SIZE}px;
          margin-bottom: 0;
          margin-right: ${UI_CONSTANTS.TOOLBAR.BUTTON_SPACING}px;
        }
        
        .tool-button:last-child {
          margin-right: 0;
        }
      }
      
      /* 高DPI対応・2_TECHNICAL_DESIGN準拠 */
      @media (min-resolution: 2dppx) {
        .tool-button {
          border-width: 1px;
        }
        
        .drawing-toolbar {
          border-width: 1px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * ツールバーHTML構築・DOM生成
   */
  private createToolbarHTML(): void {
    this.toolbarElement = document.createElement('div');
    this.toolbarElement.className = 'drawing-toolbar';
    this.toolbarElement.setAttribute('role', 'toolbar');
    this.toolbarElement.setAttribute('aria-label', 'Drawing Tools');
    
    this.container.appendChild(this.toolbarElement);
  }

  /**
   * ツールボタン生成・イベント設定・アクセシビリティ
   */
  private createToolButtons(): void {
    this.TOOL_DEFINITIONS.forEach((toolDef) => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.setAttribute('data-tool', toolDef.name);
      button.setAttribute('data-tooltip', `${toolDef.label} (${toolDef.shortcut})`);
      button.setAttribute('aria-label', toolDef.label);
      button.setAttribute('title', `${toolDef.label} - ショートカット: ${toolDef.shortcut}`);
      
      // アイコン・ラベル表示
      button.innerHTML = `
        ${toolDef.icon}
        <span class="tool-shortcut">${toolDef.shortcut}</span>
      `;
      
      // クリックイベント
      button.addEventListener('click', () => {
        this.selectTool(toolDef.name);
      });
      
      // ツールボタン登録
      toolDef.element = button;
      this.toolButtons.set(toolDef.name, toolDef);
      this.toolbarElement.appendChild(button);
    });
  }

  /**
   * イベントリスナー設定・EventBus連携
   */
  private setupEventListeners(): void {
    // ツール変更イベント監視
    this.eventBus.on('tool:activated', (data: IEventData['tool:activated']) => {
      this.selectTool(data.toolName as ToolName);
    });
    
    // UI更新イベント監視
    this.eventBus.on('ui:theme-changed', () => {
      // テーマ変更時の再描画・Phase3実装予定
      console.log('🔧 ツールバーテーマ更新');
    });
  }

  /**
   * キーボードショートカット設定・アクセシビリティ
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Ctrl/Cmd + Alt修飾キーは無視・他機能との競合回避
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      
      // 入力フィールドフォーカス中は無視
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.hasAttribute('contenteditable')
      )) {
        return;
      }
      
      const key = event.key.toLowerCase();
      
      // ツールショートカット処理
      for (const [toolName, toolDef] of this.toolButtons) {
        if (toolDef.shortcut.toLowerCase() === key) {
          event.preventDefault();
          this.selectTool(toolName);
          break;
        }
      }
    });
  }

  /**
   * ツール選択・アクティブ状態更新・EventBus通知
   */
  public selectTool(toolName: ToolName): void {
    // 現在のアクティブボタン非選択
    const currentActive = this.toolbarElement.querySelector('.tool-button.active');
    if (currentActive) {
      currentActive.classList.remove('active');
    }
    
    // 新しいツールボタン選択
    const toolButton = this.toolButtons.get(toolName);
    if (toolButton && toolButton.element) {
      toolButton.element.classList.add('active');
      this.state.activeToolName = toolName;
      
      // ツール変更通知・ToolManager連携
      this.eventBus.emit('toolbar:tool-selected', {
        toolName,
        timestamp: Date.now(),
        source: 'toolbar'
      });
      
      console.log(`🔧 ツール選択: ${toolName} (${toolButton.label})`);
    }
  }

  /**
   * アクティブツール取得
   */
  public getActiveToolName(): ToolName {
    return this.state.activeToolName;
  }

  /**
   * ツールバー表示切り替え・折りたたみ
   */
  public toggleVisibility(): void {
    this.state.isCollapsed = !this.state.isCollapsed;
    
    if (this.state.isCollapsed) {
      this.toolbarElement.style.transform = 'translateY(-50%) translateX(-90%)';
      this.toolbarElement.style.opacity = '0.7';
    } else {
      this.toolbarElement.style.transform = 'translateY(-50%) translateX(0)';
      this.toolbarElement.style.opacity = '1';
    }
    
    console.log(`🔧 ツールバー表示切り替え: ${this.state.isCollapsed ? '折りたたみ' : '展開'}`);
  }

  /**
   * ツールバー位置変更・レイアウト調整・Phase3実装予定
   */
  public setPosition(position: 'left' | 'right' | 'top' | 'bottom'): void {
    this.state.position = position;
    
    // 位置別CSS調整・Phase3実装予定
    console.log(`🔧 ツールバー位置変更: ${position}`);
  }

  /**
   * ツールバー状態取得・デバッグ・設定保存用
   */
  public getState(): IToolbarState {
    return { ...this.state };
  }

  /**
   * ツールバー破棄・メモリクリア
   */
  public destroy(): void {
    // イベントリスナー削除
    document.removeEventListener('keydown', this.setupKeyboardShortcuts);
    
    // DOM削除
    if (this.toolbarElement && this.toolbarElement.parentNode) {
      this.toolbarElement.parentNode.removeChild(this.toolbarElement);
    }
    
    // CSS削除
    const cssElement = document.getElementById('toolbar-styles');
    if (cssElement) {
      cssElement.remove();
    }
    
    // マップクリア
    this.toolButtons.clear();
    
    console.log('🔧 Toolbar破棄完了');
  }
}