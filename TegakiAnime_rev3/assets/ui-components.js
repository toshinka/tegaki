/**
 * ============================================================================
 * ファイル名: ui-components.js
 * 責務: 共通UIコンポーネント・SVGアイコン・色定数の統一管理
 * 依存: なし（完全独立）
 * 親依存:
 *   - layer-panel.js → このファイルを参照
 *   - timeline-panel.js → このファイルを参照
 *   - settings-popup.js → このファイルを参照
 *   - popup-manager.js → このファイルを参照
 * 公開API:
 *   - UI_COLORS: 色定数オブジェクト
 *   - SVG_ICONS: 全SVGアイコンマップ
 *   - createSlider(options): スライダーHTML生成
 *   - createButton(options): ボタンHTML生成
 *   - createSwitch(options): スイッチHTML生成
 *   - createDeleteButton(options): 削除ボタン生成
 *   - createPopup(options): ポップアップパネル生成
 * グローバル登録: window.UIComponents
 * 実装状態: 🆕新規
 * ============================================================================
 */

'use strict';

window.UIComponents = (() => {
  
  // ========================================
  // 色定数（futabaカラー統一）
  // ========================================
  const UI_COLORS = {
    maroon: '#800000',           // アクティブペンカラー（デフォルト）
    lightMaroon: '#9c3836',      // ホバー状態
    medium: '#b8706b',           // ボーダー・非アクティブ
    lightMedium: '#d4a8a1',      // パネル背景
    cream: '#f0e0d6',            // キャンバス背景（レイヤー0デフォルト）
    background: '#ffffee',       // ページ背景
    activeSlider: '#800000',     // スライダーアクティブ
    inactiveSlider: '#cf9c97',   // スライダー非アクティブ
    dangerRed: '#d32f2f',        // 削除ボタン
    activeBorder: '#ff8c42',     // アクティブ枠線
    textPrimary: '#2c1810',      // メインテキスト
    textSecondary: '#5d4037',    // サブテキスト
    textInverse: '#ffffff'       // 反転テキスト
  };

  // ========================================
  // SVGアイコン（lucide-static互換）
  // ========================================
  const SVG_ICONS = {
    sprout: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M7 20h10"/>
      <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/>
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
    </svg>`,
    
    layers: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>`,
    
    folder: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
    </svg>`,
    
    folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
    </svg>`,
    
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>`,
    
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,
    
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>`,
    
    lock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`,
    
    unlock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>`,
    
    play: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,
    
    pause: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="4" height="16" x="6" y="4"/>
      <rect width="4" height="16" x="14" y="4"/>
    </svg>`,
    
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,
    
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" x2="12" y1="15" y2="3"/>
    </svg>`,
    
    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" x2="12" y1="5" y2="19"/>
      <line x1="5" x2="19" y1="12" y2="12"/>
    </svg>`,
    
    minus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="5" x2="19" y1="12" y2="12"/>
    </svg>`,
    
    x: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" x2="6" y1="6" y2="18"/>
      <line x1="6" x2="18" y1="6" y2="18"/>
    </svg>`,

    chevronLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`,

    chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`,

    image: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>`,

    film: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/>
      <line x1="7" x2="7" y1="2" y2="22"/>
      <line x1="17" x2="17" y1="2" y2="22"/>
      <line x1="2" x2="22" y1="12" y2="12"/>
      <line x1="2" x2="7" y1="7" y2="7"/>
      <line x1="2" x2="7" y1="17" y2="17"/>
      <line x1="17" x2="22" y1="17" y2="17"/>
      <line x1="17" x2="22" y1="7" y2="7"/>
    </svg>`
  };

  // ========================================
  // スライダー生成
  // ========================================
  /**
   * スライダーコンポーネント生成
   * @param {Object} options - オプション
   * @param {number} options.min - 最小値
   * @param {number} options.max - 最大値
   * @param {number} options.value - 現在値
   * @param {number} options.step - ステップ値
   * @param {string} options.label - ラベル
   * @param {Function} options.onChange - 変更時コールバック
   * @param {string} options.id - DOM ID
   * @returns {string} HTML文字列
   */
  function createSlider(options = {}) {
    const {
      min = 0,
      max = 100,
      value = 50,
      step = 1,
      label = '',
      onChange = () => {},
      id = `slider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    } = options;

    return `
      <div class="ui-slider-container">
        ${label ? `<label for="${id}" class="ui-slider-label">${label}</label>` : ''}
        <div class="ui-slider-wrapper">
          <div class="ui-slider" data-slider-id="${id}">
            <div class="ui-slider-track" style="width: ${((value - min) / (max - min)) * 100}%"></div>
            <div class="ui-slider-handle" style="left: ${((value - min) / (max - min)) * 100}%"></div>
          </div>
          <span class="ui-slider-value">${value}</span>
        </div>
        <input type="hidden" id="${id}" value="${value}" data-min="${min}" data-max="${max}" data-step="${step}">
      </div>
    `;
  }

  // ========================================
  // ボタン生成
  // ========================================
  /**
   * ボタンコンポーネント生成
   * @param {Object} options - オプション
   * @param {string} options.text - ボタンテキスト
   * @param {string} options.icon - アイコン名（SVG_ICONSのキー）
   * @param {Function} options.onClick - クリック時コールバック
   * @param {string} options.variant - スタイル（primary, secondary, danger）
   * @param {string} options.id - DOM ID
   * @returns {string} HTML文字列
   */
  function createButton(options = {}) {
    const {
      text = 'Button',
      icon = null,
      onClick = () => {},
      variant = 'primary',
      id = `btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    } = options;

    return `
      <button 
        id="${id}"
        class="ui-button ui-button-${variant}"
      >
        ${icon && SVG_ICONS[icon] ? SVG_ICONS[icon] : ''}
        <span>${text}</span>
      </button>
    `;
  }

  // ========================================
  // スイッチ生成
  // ========================================
  /**
   * スイッチコンポーネント生成
   * @param {Object} options - オプション
   * @param {string} options.label - ラベル
   * @param {boolean} options.checked - チェック状態
   * @param {Function} options.onChange - 変更時コールバック
   * @param {string} options.id - DOM ID
   * @returns {string} HTML文字列
   */
  function createSwitch(options = {}) {
    const {
      label = '',
      checked = false,
      onChange = () => {},
      id = `switch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    } = options;

    return `
      <div class="ui-switch-container">
        ${label ? `<label for="${id}" class="ui-switch-label">${label}</label>` : ''}
        <label class="ui-switch">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
          <span class="ui-switch-slider"></span>
        </label>
      </div>
    `;
  }

  // ========================================
  // 削除ボタン生成
  // ========================================
  /**
   * 削除ボタン生成
   * @param {Object} options - オプション
   * @param {Function} options.onClick - クリック時コールバック
   * @param {string} options.id - DOM ID
   * @returns {string} HTML文字列
   */
  function createDeleteButton(options = {}) {
    const {
      onClick = () => {},
      id = `del-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    } = options;

    return `
      <button 
        id="${id}"
        class="ui-delete-button"
        title="削除"
      >
        ${SVG_ICONS.trash}
      </button>
    `;
  }

  // ========================================
  // ポップアップパネル生成
  // ========================================
  /**
   * ポップアップパネル生成
   * @param {Object} options - オプション
   * @param {string} options.id - DOM ID
   * @param {string} options.title - タイトル（非表示だがドラッグ用に内部使用）
   * @param {string} options.content - 内容HTML
   * @param {number} options.width - 幅（px）
   * @param {number} options.height - 高さ（px、省略可）
   * @param {Object} options.position - 位置 { x, y }（省略可）
   * @param {boolean} options.draggable - ドラッグ可能か
   * @param {boolean} options.closeButton - 閉じるボタン表示
   * @returns {string} HTML文字列
   */
  function createPopup(options = {}) {
    const {
      id = `popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title = '',
      content = '',
      width = 320,
      height = null,
      position = null,
      draggable = true,
      closeButton = true
    } = options;

    const style = [];
    if (width) style.push(`width: ${width}px`);
    if (height) style.push(`height: ${height}px`);
    if (position) {
      style.push(`left: ${position.x}px`);
      style.push(`top: ${position.y}px`);
    }

    return `
      <div id="${id}" class="ui-popup" style="${style.join('; ')}">
        ${draggable ? `<div class="ui-popup-header" data-draggable="true">${title || '···'}</div>` : ''}
        ${closeButton ? `<button class="ui-popup-close">${SVG_ICONS.x}</button>` : ''}
        <div class="ui-popup-content">
          ${content}
        </div>
      </div>
    `;
  }

  // ========================================
  // スライダーイベント初期化
  // ========================================
  /**
   * スライダーのインタラクションを初期化
   * @param {HTMLElement} container - スライダーコンテナ要素
   * @param {Function} onChange - 値変更時コールバック
   */
  function initSlider(container, onChange) {
    const sliderEl = container.querySelector('.ui-slider');
    const track = container.querySelector('.ui-slider-track');
    const handle = container.querySelector('.ui-slider-handle');
    const valueDisplay = container.querySelector('.ui-slider-value');
    const hiddenInput = container.querySelector('input[type="hidden"]');

    if (!sliderEl || !track || !handle || !valueDisplay || !hiddenInput) {
      console.error('[UIComponents] Slider elements not found');
      return;
    }

    const min = parseFloat(hiddenInput.dataset.min);
    const max = parseFloat(hiddenInput.dataset.max);
    const step = parseFloat(hiddenInput.dataset.step);

    let isDragging = false;

    const updateValue = (clientX) => {
      const rect = sliderEl.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let rawValue = min + percent * (max - min);
      rawValue = Math.round(rawValue / step) * step;
      const value = Math.max(min, Math.min(max, rawValue));

      hiddenInput.value = value;
      valueDisplay.textContent = value;
      track.style.width = `${((value - min) / (max - min)) * 100}%`;
      handle.style.left = `${((value - min) / (max - min)) * 100}%`;

      if (onChange) onChange(value);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      updateValue(e.clientX);
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handle.style.cursor = 'grab';
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      handle.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    sliderEl.addEventListener('click', (e) => {
      if (e.target === handle) return;
      updateValue(e.clientX);
    });
  }

  // 公開API
  return {
    UI_COLORS,
    SVG_ICONS,
    createSlider,
    createButton,
    createSwitch,
    createDeleteButton,
    createPopup,
    initSlider
  };
})();

console.log('✅ UIComponents initialized');