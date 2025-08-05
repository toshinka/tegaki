// drawing-constants.ts - 描画関連定数・設計書準拠・Phase2実装
// ブラシ・ツール・キャンバス・エンジン設定

/**
 * キャンバス・描画領域定数・2.5K対応
 */
export const CANVAS = {
  // 解像度・サイズ制限
  MAX_WIDTH: 2560,
  MAX_HEIGHT: 1440,
  MIN_WIDTH: 512,
  MIN_HEIGHT: 512,
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  
  // サイズプリセット・アスペクト比
  PRESETS: [
    { name: 'A4横', width: 2480, height: 1754, ratio: 1.41 },
    { name: 'A4縦', width: 1754, height: 2480, ratio: 0.71 },
    { name: 'Full HD', width: 1920, height: 1080, ratio: 1.78 },
    { name: '2.5K', width: 2560, height: 1440, ratio: 1.78 },
    { name: '正方形', width: 1440, height: 1440, ratio: 1.0 },
    { name: 'Instagram', width: 1080, height: 1080, ratio: 1.0 },
    { name: 'Twitter', width: 1200, height: 675, ratio: 1.78 }
  ],
  
  // 背景色・デフォルト設定
  BACKGROUND_COLOR: 0xffffee, // ふたば背景
  BACKGROUND_ALPHA: 1.0,
  
  // グリッド・ガイド
  GRID_SIZE: 16,
  GRID_COLOR: 0xcccccc,
  GRID_ALPHA: 0.3,
  GUIDE_COLOR: 0x800000, // ふたばマルーン
  GUIDE_ALPHA: 0.7,
  
  // ズーム・表示制御
  MIN_ZOOM: 0.1,   // 10%
  MAX_ZOOM: 32.0,  // 3200%
  DEFAULT_ZOOM: 1.0,
  ZOOM_STEP: 0.1,
  FIT_PADDING: 40  // フィット時の余白px
} as const;

/**
 * ペンツール定数・基本描画
 */
export const PEN_TOOL = {
  // サイズ範囲・ピクセル単位
  MIN_SIZE: 1,
  MAX_SIZE: 100,
  DEFAULT_SIZE: 4,
  
  // 不透明度・0.0-1.0
  MIN_OPACITY: 0.01,
  MAX_OPACITY: 1.0,
  DEFAULT_OPACITY: 1.0,
  
  // 筆圧感度・0.0-1.0
  MIN_PRESSURE_SENSITIVITY: 0.0,
  MAX_PRESSURE_SENSITIVITY: 1.0,
  DEFAULT_PRESSURE_SENSITIVITY: 0.7,
  
  // スムージング・手ブレ軽減
  SMOOTHING_FACTOR: 0.8,
  MIN_DISTANCE: 2, // 最小描画間隔px
  
  // 描画品質
  LINE_CAP: 'round' as const,
  LINE_JOIN: 'round' as const,
  MITER_LIMIT: 10,
  
  // 色設定
  DEFAULT_COLOR: 0x000000, // 黒
  
  // パフォーマンス最適化
  MAX_POINTS_PER_STROKE: 1000,
  OPTIMIZATION_THRESHOLD: 100 // 点数がこれを超えるとスムージング適用
} as const;

/**
 * ブラシツール定数・Phase2実装・テクスチャ対応
 */
export const BRUSH_TOOL = {
  // サイズ範囲・ペンより大きめ
  MIN_SIZE: 2,
  MAX_SIZE: 200,
  DEFAULT_SIZE: 12,
  
  // 不透明度・重ね塗り表現
  MIN_OPACITY: 0.05,
  MAX_OPACITY: 1.0,
  DEFAULT_OPACITY: 0.6,
  
  // 筆圧対応・より敏感
  MIN_PRESSURE_SENSITIVITY: 0.0,
  MAX_PRESSURE_SENSITIVITY: 1.0,
  DEFAULT_PRESSURE_SENSITIVITY: 0.8,
  
  // 速度感度・動的サイズ変化
  MIN_VELOCITY_SENSITIVITY: 0.0,
  MAX_VELOCITY_SENSITIVITY: 1.0,
  DEFAULT_VELOCITY_SENSITIVITY: 0.5,
  
  // ブラシ種類・テクスチャ
  TYPES: [
    'round',     // 丸筆・基本
    'flat',      // 平筆・直線的
    'texture',   // テクスチャ筆・Phase3拡張
    'airbrush',  // エアブラシ・グラデーション
    'charcoal',  // 木炭・ざらざら感
    'watercolor' // 水彩・にじみ効果・Phase3
  ],
  
  DEFAULT_TYPE: 'round' as const,
  
  // テクスチャ設定・Phase3詳細実装
  TEXTURE_SCALE: 1.0,
  TEXTURE_ROTATION: 0,
  TEXTURE_OPACITY: 0.8,
  
  // スムージング・ペンより強め
  SMOOTHING_FACTOR: 0.9,
  MIN_DISTANCE: 1,
  
  // 色混合・ブレンド
  DEFAULT_BLEND_MODE: 'normal' as const,
  SUPPORTED_BLEND_MODES: [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'soft-light',
    'hard-light',
    'color-dodge',
    'color-burn'
  ]
} as const;

/**
 * 消しゴムツール定数・削除・透明化
 */
export const ERASER_TOOL = {
  // サイズ範囲
  MIN_SIZE: 4,
  MAX_SIZE: 300,
  DEFAULT_SIZE: 20,
  
  // 不透明度・削除強度
  MIN_OPACITY: 0.1,
  MAX_OPACITY: 1.0,
  DEFAULT_OPACITY: 1.0,
  
  // 消去モード
  MODES: [
    'hard',      // 完全削除・デフォルト
    'soft',      // 透明度削除
    'selective'  // 色選択削除・Phase3
  ],
  
  DEFAULT_MODE: 'hard' as const,
  
  // 筆圧対応・削除強度
  MIN_PRESSURE_SENSITIVITY: 0.0,
  MAX_PRESSURE_SENSITIVITY: 1.0,
  DEFAULT_PRESSURE_SENSITIVITY: 0.6,
  
  // エッジ・境界処理
  EDGE_SOFTNESS: 0.2,
  FEATHER_DISTANCE: 2,
  
  // 描画設定
  LINE_CAP: 'round' as const,
  LINE_JOIN: 'round' as const,
  
  // パフォーマンス
  MAX_POINTS_PER_STROKE: 500,
  OPTIMIZATION_THRESHOLD: 50
} as const;

/**
 * 塗りつぶしツール定数・Phase2実装・フラッドフィル
 */
export const FILL_TOOL = {
  // 色域選択・許容誤差
  MIN_TOLERANCE: 0,
  MAX_TOLERANCE: 255,
  DEFAULT_TOLERANCE: 32,
  
  // 塗りつぶしアルゴリズム
  ALGORITHMS: [
    'flood-fill',      // 基本フラッドフィル
    'boundary-fill',   // 境界塗りつぶし
    'pattern-fill',    // パターン塗り・Phase3
    'gradient-fill'    // グラデーション塗り・Phase3
  ],
  
  DEFAULT_ALGORITHM: 'flood-fill' as const,
  
  // サンプリング設定
  SAMPLE_MODES: [
    'point',           // 単点サンプリング
    'average-3x3',     // 3x3平均
    'average-5x5'      // 5x5平均・ノイズ対応
  ],
  
  DEFAULT_SAMPLE_MODE: 'point' as const,
  
  // 処理制限・パフォーマンス
  MAX_FILL_AREA: 1000000,    // 100万ピクセル制限
  BATCH_SIZE: 10000,         // バッチ処理サイズ
  MAX_PROCESSING_TIME: 5000, // 5秒タイムアウト
  
  // 連続領域判定
  CONNECTIVITY: [4, 8], // 4方向・8方向
  DEFAULT_CONNECTIVITY: 4,
  
  // アンチエイリアス・エッジ処理
  ANTI_ALIAS: true,
  EDGE_SMOOTHING: 0.5
} as const;

/**
 * 図形ツール定数・Phase2実装・基本図形
 */
export const SHAPE_TOOL = {
  // 図形種類
  TYPES: [
    'line',        // 直線
    'rectangle',   // 矩形
    'ellipse',     // 楕円
    'polygon',     // 多角形・Phase3
    'star',        // 星形・Phase3
    'arrow'        // 矢印・Phase3
  ],
  
  DEFAULT_TYPE: 'line' as const,
  
  // 線設定
  MIN_STROKE_WIDTH: 1,
  MAX_STROKE_WIDTH: 50,
  DEFAULT_STROKE_WIDTH: 2,
  
  // 塗りつぶし
  FILL_ENABLED: true,
  STROKE_ENABLED: true,
  
  // 描画モード
  DRAW_MODES: [
    'outline',     // 輪郭のみ
    'fill',        // 塗りつぶしのみ
    'both'         // 輪郭+塗りつぶし
  ],
  
  DEFAULT_DRAW_MODE: 'outline' as const,
  
  // 形状補正・スナップ
  SNAP_TO_GRID: false,
  SNAP_DISTANCE: 8,
  ANGLE_SNAP: true,
  ANGLE_SNAP_DEGREES: 15, // 15度刻み
  
  // 正確な図形
  PERFECT_SHAPES: true,    // Shift押下で正円・正方形
  ASPECT_RATIO_LOCK: false,
  
  // 多角形設定・Phase3拡張
  MIN_POLYGON_SIDES: 3,
  MAX_POLYGON_SIDES: 20,
  DEFAULT_POLYGON_SIDES: 6,
  
  // 星形設定・Phase3拡張
  MIN_STAR_POINTS: 3,
  MAX_STAR_POINTS: 20,
  DEFAULT_STAR_POINTS: 5,
  STAR_INNER_RATIO: 0.4 // 内角と外角の比率
} as const;

/**
 * レイヤー定数・Phase2実装・Container管理
 */
export const LAYER = {
  // 数量制限
  MAX_LAYERS: 20,
  MIN_LAYERS: 1,
  DEFAULT_LAYER_NAME: 'レイヤー',
  
  // 不透明度
  MIN_OPACITY: 0.0,
  MAX_OPACITY: 1.0,
  DEFAULT_OPACITY: 1.0,
  OPACITY_STEP: 0.01, // 1%刻み
  
  // ブレンドモード・PixiJS対応
  BLEND_MODES: [
    'normal',