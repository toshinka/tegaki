/**
 * Tabler Icons Helper
 * UI・UX設計仕様に基づくアイコン管理
 */
import * as TablerIcons from '@tabler/icons';

export class TablerIconHelper {
  /**
   * アイコンSVGを取得
   * @param {string} iconName - アイコン名（例: 'brush', 'palette', 'layers'）
   * @param {Object} options - オプション
   * @param {number} options.size - サイズ（デフォルト: 24）
   * @param {string} options.color - カラー（デフォルト: 'currentColor'）
   * @param {string} options.stroke - ストローク幅（デフォルト: '2'）
   * @returns {string} SVG文字列
   */
  static getIcon(iconName, options = {}) {
    const {
      size = 24,
      color = 'currentColor',
      stroke = '2'
    } = options;

    try {
      // アイコン名をキャメルケースに変換
      const iconKey = iconName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const IconComponent = TablerIcons[`Icon${iconKey.charAt(0).toUpperCase() + iconKey.slice(1)}`];
      
      if (!IconComponent) {
        console.warn(`Tabler Icon not found: ${iconName}`);
        return this.getDefaultIcon(size, color, stroke);
      }

      // SVG要素として生成
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-${iconName}">
        ${IconComponent.toString().match(/<path[^>]*>/g)?.join('') || ''}
      </svg>`;
      
      return svg;
    } catch (error) {
      console.error(`Error loading Tabler Icon: ${iconName}`, error);
      return this.getDefaultIcon(size, color, stroke);
    }
  }

  /**
   * デフォルトアイコン（何も見つからない場合）
   */
  static getDefaultIcon(size = 24, color = 'currentColor', stroke = '2') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>`;
  }

  /**
   * UI・UX仕様書で定義されたアイコンマッピング
   */
  static getUIIcon(iconType) {
    const iconMap = {
      // ツールアイコン
      'brush': 'brush',
      'pen': 'edit',
      'eraser': 'eraser',
      'bucket': 'bucket',
      'eyedropper': 'eyedropper',
      'selection': 'select',
      'zoom': 'zoom-in',
      'hand': 'hand-grab',
      
      // レイヤーアイコン
      'layer': 'layers',
      'layer-add': 'layers-difference',
      'layer-delete': 'trash',
      'layer-visible': 'eye',
      'layer-hidden': 'eye-off',
      'layer-lock': 'lock',
      'layer-unlock': 'lock-open',
      
      // ファイルアイコン
      'new': 'file-plus',
      'open': 'folder-open',
      'save': 'device-floppy',
      'export': 'download',
      'import': 'upload',
      
      // 編集アイコン
      'undo': 'arrow-back-up',
      'redo': 'arrow-forward-up',
      'copy': 'copy',
      'paste': 'clipboard',
      'cut': 'cut',
      
      // 表示アイコン
      'grid': 'grid-dots',
      'rulers': 'ruler-2',
      'fullscreen': 'arrows-maximize',
      'minimize': 'arrows-minimize',
      
      // カラーアイコン
      'palette': 'palette',
      'color-picker': 'color-picker',
      'gradient': 'color-swatch',
      
      // 設定アイコン
      'settings': 'settings',
      'help': 'help-circle',
      'info': 'info-circle',
      'close': 'x'
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
      }
      
      .tabler-icon-button {
        border: none;
        background: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .tabler-icon-button:hover {
        background-color: var(--hover-bg, rgba(0,0,0,0.1));
      }
      
      .tabler-icon-button:active {
        background-color: var(--active-bg, rgba(0,0,0,0.2));
      }
    `;
  }
}

// CSSスタイルを自動で追加
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = TablerIconHelper.generateIconCSS();
  document.head.appendChild(style);
}