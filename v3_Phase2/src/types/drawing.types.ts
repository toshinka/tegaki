import * as PIXI from 'pixi.js';

// 描画関連型定義・参考資料の入力システム継承
export interface Point {
  x: number;
  y: number;
}

export interface Pressure {
  value: number; // 0.1-1.0範囲・参考資料準拠
  timestamp: number;
}

export type PointerType = 'mouse' | 'pen';

// 参考資料のIEventData型・完全継承
export interface IEventData {
  'drawing:start': { 
    point: PIXI.Point; 
    pressure: number; 
    pointerType: PointerType;
    button: number;
  };
  'drawing:move': { 
    point: PIXI.Point; 
    pressure: number; 
    velocity: number; 
  };
  'drawing:end': { 
    point: PIXI.Point; 
  };
  'tool:change': { 
    toolName: string; 
    previousTool: string; 
  };
  'ui:color-change': { 
    color: number; 
    previousColor: number; 
  };
  'ui:toolbar-click': { 
    tool: string; 
  };
}