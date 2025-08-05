import * as PIXI from 'pixi.js';

// 描画関連型定義・Phase2ツール対応・レイヤーシステム統合
export interface Point {
  x: number;
  y: number;
}

export interface Pressure {
  value: number; // 0.1-1.0範囲・参考資料準拠
  timestamp: number;
}

export type PointerType = 'mouse' | 'pen';
export type ToolType = 'pen' | 'brush' | 'eraser' | 'fill' | 'shape';
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow';

// レイヤー関連型定義・Phase2対応
export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  container: PIXI.Container;
  thumbnail?: string;
}

// ツール設定型定義・Phase2全ツール対応
export interface ToolSettings {
  // 共通設定
  size: number;
  opacity: number;
  color: number;
  
  // ペンツール設定
  smoothing?: boolean;
  pressureSensitive?: boolean;
  
  // ブラシツール設定
  texture?: string;
  pressureOpacity?: boolean;
  velocitySize?: boolean;
  
  // 消しゴムツール設定
  hardness?: number;
  
  // 塗りつぶしツール設定
  tolerance?: number;
  blendMode?: string;
  antiAlias?: boolean;
  
  // 図形ツール設定
  shapeType?: ShapeType;
  strokeColor?: number;
  fillColor?: number;
  strokeWidth?: number;
  fillEnabled?: boolean;
  cornerRadius?: number;
}

// Phase2対応・全イベントデータ型定義
export interface IEventData {
  // 基本描画イベント・Phase1継承
  'drawing:start': { 
    x: number;
    y: number;
    point: PIXI.Point; 
    pressure: number; 
    pointerType: PointerType;
    button: number;
    toolType?: ToolType;
    settings?: ToolSettings;
  };
  'drawing:move': { 
    x: number;
    y: number;
    point: PIXI.Point; 
    pressure: number; 
    velocity: number;
    toolType?: ToolType;
    settings?: ToolSettings;
  };
  'drawing:end': { 
    x: number;
    y: number;
    point: PIXI.Point;
    pressure: number;
    toolType?: ToolType;
    settings?: ToolSettings;
  };
  
  // ツールシステムイベント・Phase2拡張
  'tool:change': { 
    toolName: string; 
    previousTool: string;
    settings: ToolSettings;
  };
  'tool:pen-mode': {
    enabled: boolean;
    settings: ToolSettings;
  };
  'tool:brush-mode': {
    enabled: boolean;
    settings: ToolSettings;
  };
  'tool:eraser-mode': {
    enabled: boolean;
    settings: ToolSettings;
  };
  'tool:fill-mode': {
    enabled: boolean;
    settings: ToolSettings;
  };
  'tool:shape-mode': {
    enabled: boolean;
    settings: ToolSettings;
  };
  
  // 特殊ツールイベント・Phase2新機能
  'tool:flood-fill': {
    x: number;
    y: number;
    color: number;
    tolerance: number;
    opacity: number;
    blendMode?: string;
  };
  'tool:shape-preview': {
    action: 'update' | 'clear';
    shapeType?: ShapeType;
    data?: any;
    settings?: ToolSettings;
  };
  'tool:shape-create': {
    shapeType: ShapeType;
    data: any;
    settings: ToolSettings;
  };
  
  // UIイベント・Phase2拡張
  'ui:color-change': { 
    color: number;
    colorString: string;
    previousColor: number; 
  };
  'ui:toolbar-click': { 
    tool: string;
    timestamp: number;
  };
  'ui:tool-changed': {
    toolName: string;
    timestamp: number;
  };
  'ui:setting-change': {
    setting: string;
    value: any;
    toolName?: string;
  };
  'ui:tool-setting-change': {
    toolName: string;
    settings: Partial<ToolSettings>;
  };
  
  // レイヤーシステムイベント・Phase2新機能
  'layer:create': {
    layerId: string;
    name: string;
    position: number;
  };
  'layer:delete': {
    layerId: string;
  };
  'layer:reorder': {
    layerId: string;
    newPosition: number;
    oldPosition: number;
  };
  'layer:change': {
    layerId: string;
    container: PIXI.Graphics;
  };
  'layer:visibility-toggle': {
    layerId: string;
    visible: boolean;
  };
  'layer:opacity-change': {
    layerId: string;
    opacity: number;
  };
  'layer:blend-mode-change': {
    layerId: string;
    blendMode: PIXI.BlendModes;
  };
  
  // パフォーマンス・エラーイベント
  'performance:renderer-initialized': {
    renderer: string;
    timestamp: number;
  };
  'error:global': {
    message: string;
    filename?: string;
    lineno?: number;
    timestamp: number;
  };
  'error:promise-rejection': {
    reason: any;
    timestamp: number;
  };
  'error:tool-system': {
    toolName: string;
    error: string;
    timestamp: number;
  };
  
  // テスト・デバッグイベント
  'test:basic-function': {
    timestamp: number;
  };
}

// 描画データ型定義・Phase2対応
export interface StrokeData {
  id: string;
  toolType: ToolType;
  points: Point[];
  pressures: number[];
  timestamps: number[];
  settings: ToolSettings;
  layerId: string;
  smoothed: boolean;
}

// 図形データ型定義・Phase2新機能
export interface ShapeData {
  id: string;
  shapeType: ShapeType;
  data: any; // 図形固有のデータ（矩形なら{x,y,width,height}など）
  settings: ToolSettings;
  layerId: string;
  timestamp: number;
}

// エクスポート用データ型・Phase3準備
export interface CanvasExportData {
  width: number;
  height: number;
  layers: LayerData[];
  strokes: StrokeData[];
  shapes: ShapeData[];
  metadata: {
    version: string;
    createdAt: number;
    modifiedAt: number;
  };
}