/**
 * Tabler Icons Helper - CDN版
 * UI・UX設計仕様に基づくアイコン管理
 * SVGアイコンを直接管理
 */

export class TablerIconHelper {
  // Tabler Icons SVGパスのマッピング
  static iconPaths = {
    // ツールアイコン
    'brush': 'M3 12h1m8-9v1m8 8h1M5.6 5.6l.7.7m12.1-.7-.7.7M9 16a5 5 0 1 1-5-5h5a5 5 0 0 1 5 5v1H9v-1z',
    'pen': 'm4 20 10-10m0 0-4-4m4 4-4 4',
    'eraser': 'M22 11c0-.5-.5-1-1-1H3c-.5 0-1 .5-1 1s.5 1 1 1h18c.5 0 1-.5 1-1zM8 21h8',
    'bucket': 'M19 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2zM5 11V7a7 7 0 0 1 14 0v4',
    'eyedropper': 'm11 7-6 6v3a1 1 0 0 0 1 1h3l6-6-4-4zM11 7l4-4',
    'selection': 'M9 11V9a2 2 0 0 1 2-2h2M15 9V7a2 2 0 0 0-2-2h-2m0 0V3m0 2H9m6 0h2M9 11H7a2 2 0 0 0-2 2v2m0 0v2a2 2 0 0 0 2 2h2m0 0v2m0-2h2m4-4v2a2 2 0 0 1-2 2h-2',
    'zoom': 'm21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM10 8v2m0 0v2m0-2h2m-2 0H8',
    'hand': 'M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8',

    // レイヤーアイコン
    'layers': 'm12 2 8 4-8 4-8-4 8-4zm0 6L4 12l8 4 8-4-8-4zm0 6L4 18l8 4 8-4-8-4z',
    'layer-add': 'm12 2 8 4-8 4-8-4 8-4zm0 6L4 12l8 4 8-4-8-4zm0 6L4 18l8 4 8-4-8-4zm0-12v8m-4-4h8',
    'layer-delete': 'm12 2 8 4-8 4-8-4 8-4zm0 6L4 12l8 4 8-4-8-4zm0 6L4 18l8 4 8-4-8-4zM9 9l6 6m-6 0 6-6',
    'layer-visible': 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'layer-hidden': 'M9.88 9.88a3 3 0 1 0 4.24 4.24 M9.88 9.88L3.7 3.7 M9.88 9.88l4.24 4.24 M20.42 20.42L3.58 3.58 m0 0L1 1 M21 21l-1.58-1.58 M12 17c-7 0-11-8-11-8a18.498 18.498 0 0 1 5.06-5.94l6.94 6.94',
    'layer-lock': 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
    'layer-unlock': 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 9.9-.8',

    // ファイルアイコン
    'new': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 8v8m-4-4h8',
    'open': 'm2 3 6.9 6.9c.2.2.2.6 0 .8L2 17v4h4l6.9-6.9c.2-.2.6-.2.8 0L21 21',
    'save': 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M10 13l2 2 4-4',
    'export': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    'import': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',

    // 編集アイコン
    'undo': 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
    'redo': 'M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13',
    'copy': 'M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    'paste': 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M15 2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V2z',
    'cut': 'M6 6L18 18M6 18L18 6',

    // 表示アイコン
    'grid': 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    'rulers': 'M3 3h18v18h-18zM3 9h18M9 3v18',
    'fullscreen': 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M8 21h3a2 2 0 0 0 2-2v-3M21 16v3a2 2 0 0 1-2 2h-3',
    'minimize': 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M8 21v-3a2 2 0 0 0-2-2H3M21 16h-3a2 2 0 0 0-2 2v3',

    // カラーアイコン
    'palette': 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.15-.59-1.56-.36-.41-.59-.96-.59-1.56 0-1.38 1.12-2.5 2.5-2.5H16c2.21 0 4-1.79 4-4 0-4.42-3.58-8-8-8z',
    'color-picker': 'M11 7L6 2 2 6l5 5 4-4zM13 9l4 4-2 2-4-4 2-2z',
    'gradient': 'M18.71 4.04a1 1 0 0 0-1.42 0l-7.75 7.75a1 1 0 0 0 0 1.42l.71.71a1 1 0 0 0 1.42 0l7.75-7.75a1 1 0 0 0 0-1.42l-.71-.71z',

    // 設定アイコン
    'settings': 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.08a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
    'help': 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
    'info': 'M12 16v-4M12 8h.01',
    'close': 'm18 6-12 12M6 6l12 12'
  };

  /**
   * アイコンSVGを取得
   * @param {string} iconName - アイコン名
   * @param {Object} options - オプション
   * @returns {string} SVG文字列
   */
  static getIcon(iconName, options = {}) {
    const {
      size = 24,
      color = 'currentColor',
      stroke = '2',
      fill = 'none'
    } = options;

    const path = this.iconPaths[iconName];
    if (!path) {
      console.warn(`Tabler Icon not found: ${iconName}`);
      return this.getDefaultIcon(size, color, stroke);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-${iconName}">
      <path d="${path}"/>
    </svg>`;
  }

  /**
   * デフォルトアイコン（何も見つからない場合）
   */
  static getDefaultIcon(size = 24, color = 'currentColor', stroke = '2') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>`;
  }

  /**
   * UI・UX仕様書で定義されたアイコンマッピング
   */
  static getUIIcon(iconType) {
    const iconMap = {
      // ツールアイコン
      'brush': 'brush',
      'pen': 'pen',
      'eraser': 'eraser',
      'bucket': 'bucket',
      'eyedropper': 'eyedropper',
      'selection': 'selection',
      'zoom': 'zoom',
      'hand': 'hand',
      
      // レイヤーアイコン
      'layer': 'layers',
      'layer-add': 'layer-add',
      'layer-delete': 'layer-delete',
      'layer-visible': 'layer-visible',
      'layer-hidden': 'layer-hidden',
      'layer-lock': 'layer-lock',
      'layer-unlock': 'layer-unlock',
      
      // ファイルアイコン
      'new': 'new',
      'open': 'open',
      'save': 'save',
      'export': 'export',
      'import': 'import',
      
      // 編集アイコン
      'undo': 'undo',
      'redo': 'redo',
      'copy': 'copy',
      'paste': 'paste',
      'cut': 'cut',
      
      // 表示アイコン
      'grid': 'grid',
      'rulers': 'rulers',
      'fullscreen': 'fullscreen',
      'minimize': 'minimize',
      
      // カラーアイコン
      'palette': 'palette',
      'color-picker': 'color-picker',
      'gradient': 'gradient',
      
      // 設定アイコン
      'settings': 'settings',
      'help': 'help',
      'info': 'info',
      'close': 'close'
    };

    return iconMap[iconType] || iconType;
  }

  /**
   * HTML要素にアイコンを設定
   * @param {HTMLElement} element - 対象要素
   * @param {string} iconType - アイコンタイプ
   * @param {Object} options - オプション
   */
  static setElementIcon(element, iconType, options = {}) {
    const iconName = this.getUIIcon(iconType);
    const iconSVG = this.getIcon(iconName, options);
    element.innerHTML = iconSVG;
    element.classList.add('tabler-icon-container');
  }

  /**
   * CSSクラス用のアイコンスタイルを生成
   */
  static generateIconCSS() {
    return `
      .tabler-icon-container {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      .tabler-icon {
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      
      .tabler-icon-button {
        border: none;
        background: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      .tabler-icon-button:hover {
        background-color: var(--hover-bg, rgba(255,255,255,0.1));
        transform: scale(1.05);
      }
      
      .tabler-icon-button:active {
        background-color: var(--active-bg, rgba(255,255,255,0.2));
        transform: scale(0.95);
      }

      .tabler-icon-button.active {
        background-color: var(--active-bg, rgba(96, 165, 250, 0.3));
        color: var(--active-color, #60a5fa);
      }
    `;
  }

  /**
   * 利用可能なアイコン一覧を取得
   */
  static getAvailableIcons() {
    return Object.keys(this.iconPaths);
  }

  /**
   * アイコンが存在するかチェック
   */
  static hasIcon(iconName) {
    return this.iconPaths.hasOwnProperty(iconName);
  }
}

// CSSスタイルを自動で追加
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = TablerIconHelper.generateIconCSS();
  document.head.appendChild(style);
}