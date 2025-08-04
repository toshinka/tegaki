// types/index.ts - 型定義統合・アプリケーション全体型安全性
// Phase1基盤システム・共通インターフェース定義

/**
 * 座標系・位置情報
 */
export interface IPoint {
  x: number;
  y: number;
}

export interface ISize {
  width: number;
  height: number;
}

export interface IRect extends IPoint, ISize {}

/**
 * 色・カラー情報
 */
export interface IColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1, optional alpha
}

export interface IColorHSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a?: number; // 0-1, optional alpha
}

/**
 * タイムスタンプ・時間情報
 */
export interface ITimestamp {
  timestamp: number; // performance.now()
  created?: Date;
  updated?: Date;
}

/**
 * レンダリング・描画設定
 */
export interface IRenderSettings {
  antialias: boolean;
  resolution: number;
  preserveDrawingBuffer: boolean;
  backgroundColor: number;
  transparent: boolean;
}

/**
 * 性能・パフォーマンス関連
 */
export interface IPerformanceConfig {
  targetFPS: number;
  memoryLimit: number; // MB
  enableGPUAcceleration: boolean;
  enableOptimizations: boolean;
  monitoringInterval: number; // ms
}

export interface IPerformanceMetrics {
  fps: number;
  memory: number; // MB
  cpu: number; // %
  gpu: number; // %
  drawCalls: number;
  triangles: number;
}

/**
 * 入力・デバイス関連
 */
export type InputDevice = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'unknown';

export interface IInputEvent extends ITimestamp {
  device: InputDevice;
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  button?: number;
  buttons?: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

/**
 * 描画・ツール関連
 */
export type DrawingTool = 'pen' | 'brush' | 'eraser' | 'pencil' | 'marker' | 'airbrush';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn' | 'darken' | 'lighten' | 'difference' | 'exclusion';

export interface IDrawingSettings {
  tool: DrawingTool;
  size: number; // 1-100
  opacity: number; // 0-1
  hardness: number; // 0-1
  spacing: number; // 0-1
  color: number; // hex color
  blendMode: BlendMode;
  smoothing: boolean;
  pressureSensitive: boolean;
}

export interface IStroke extends ITimestamp {
  id: string;
  tool: DrawingTool;
  points: IPoint[];
  pressures: number[];
  settings: IDrawingSettings;
  boundingBox: IRect;
  layerId: string;
}

/**
 * レイヤー・キャンバス関連
 */
export interface ILayer extends ITimestamp {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0-1
  locked: boolean;
  blendMode: BlendMode;
  zIndex: number;
  thumbnail?: string; // base64 image
}

export interface ICanvas extends ITimestamp {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  backgroundColor: number;
  layers: ILayer[];
  activeLayerId: string;
}

/**
 * UI・ユーザーインターフェース関連
 */
export type UITheme = 'light' | 'dark' | 'auto';
export type UIScale = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface IUISettings {
  theme: UITheme;
  scale: UIScale;
  showTooltips: boolean;
  showShortcuts: boolean;
  compactMode: boolean;
  animations: boolean;
  language: string;
}

export interface IToolbarConfig {
  position: 'left' | 'right' | 'top' | 'bottom';
  size: 'small' | 'medium' | 'large';
  iconOnly: boolean;
  collapsible: boolean;
  tools: DrawingTool[];
}

/**
 * エクスポート・ファイル関連
 */
export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';
export type ImageQuality = 'low' | 'medium' | 'high' | 'lossless';

export interface IExportSettings {
  format: ExportFormat;
  quality: ImageQuality;
  width?: number;
  height?: number;
  dpi?: number;
  transparent?: boolean;
  includeMetadata?: boolean;
}

/**
 * 設定・環境関連
 */
export interface IAppSettings {
  ui: IUISettings;
  drawing: IDrawingSettings;
  performance: IPerformanceConfig;
  rendering: IRenderSettings;
  export: IExportSettings;
  input: {
    pressure: {
      enabled: boolean;
      curve: number; // 0-2
      min: number; // 0-1
      max: number; // 0-1
    };
    smoothing: {
      enabled: boolean;
      factor: number; // 0-1
      samples: number; // 1-10
    };
  };
}

export interface IEnvironmentInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  webglVersion: string;
  webgpuSupported: boolean;
  memoryInfo?: {
    total: number;
    used: number;
    limit: number;
  };
}

/**
 * エラー・例外関連
 */
export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';

export interface IAppError extends ITimestamp {
  level: ErrorLevel;
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
}

/**
 * イベント・通信関連
 */
export interface IEventData extends ITimestamp {
  type: string;
  data: any;
  source?: string;
  target?: string;
}

export type EventCallback<T = any> = (data: T) => void;

export interface IEventBus {
  on<T = any>(event: string, callback: EventCallback<T>): void;
  off<T = any>(event: string, callback: EventCallback<T>): void;
  emit<T = any>(event: string, data: T): void;
  once<T = any>(event: string, callback: EventCallback<T>): void;
  clear(): void;
}

/**
 * アプリケーション状態・ライフサイクル
 */
export type AppPhase = 
  | 'loading'      // 初期読み込み中
  | 'initializing' // システム初期化中
  | 'ready'        // 初期化完了・待機中
  | 'running'      // 実行中
  | 'paused'       // 一時停止中
  | 'error'        // エラー状態
  | 'destroyed';   // 破棄済み

export interface IAppState extends ITimestamp {
  phase: AppPhase;
  isInitialized: boolean;
  isRunning: boolean;
  errorMessage?: string;
  performance: IPerformanceMetrics;
  activeCanvas?: ICanvas;
  activeLayer?: ILayer;
  currentTool: DrawingTool;
}

/**
 * API・通信関連
 */
export interface IAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface IWebGLInfo {
  version: string;
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  maxViewportDims: number[];
  maxVertexAttribs: number;
  maxVaryingVectors: number;
  maxFragmentUniforms: number;
  maxVertexUniforms: number;
  extensions: string[];
}

/**
 * キーボードショートカット関連
 */
export interface IShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
  category: string;
}

/**
 * ログ・デバッグ関連
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogEntry extends ITimestamp {
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
}

/**
 * フィルター・エフェクト関連（Phase2以降）
 */
export type FilterType = 'blur' | 'sharpen' | 'emboss' | 'edge' | 'noise' | 'pixelate';

export interface IFilter {
  type: FilterType;
  enabled: boolean;
  intensity: number; // 0-1
  parameters: Record<string, any>;
}

/**
 * アニメーション・タイムライン関連（Phase4）
 */
export interface IKeyframe extends ITimestamp {
  frame: number;
  value: any;
  easing?: string;
}

export interface IAnimation extends ITimestamp {
  id: string;
  name: string;
  duration: number; // ms
  fps: number;
  keyframes: IKeyframe[];
  loop: boolean;
}

/**
 * プラグイン・拡張関連（Phase4）
 */
export interface IPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  main: string;
  dependencies?: string[];
}

/**
 * 型ガード・ユーティリティ
 */
export function isPoint(obj: any): obj is IPoint {
  return obj && typeof obj.x === 'number' && typeof obj.y === 'number';
}

export function isColor(obj: any): obj is IColor {
  return obj && 
    typeof obj.r === 'number' && 
    typeof obj.g === 'number' && 
    typeof obj.b === 'number' &&
    obj.r >= 0 && obj.r <= 255 &&
    obj.g >= 0 && obj.g <= 255 &&
    obj.b >= 0 && obj.b <= 255;
}

export function isDrawingTool(value: any): value is DrawingTool {
  return typeof value === 'string' && 
    ['pen', 'brush', 'eraser', 'pencil', 'marker', 'airbrush'].includes(value);
}

export function isAppPhase(value: any): value is AppPhase {
  return typeof value === 'string' && 
    ['loading', 'initializing', 'ready', 'running', 'paused', 'error', 'destroyed'].includes(value);
}

/**
 * 定数・制限値
 */
export const CONSTANTS = {
  //