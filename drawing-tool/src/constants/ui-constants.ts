// ui-constants.ts - UI定数・設計書準拠・2.5K対応・ふたば色
// Phase2新規作成・レスポンシブ・アクセシビリティ

/**
 * レイヤーパネル定数・400px幅設計
 */
export const LAYER_PANEL = {
  WIDTH: 400,
  ITEM_HEIGHT: 64,
  HEADER_HEIGHT: 48,
  THUMBNAIL_SIZE: 48,
  MAX_LAYERS: 20,
  SCROLL_THRESHOLD: 320, // スクロール発生高さ
  
  // アニメーション
  DRAG_ANIMATION_DURATION: 300,
  FADE_DURATION: 200,
  SCALE_ANIMATION_DURATION: 150,
  
  // 操作感度
  DRAG_THRESHOLD: 5, // ドラッグ開始判定px
  DOUBLE_CLICK_DELAY: 300,
  
  // レスポンシブ
  MOBILE_BREAKPOINT: 500,
  MOBILE_ITEM_HEIGHT: 56,
  MOBILE_THUMBNAIL_SIZE: 40
} as const;

/**
 * ツールバー定数・80px幅設計
 */
export const TOOLBAR = {
  WIDTH: 80,
  ITEM_SIZE: 56,
  ICON_SIZE: 32,
  SPACING: 8,
  BORDER_RADIUS: 8,
  
  // グリッド配置
  COLUMNS: 1,
  ROWS_VISIBLE: 8, // スクロールなし表示可能数
  
  // アニメーション
  HOVER_SCALE: 1.1,
  ACTIVE_SCALE: 0.95,
  TRANSITION_DURATION: 200,
  
  // ツール配置順序
  TOOL_ORDER: [
    'pen',
    'brush', 
    'eraser',
    'fill',
    'shape',
    'eyedropper',
    'transform',
    'selection'
  ]
} as const;

/**
 * カラーパレット定数・200px円形設計
 */
export const COLOR_PALETTE = {
  SIZE: 200,
  CENTER_SIZE: 40, // 中央明度・彩度円
  RING_WIDTH: 80, // 色相リング幅
  MARGIN: 20,
  
  // HSV設定
  HUE_STEPS: 360,
  SATURATION_STEPS: 100,
  VALUE_STEPS: 100,
  
  // インタラクション
  POINTER_SIZE: 12,
  TOUCH_TARGET_SIZE: 44, // アクセシビリティ最小サイズ
  
  // プリセット色・ふたば調和
  PRESET_COLORS: [
    '#800000', // ふたばマルーン
    '#ffffee', // ふたば背景
    '#f0e68c', // ふたばハイライト
    '#000000', // 黒
    '#ffffff', // 白
    '#ff0000', // 赤
    '#00ff00', // 緑
    '#0000ff', // 青
    '#ffff00', // 黄
    '#ff00ff', // マゼンタ
    '#00ffff', // シアン
    '#808080'  // グレー
  ],
  
  // 最近使用色
  RECENT_COLORS_MAX: 16,
  RECENT_COLORS_SIZE: 24
} as const;

/**
 * ダイアログ・モーダル定数
 */
export const DIALOG = {
  MIN_WIDTH: 320,
  MAX_WIDTH: 600,
  MIN_HEIGHT: 200,
  MAX_HEIGHT: 800,
  
  // 背景オーバーレイ
  OVERLAY_OPACITY: 0.7,
  OVERLAY_COLOR: 'rgba(128, 0, 0, 0.7)', // ふたばマルーン半透明
  
  // アニメーション
  FADE_IN_DURATION: 250,
  SLIDE_DISTANCE: 20,
  
  // Z-index階層
  OVERLAY_Z_INDEX: 1000,
  MODAL_Z_INDEX: 1001
} as const;

/**
 * フォント・テキスト定数・ふたば調和
 */
export const TYPOGRAPHY = {
  FONT_FAMILY: "'MS PGothic', 'MS Gothic', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', monospace",
  
  // フォントサイズ
  SIZE_SMALL: 11,
  SIZE_NORMAL: 14,
  SIZE_MEDIUM: 16,
  SIZE_LARGE: 18,
  SIZE_XLARGE: 24,
  
  // 行間
  LINE_HEIGHT_TIGHT: 1.2,
  LINE_HEIGHT_NORMAL: 1.4,
  LINE_HEIGHT_LOOSE: 1.6,
  
  // 文字間隔
  LETTER_SPACING_TIGHT: '-0.025em',
  LETTER_SPACING_NORMAL: '0',
  LETTER_SPACING_LOOSE: '0.025em'
} as const;

/**
 * ふたば色定数・メインカラーパレット
 */
export const FUTABA_COLORS = {
  // 基本色
  MAROON: '#800000',      // ふたばマルーン・メイン
  BACKGROUND: '#ffffee',  // ふたば背景・クリーム
  HIGHLIGHT: '#f0e68c',   // ふたばハイライト・カーキ
  
  // バリエーション
  MAROON_LIGHT: '#a00000',
  MAROON_DARK: '#600000',
  BACKGROUND_LIGHT: '#fffff8',
  BACKGROUND_DARK: '#f5f5dc',
  
  // 状態色
  SUCCESS: '#228b22',     // フォレストグリーン
  WARNING: '#ff8c00',     // ダークオレンジ
  ERROR: '#dc143c',       // クリムゾン
  INFO: '#4682b4',        // スチールブルー
  
  // グレースケール
  WHITE: '#ffffff',
  LIGHT_GRAY: '#f5f5f5',
  GRAY: '#cccccc',
  DARK_GRAY: '#666666',
  BLACK: '#000000',
  
  // 透明度バリエーション
  MAROON_ALPHA_10: 'rgba(128, 0, 0, 0.1)',
  MAROON_ALPHA_20: 'rgba(128, 0, 0, 0.2)',
  MAROON_ALPHA_30: 'rgba(128, 0, 0, 0.3)',
  MAROON_ALPHA_50: 'rgba(128, 0, 0, 0.5)',
  MAROON_ALPHA_70: 'rgba(128, 0, 0, 0.7)',
  MAROON_ALPHA_90: 'rgba(128, 0, 0, 0.9)'
} as const;

/**
 * レイアウト・スペーシング定数・2.5K対応
 */
export const LAYOUT = {
  // キャンバス・メイン表示領域
  CANVAS_MAX_WIDTH: 2560,
  CANVAS_MAX_HEIGHT: 1440,
  CANVAS_MIN_WIDTH: 800,
  CANVAS_MIN_HEIGHT: 600,
  
  // パネル配置・固定サイズ
  LEFT_PANEL_WIDTH: TOOLBAR.WIDTH,
  RIGHT_PANEL_WIDTH: LAYER_PANEL.WIDTH,
  BOTTOM_PANEL_HEIGHT: 120,
  TOP_PANEL_HEIGHT: 60,
  
  // スペーシング・8px基準
  SPACING_XS: 4,
  SPACING_SM: 8,
  SPACING_MD: 16,
  SPACING_LG: 24,
  SPACING_XL: 32,
  SPACING_XXL: 48,
  
  // ボーダー・角丸
  BORDER_WIDTH_THIN: 1,
  BORDER_WIDTH_NORMAL: 2,
  BORDER_WIDTH_THICK: 3,
  
  BORDER_RADIUS_SM: 4,
  BORDER_RADIUS_MD: 6,
  BORDER_RADIUS_LG: 8,
  BORDER_RADIUS_XL: 12,
  
  // シャドウ・エレベーション
  SHADOW_SM: '0 1px 2px rgba(128, 0, 0, 0.1)',
  SHADOW_MD: '0 2px 4px rgba(128, 0, 0, 0.2)',
  SHADOW_LG: '0 4px 8px rgba(128, 0, 0, 0.3)',
  SHADOW_XL: '0 8px 16px rgba(128, 0, 0, 0.4)'
} as const;

/**
 * アニメーション・トランジション定数
 */
export const ANIMATION = {
  // 基本的な持続時間
  DURATION_FAST: 150,
  DURATION_NORMAL: 250,
  DURATION_SLOW: 400,
  DURATION_EXTRA_SLOW: 600,
  
  // イージング関数
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  EASE_BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  
  // 特殊効果
  HOVER_LIFT: 'translateY(-2px)',
  ACTIVE_PRESS: 'translateY(1px)',
  SCALE_HOVER: 'scale(1.05)',
  SCALE_ACTIVE: 'scale(0.95)',
  
  // 回転・スピン
  ROTATE_45: 'rotate(45deg)',
  ROTATE_90: 'rotate(90deg)',
  ROTATE_180: 'rotate(180deg)',
  SPIN: 'rotate(360deg)'
} as const;

/**
 * Z-index階層定数・重なり順序管理
 */
export const Z_INDEX = {
  // 基本レイヤー
  BASE: 0,
  CANVAS: 1,
  UI_PANELS: 10,
  TOOLBAR: 11,
  LAYER_PANEL: 12,
  COLOR_PALETTE: 13,
  
  // インタラクション
  DROPDOWN: 100,
  TOOLTIP: 200,
  
  // オーバーレイ・モーダル
  MODAL_OVERLAY: 1000,
  MODAL: 1001,
  LOADING_OVERLAY: 1002,
  
  // システム・最上位
  TOAST: 2000,
  DEBUG_PANEL: 9999
} as const;

/**
 * ブレークポイント定数・レスポンシブ
 */
export const BREAKPOINTS = {
  // 画面サイズ基準
  MOBILE_MAX: 767,
  TABLET_MIN: 768,
  TABLET_MAX: 1023,
  DESKTOP_MIN: 1024,
  DESKTOP_MAX: 1439,
  LARGE_DESKTOP_MIN: 1440,
  
  // 2.5K対応・特殊サイズ
  QHD_MIN: 2560, // 2560x1440
  UHD_MIN: 3840, // 4K
  
  // キャンバス特化
  CANVAS_SMALL: 800,  // 最小キャンバス
  CANVAS_MEDIUM: 1200,
  CANVAS_LARGE: 1920,
  CANVAS_XLARGE: 2560, // 2.5K対応
  
  // タッチデバイス考慮
  TOUCH_TARGET_MIN: 44, // アクセシビリティ基準
  FINGER_FRIENDLY_MIN: 48
} as const;

/**
 * パフォーマンス・制約定数
 */
export const PERFORMANCE = {
  // UI更新頻度制限・60FPS維持
  ANIMATION_FRAME_TARGET: 16.67, // 60FPS = 16.67ms/frame
  THROTTLE_SCROLL: 16,
  THROTTLE_RESIZE: 100,
  THROTTLE_INPUT: 8,
  
  // DOM操作最適化
  BATCH_UPDATE_SIZE: 50,
  VIRTUAL_LIST_THRESHOLD: 100,
  
  // レンダリング制約
  MAX_SHADOW_ELEMENTS: 20,
  MAX_BLUR_ELEMENTS: 10,
  MAX_GRADIENT_ELEMENTS: 30
} as const;

/**
 * アクセシビリティ定数・WCAG準拠
 */
export const A11Y = {
  // コントラスト比・WCAG AA準拠
  CONTRAST_RATIO_AA: 4.5,
  CONTRAST_RATIO_AAA: 7.0,
  
  // フォーカス表示
  FOCUS_OUTLINE_WIDTH: 2,
  FOCUS_OUTLINE_COLOR: FUTABA_COLORS.INFO,
  FOCUS_OUTLINE_OFFSET: 2,
  
  // 操作ターゲットサイズ
  MIN_TOUCH_TARGET: 44,
  RECOMMENDED_TOUCH_TARGET: 48,
  
  // タイミング
  FOCUS_DELAY: 100,
  ANNOUNCEMENT_DELAY: 500,
  
  // 動き制御
  PREFERS_REDUCED_MOTION: '@media (prefers-reduced-motion: reduce)',
  PREFERS_HIGH_CONTRAST: '@media (prefers-contrast: high)'
} as const;

/**
 * デバッグ・開発用定数
 */
export const DEBUG = {
  // ログレベル
  LOG_LEVEL_ERROR: 0,
  LOG_LEVEL_WARN: 1,
  LOG_LEVEL_INFO: 2,
  LOG_LEVEL_DEBUG: 3,
  
  // パフォーマンス監視
  PERFORMANCE_MARK_PREFIX: 'tegaki-',
  FPS_SAMPLE_SIZE: 60,
  MEMORY_CHECK_INTERVAL: 5000,
  
  // UI デバッグ
  SHOW_LAYOUT_GRID: false,
  SHOW_COMPONENT_BOUNDS: false,
  HIGHLIGHT_FOCUS: true,
  
  // コンソール色分け
  CONSOLE_COLORS: {
    ERROR: '#dc143c',
    WARN: '#ff8c00', 
    INFO: '#4682b4',
    DEBUG: '#228b22',
    PERFORMANCE: '#800000'
  }
} as const;

/**
 * エクスポート・ユーティリティ関数
 */
export const UI_UTILS = {
  /**
   * レスポンシブサイズ計算
   */
  getResponsiveSize: (baseSize: number, screenWidth: number): number => {
    if (screenWidth <= BREAKPOINTS.MOBILE_MAX) {
      return Math.max(baseSize * 0.8, BREAKPOINTS.TOUCH_TARGET_MIN);
    }
    if (screenWidth >= BREAKPOINTS.LARGE_DESKTOP_MIN) {
      return baseSize * 1.2;
    }
    return baseSize;
  },
  
  /**
   * DPR対応サイズ
   */
  getDPRSize: (size: number, dpr: number = window.devicePixelRatio || 1): number => {
    return Math.round(size * dpr) / dpr;
  },
  
  /**
   * 安全な色コード取得
   */
  getSafeColor: (color: string, fallback: string = FUTABA_COLORS.MAROON): string => {
    return CSS.supports('color', color) ? color : fallback;
  },
  
  /**
   * アニメーション制御・ユーザー設定考慮
   */
  shouldAnimate: (): boolean => {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
} as const;