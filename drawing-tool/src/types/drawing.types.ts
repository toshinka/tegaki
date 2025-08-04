// src/types/drawing.types.ts - 描画関連・ツール・レイヤー型定義

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

export interface IStroke {
  id: string;
  tool: DrawingTool;
  points: IPoint[];
  pressures: number[];
  settings: IDrawingSettings;
  boundingBox: IRect;
  layerId: string;
  timestamp: number;
  created?: Date;
  updated?: Date;
}

/**
 * レイヤー・キャンバス関連
 */
export interface ILayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0-1
  locked: boolean;
  blendMode: BlendMode;
  zIndex: number;
  thumbnail?: string; // base64 image
  timestamp: number;
  created?: Date;
  updated?: Date;
}

export interface ICanvas {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  backgroundColor: number;
  layers: ILayer[];
  activeLayerId: string;
  timestamp: number;
  created?: Date;
  updated?: Date;
}

/**
 * 入力・デバイス関連
 */
export type InputDevice = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'unknown';

export interface IInputEvent {
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
  timestamp: number;
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
export interface IKeyframe {
  frame: number;
  value: any;
  easing?: string;
  timestamp: number;
}

export interface IAnimation {
  id: string;
  name: string;
  duration: number; // ms
  fps: number;
  keyframes: IKeyframe[];
  loop: boolean;
  timestamp: number;
  created?: Date;
  updated?: Date;
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