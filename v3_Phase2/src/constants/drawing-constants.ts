// drawing-constants.ts - 描画関連定数・ツール設定・Phase2新規作成
// 2_TECHNICAL_DESIGN準拠・中央管理・保守性向上・型安全

import * as PIXI from 'pixi.js';

/**
 * 品質レベル・GPU Tier対応・動的調整
 */
export type QualityLevel = 'high' | 'medium' | 'low';

/**
 * 消去モード・Eraser Tool用・型安全
 */
export type EraseMode = typeof DRAWING_CONSTANTS.ERASER_TOOL.ERASE_MODES[keyof typeof DRAWING_CONSTANTS.ERASER_TOOL.ERASE_MODES];

/**
 * 塗りつぶしモード・Fill Tool用・Phase2対応
 */
export type FillMode = 'flood' | 'color-range' | 'selection' | 'gradient';

/**
 * ツール設定取得・型安全アクセス・汎用関数
 */
export function getToolDefaults(toolName: ToolName): Record<string, any> {
  switch (toolName) {
    case 'pen':
      return {
        size: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_SIZE,
        opacity: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_OPACITY,
        color: DRAWING_CONSTANTS.TOOL_COMMON.DEFAULT_COLOR,
        smoothing: DRAWING_CONSTANTS.PEN_TOOL.SMOOTHING,
      };
    case 'brush':
      return {
        size: DRAWING_CONSTANTS.BRUSH_TOOL.DEFAULT_SIZE,
        opacity: DRAWING_CONSTANTS.BRUSH_TOOL.DEFAULT_OPACITY,
        color: DRAWING_CONSTANTS.TOOL_COMMON.DEFAULT_COLOR,
        hardness: DRAWING_CONSTANTS.BRUSH_TOOL.HARDNESS,
      };
    case 'eraser':
      return {
        size: DRAWING_CONSTANTS.ERASER_TOOL.DEFAULT_SIZE,
        opacity: DRAWING_CONSTANTS.ERASER_TOOL.DEFAULT_OPACITY,
        mode: DRAWING_CONSTANTS.ERASER_TOOL.ERASE_MODES.NORMAL,
      };
    case 'fill':
      return {
        tolerance: DRAWING_CONSTANTS.FILL_TOOL.DEFAULT_TOLERANCE,
        opacity: DRAWING_CONSTANTS.FILL_TOOL.DEFAULT_OPACITY,
        color: DRAWING_CONSTANTS.TOOL_COMMON.DEFAULT_COLOR,
      };
    case 'shape':
      return {
        size: DRAWING_CONSTANTS.SHAPE_TOOL.DEFAULT_SIZE,
        fill: DRAWING_CONSTANTS.SHAPE_TOOL.DEFAULT_FILL,
        stroke: DRAWING_CONSTANTS.SHAPE_TOOL.DEFAULT_STROKE,
        shape: DRAWING_CONSTANTS.SHAPE_TOOL.SHAPES.RECTANGLE,
      };
    default:
      return {};
  }
}

/**
 * ブレンドモード名取得・UI表示用・多言語対応準備
 */
export function getBlendModeName(blendMode: PIXI.BlendModes): string {
  return DRAWING_CONSTANTS.BLEND_MODES.NAMES[blendMode] || '不明';
}

/**
 * 色値検証・範囲チェック・0x000000-0xFFFFFF
 */
export function isValidColor(color: number): boolean {
  return Number.isInteger(color) && color >= 0x000000 && color <= 0xFFFFFF;
}

/**
 * サイズ値検証・ツール別範囲チェック
 */
export function isValidSize(size: number, toolName: ToolName): boolean {
  if (!Number.isFinite(size) || size < 0) return false;
  
  switch (toolName) {
    case 'pen':
      return size >= DRAWING_CONSTANTS.PEN_TOOL.MIN_SIZE && 
             size <= DRAWING_CONSTANTS.PEN_TOOL.MAX_SIZE;
    case 'brush':
      return size >= DRAWING_CONSTANTS.BRUSH_TOOL.MIN_SIZE && 
             size <= DRAWING_CONSTANTS.BRUSH_TOOL.MAX_SIZE;
    case 'eraser':
      return size >= DRAWING_CONSTANTS.ERASER_TOOL.MIN_SIZE && 
             size <= DRAWING_CONSTANTS.ERASER_TOOL.MAX_SIZE;
    case 'shape':
      return size >= DRAWING_CONSTANTS.SHAPE_TOOL.MIN_SIZE && 
             size <= DRAWING_CONSTANTS.SHAPE_TOOL.MAX_SIZE;
    default:
      return size >= DRAWING_CONSTANTS.TOOL_COMMON.MIN_SIZE && 
             size <= DRAWING_CONSTANTS.TOOL_COMMON.MAX_SIZE;
  }
}

/**
 * 透明度値検証・0.01-1.0範囲チェック
 */
export function isValidOpacity(opacity: number): boolean {
  return Number.isFinite(opacity) && 
         opacity >= DRAWING_CONSTANTS.TOOL_COMMON.MIN_OPACITY && 
         opacity <= DRAWING_CONSTANTS.TOOL_COMMON.MAX_OPACITY;
}

/**
 * GPU Tier別品質設定取得・動的調整
 */
export function getQualitySettings(tier: 'webgpu' | 'webgl2' | 'webgl'): {
  maxTextureSize: number;
  antialias: boolean;
  samples: number;
  batchSize: number;
} {
  switch (tier) {
    case 'webgpu':
      return {
        maxTextureSize: DRAWING_CONSTANTS.QUALITY.MAX_TEXTURE_SIZE,
        antialias: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.HIGH.samples > 1,
        samples: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.HIGH.samples,
        batchSize: DRAWING_CONSTANTS.QUALITY.BATCH_SIZE,
      };
    case 'webgl2':
      return {
        maxTextureSize: DRAWING_CONSTANTS.QUALITY.MAX_TEXTURE_SIZE / 2,
        antialias: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.MEDIUM.samples > 1,
        samples: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.MEDIUM.samples,
        batchSize: DRAWING_CONSTANTS.QUALITY.BATCH_SIZE / 2,
      };
    case 'webgl':
      return {
        maxTextureSize: DRAWING_CONSTANTS.QUALITY.MAX_TEXTURE_SIZE / 4,
        antialias: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.LOW.samples > 1,
        samples: DRAWING_CONSTANTS.QUALITY.ANTIALIAS.LOW.samples,
        batchSize: DRAWING_CONSTANTS.QUALITY.BATCH_SIZE / 4,
      };
    default:
      return getQualitySettings('webgl');
  }
}

/**
 * 描画定数・ツール共通設定・中央管理
 * 2_TECHNICAL_DESIGN準拠・Phase1からの定数移行・統合管理
 */
export const DRAWING_CONSTANTS = {
  
  // ツール共通設定・基本パラメータ
  TOOL_COMMON: {
    MIN_SIZE: 1,              // 最小サイズ・1px
    MAX_SIZE: 200,            // 最大サイズ・200px
    DEFAULT_SIZE: 8,          // デフォルトサイズ・8px
    MIN_OPACITY: 0.01,        // 最小透明度・1%
    MAX_OPACITY: 1.0,         // 最大透明度・100%
    DEFAULT_OPACITY: 1.0,     // デフォルト透明度・100%
    DEFAULT_COLOR: 0x800000,  // デフォルト色・ふたばマルーン
    
    // 筆圧対応・入力感度
    PRESSURE_MIN: 0.1,        // 最小筆圧・10%
    PRESSURE_MAX: 1.0,        // 最大筆圧・100%
    PRESSURE_SENSITIVITY: 0.8, // 筆圧感度・80%
    VELOCITY_FACTOR: 0.3,     // 速度影響係数・30%
  },
  
  // ペンツール・Phase1継承・設定統合
  PEN_TOOL: {
    DEFAULT_SIZE: 4,          // ペン標準サイズ・4px
    MIN_SIZE: 1,              // ペン最小サイズ・1px
    MAX_SIZE: 50,             // ペン最大サイズ・50px
    DEFAULT_OPACITY: 1.0,     // ペン不透明度・100%
    SMOOTHING: 0.5,           // 線スムージング・50%
    STABILIZATION: 0.3,       // 手ブレ補正・30%
    MIN_DISTANCE: 2,          // 最小描画距離・2px
    
    // 描画品質・Phase1継承
    LINE_CAP: 'round' as const,     // 線端形状・丸
    LINE_JOIN: 'round' as const,    // 線結合・丸
    MITER_LIMIT: 10,          // マイター制限・10
  },
  
  // ブラシツール・Phase2新規・表現力重視
  BRUSH_TOOL: {
    DEFAULT_SIZE: 12,         // ブラシ標準サイズ・12px
    MIN_SIZE: 2,              // ブラシ最小サイズ・2px
    MAX_SIZE: 100,            // ブラシ最大サイズ・100px
    DEFAULT_OPACITY: 0.8,     // ブラシ透明度・80%
    TEXTURE_SCALE: 1.0,       // テクスチャスケール
    SCATTER: 0.0,             // 散布・0%（Phase3拡張）
    
    // 筆表現・自然な描画
    PRESSURE_SIZE_FACTOR: 0.6,      // 筆圧→サイズ係数・60%
    PRESSURE_OPACITY_FACTOR: 0.4,   // 筆圧→透明度係数・40%
    VELOCITY_SIZE_FACTOR: 0.3,      // 速度→サイズ係数・30%
    HARDNESS: 0.7,            // エッジ硬度・70%
  },
  
  // 消しゴムツール・Phase2強化
  ERASER_TOOL: {
    DEFAULT_SIZE: 16,         // 消しゴムサイズ・16px
    MIN_SIZE: 2,              // 最小サイズ・2px
    MAX_SIZE: 200,            // 最大サイズ・200px
    DEFAULT_OPACITY: 1.0,     // 消去強度・100%
    BLEND_MODE: PIXI.BlendModes.ERASE, // 消去モード
    
    // 消去モード・種類別設定
    ERASE_MODES: {
      NORMAL: 'normal',       // 通常消去
      SOFT: 'soft',           // ソフト消去
      HARD: 'hard',           // ハード消去
      ALPHA: 'alpha',         // 透明度のみ
    } as const,
    
    SOFT_EDGE_FACTOR: 0.3,    // ソフトエッジ係数・30%
  },
  
  // 塗りつぶしツール・Phase2新規・高機能
  FILL_TOOL: {
    DEFAULT_TOLERANCE: 5,     // 許容値・5%
    MIN_TOLERANCE: 0,         // 最小許容値・0%
    MAX_TOLERANCE: 100,       // 最大許容値・100%
    DEFAULT_OPACITY: 1.0,     // 塗りつぶし透明度・100%
    
    // 色域選択・HSV範囲
    DEFAULT_COLOR_RANGE: 30,  // 色相範囲・30度
    DEFAULT_SATURATION_RANGE: 20, // 彩度範囲・20%
    DEFAULT_VALUE_RANGE: 20,  // 明度範囲・20%
    
    // パフォーマンス制限
    MAX_FILL_PIXELS: 1000000, // 最大処理ピクセル・100万px
    CHUNK_SIZE: 1000,         // チャンク処理サイズ・1000px
    TIMEOUT_MS: 5000,         // タイムアウト・5秒
  },
  
  // 図形ツール・Phase2新規・基本図形
  SHAPE_TOOL: {
    DEFAULT_SIZE: 2,          // 線幅・2px
    MIN_SIZE: 1,              // 最小線幅・1px
    MAX_SIZE: 20,             // 最大線幅・20px
    DEFAULT_FILL: false,      // 塗りつぶし・無効
    DEFAULT_STROKE: true,     // 輪郭・有効
    
    // 図形種類・基本セット
    SHAPES: {
      RECTANGLE: 'rectangle', // 矩形
      ELLIPSE: 'ellipse',     // 楕円
      LINE: 'line',           // 直線
      ARROW: 'arrow',         // 矢印（Phase3拡張）
      POLYGON: 'polygon',     // 多角形（Phase3拡張）
    } as const,
    
    // 図形描画品質
    SMOOTHNESS: 32,           // 円滑度・32分割
    CORNER_RADIUS: 0,         // 角丸半径・0px（Phase3拡張）
  },
  
  // ブレンドモード・Phase2レイヤー対応
  BLEND_MODES: {
    NORMAL: PIXI.BlendModes.NORMAL,           // 通常
    MULTIPLY: PIXI.BlendModes.MULTIPLY,       // 乗算
    SCREEN: PIXI.BlendModes.SCREEN,           // スクリーン  
    OVERLAY: PIXI.BlendModes.OVERLAY,         // オーバーレイ
    DARKEN: PIXI.BlendModes.DARKEN,           // 比較(暗)
    LIGHTEN: PIXI.BlendModes.LIGHTEN,         // 比較(明)
    ADD: PIXI.BlendModes.ADD,                 // 加算
    SUBTRACT: PIXI.BlendModes.SUBTRACT,       // 減算
    ERASE: PIXI.BlendModes.ERASE,             // 消去
    
    // ブレンドモード名・UI表示用
    NAMES: {
      [PIXI.BlendModes.NORMAL]: '通常',
      [PIXI.BlendModes.MULTIPLY]: '乗算',
      [PIXI.BlendModes.SCREEN]: 'スクリーン',
      [PIXI.BlendModes.OVERLAY]: 'オーバーレイ',
      [PIXI.BlendModes.DARKEN]: '比較(暗)',
      [PIXI.BlendModes.LIGHTEN]: '比較(明)',
      [PIXI.BlendModes.ADD]: '加算',
      [PIXI.BlendModes.SUBTRACT]: '減算',
      [PIXI.BlendModes.ERASE]: '消去',
    } as const,
  },
  
  // 描画品質設定・GPU Tier対応・2_TECHNICAL_DESIGN準拠
  QUALITY: {
    // テクスチャ設定
    MAX_TEXTURE_SIZE: 2048,   // 最大テクスチャサイズ・2048px
    TEXTURE_FORMAT: 'rgba8unorm', // テクスチャフォーマット
    MIPMAP_LEVELS: 4,         // ミップマップレベル・4段階
    
    // アンチエイリアス・品質レベル別
    ANTIALIAS: {
      HIGH: { samples: 4, quality: 'high' },    // 高品質・4x MSAA
      MEDIUM: { samples: 2, quality: 'medium' }, // 中品質・2x MSAA
      LOW: { samples: 1, quality: 'low' },      // 低品質・無効
    },
    
    // バッチング・描画最適化
    BATCH_SIZE: 4096,         // バッチサイズ・4096頂点
    MAX_BATCHES: 16,          // 最大バッチ数・16
    VERTEX_BUFFER_SIZE: 65536, // 頂点バッファサイズ
  },
  
  // 色定義・ふたば色拡張・Phase1継承
  COLORS: {
    // 基本色・ふたば色準拠
    PRIMARY: 0x800000,        // マルーン・primary
    SECONDARY: 0x000080,      // ネイビー・secondary  
    ACCENT: 0xff6b35,         // アクセント・orange
    BACKGROUND: 0xffffee,     // 背景・クリーム
    
    // グレースケール
    WHITE: 0xffffff,          // 白
    LIGHT_GRAY: 0xcccccc,     // 薄灰
    GRAY: 0x808080,           // 灰
    DARK_GRAY: 0x404040,      // 濃灰
    BLACK: 0x000000,          // 黒
    
    // デフォルトパレット・よく使う色
    PALETTE: [
      0x800000, // マルーン
      0x000080, // ネイビー
      0xff6b35, // オレンジ
      0x228b22, // 緑
      0x4169e1, // ロイヤルブルー
      0x9932cc, // 紫
      0xffd700, // 金
      0xff1493, // ピンク
      0x000000, // 黒
      0xffffff, // 白
    ],
  },
  
  // 入力処理・Phase1継承・InputManager連携
  INPUT: {
    POINTER_CAPTURE_RADIUS: 10, // ポインターキャプチャ半径・10px
    DOUBLE_CLICK_TIME: 300,     // ダブルクリック判定時間・300ms
    LONG_PRESS_TIME: 500,       // 長押し判定時間・500ms
    GESTURE_THRESHOLD: 20,      // ジェスチャー閾値・20px
    
    // スムージング・手ブレ補正
    SMOOTHING_POINTS: 3,        // スムージングポイント数・3点
    STABILIZATION_RADIUS: 5,    // 手ブレ補正半径・5px
    MIN_MOVE_DISTANCE: 1,       // 最小移動距離・1px
  },
  
  // キャンバス設定・2.5K対応・2_TECHNICAL_DESIGN準拠
  CANVAS: {
    MIN_WIDTH: 64,            // 最小幅・64px
    MIN_HEIGHT: 64,           // 最小高・64px
    MAX_WIDTH: 2560,          // 最大幅・2.5K
    MAX_HEIGHT: 1440,         // 最大高・1440p
    DEFAULT_WIDTH: 1920,      // デフォルト幅・FHD
    DEFAULT_HEIGHT: 1080,     // デフォルト高・FHD
    
    // DPI対応・高解像度
    DEFAULT_DPI: 72,          // 標準DPI・72
    PRINT_DPI: 300,           // 印刷DPI・300
    PIXEL_RATIO: window.devicePixelRatio || 1, // デバイスピクセル比
  },
  
} as const;

/**
 * 描画定数型・TypeScript型安全・const assertions
 */
export type DrawingConstants = typeof DRAWING_CONSTANTS;

/**
 * ツール名・型安全・文字列リテラル型
 */
export type ToolName = 'pen' | 'brush' | 'eraser' | 'fill' | 'shape';

/**
 * ブレンドモード名・UI表示・型安全
 */
export type BlendModeName = keyof typeof DRAWING_CONSTANTS.BLEND_MODES.NAMES;

/**
 * 図形種類・型安全・Shape Tool用
 */
export type ShapeType = typeof DRAWING_CONSTANTS.SHAPE_TOOL.SHAPES[keyof typeof DRAWING_CONSTANTS.SHAPE_TOOL.SHAPES];

/**