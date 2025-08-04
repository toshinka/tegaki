// src/types/performance.types.ts - 性能関連・監視・メトリクス型定義

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
  timestamp: number;
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
 * 環境情報・デバイス性能
 */
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
 * 性能監視・制限関連
 */
export interface IMemoryStatus {
  status: 'normal' | 'warning' | 'critical' | 'unknown';
  used: number; // MB
  limit: number; // MB
  percentage: number;
}

export interface IFrameRateStatus {
  current: number;
  target: number;
  average: number;
  min: number;
  max: number;
  stable: boolean;
}

/**
 * 設定・環境関連
 */
export interface IAppSettings {
  ui: {
    theme: 'light' | 'dark' | 'auto';
    scale: number;
    showTooltips: boolean;
    showShortcuts: boolean;
    compactMode: boolean;
    animations: boolean;
    language: string;
  };
  drawing: {
    tool: string;
    size: number;
    opacity: number;
    color: number;
    smoothing: boolean;
    pressureSensitive: boolean;
  };
  performance: IPerformanceConfig;
  rendering: IRenderSettings;
  export: {
    format: 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';
    quality: 'low' | 'medium' | 'high' | 'lossless';
    transparent: boolean;
    includeMetadata: boolean;
  };
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

/**
 * API・通信関連
 */
export interface IAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * 定数・制限値
 */
export const PERFORMANCE_CONSTANTS = {
  // メモリ制限
  MAX_MEMORY_MB: 1024,
  WARNING_MEMORY_MB: 800,
  CRITICAL_MEMORY_MB: 950,
  
  // フレームレート目標
  TARGET_FPS: 60,
  MIN_FPS: 30,
  FRAME_HISTORY_SIZE: 60,
  
  // 描画制限
  MAX_STROKES_PER_LAYER: 1000,
  MAX_POINTS_PER_STROKE: 1000,
  MAX_CANVAS_SIZE: 4096,
  MIN_CANVAS_SIZE: 256,
  
  // 監視間隔
  PERFORMANCE_CHECK_INTERVAL: 1000, // ms
  MEMORY_CHECK_INTERVAL: 5000, // ms
  
  // GPU制限
  MAX_TEXTURE_SIZE: 2048,
  MAX_DRAW_CALLS: 100,
  
  // 品質調整
  QUALITY_LEVELS: {
    LOW: { antialias: false, resolution: 0.5 },
    MEDIUM: { antialias: true, resolution: 0.75 },
    HIGH: { antialias: true, resolution: 1.0 },
    ULTRA: { antialias: true, resolution: 1.5 }
  }
} as const;

/**
 * 型ガード・ユーティリティ
 */
export function isMemoryStatus(obj: any): obj is IMemoryStatus {
  return obj && 
    typeof obj.status === 'string' &&
    ['normal', 'warning', 'critical', 'unknown'].includes(obj.status) &&
    typeof obj.used === 'number' &&
    typeof obj.limit === 'number';
}

export function isPerformanceMetrics(obj: any): obj is IPerformanceMetrics {
  return obj && 
    typeof obj.fps === 'number' &&
    typeof obj.memory === 'number' &&
    typeof obj.timestamp === 'number';
}