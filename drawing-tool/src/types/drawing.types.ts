import * as PIXI from 'pixi.js';

// 基本的な描画関連型定義
export interface Point {
  x: number;
  y: number;
}

export interface Pressure {
  value: number; // 0.1-1.0範囲
  timestamp: number;
}

export type PointerType = 'mouse' | 'pen' | 'touch';

// EventBusで使用されるイベントデータ型定義
// ※ EventBus.tsのIEventDataと統合される必要があります
export interface IEventData {
  // 描画イベント
  'drawing:start': { 
    point: PIXI.Point; 
    pressure: number; 
    pointerType: PointerType;
    timestamp: number;
  };
  'drawing:move': { 
    point: PIXI.Point; 
    pressure: number; 
    velocity: number; 
    timestamp: number;
  };
  'drawing:end': { 
    point: PIXI.Point; 
    timestamp: number;
  };
  
  // ツールイベント
  'tool:change': { 
    toolName: string; 
    previousTool: string; 
    settings: any;
    timestamp: number;
  };
  'tool:setting-change': { 
    toolName: string; 
    setting: string; 
    value: any; 
    timestamp: number;
  };
  
  // UIイベント
  'ui:toolbar-click': { 
    toolName: string; 
    buttonElement: HTMLElement;
  };
  'ui:color-change': { 
    color: number; 
    hsv: { h: number; s: number; v: number };
  };
  'ui:size-change': { 
    size: number; 
    tool: string;
  };
  'ui:tool-activated': {
    toolName: string;
    settings: any;
    timestamp: number;
  };
  
  // 描画エンジンイベント
  'brush:stroke-start': {
    point: PIXI.Point;
    params: any;
    settings: any;
    timestamp: number;
  };
  
  // 塗りつぶしイベント
  'fill:completed': {
    point: PIXI.Point;
    fillColor: number;
    timestamp: number;
  };
  'fill:settings-changed': {
    oldSettings: any;
    newSettings: any;
    timestamp: number;
  };
  
  // 図形イベント
  'shape:preview-container-request': {
    toolName: string;
    timestamp: number;
  };
  'shape:draw-final': {
    shapeType: string;
    bounds: PIXI.Rectangle;
    settings: any;
    timestamp: number;
  };
  'shape:settings-changed': {
    oldSettings: any;
    newSettings: any;
    timestamp: number;
  };
  
  // エラーイベント
  'error:fill': {
    message: string;
    point: PIXI.Point;
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
  'error:pixi': { 
    message: string; 
    component: string; 
    timestamp: number;
  };
  
  // パフォーマンスイベント
  'performance:warning': { 
    used: number; 
    limit: number; 
    type: 'memory' | 'fps' | 'gpu'; 
    message: string;
  };
  'performance:critical': { 
    metric: string; 
    value: number; 
    threshold: number; 
    action: string;
  };
  'performance:renderer-initialized': { 
    renderer: string; 
    timestamp: number;
  };
  
  // レイヤーイベント
  'layer:create': { 
    id: string; 
    name: string; 
    index: number;
  };
  'layer:delete': { 
    id: string; 
    name: string;
  };
  'layer:reorder': { 
    id: string; 
    newIndex: number; 
    oldIndex: number;
  };
  'layer:visibility-change': { 
    id: string; 
    visible: boolean;
  };
  
  // テストイベント
  'test:basic-function': { 
    timestamp: number;
  };
}

// 描画設定関連
export interface DrawingSettings {
  tool: string;
  size: number;
  color: number;
  opacity: number;
  blendMode: PIXI.BlendModes;
}

// ストローク関連
export interface StrokePoint {
  point: PIXI.Point;
  pressure: number;
  velocity: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  settings: DrawingSettings;
  startTime: number;
  endTime: number;
}

// レイヤー関連
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  container: PIXI.Container;
  index: number;
}

// パフォーマンス関連
export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  gpuUsage: number;
  drawCalls: number;
  timestamp: number;
}