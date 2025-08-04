// src/types/ui.types.ts - UI関連・イベント・状態型定義

import { DrawingTool } from './drawing.types.js';

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
 * イベント・通信関連
 */
export interface IEventData {
  type: string;
  data: any;
  source?: string;
  target?: string;
  timestamp: number;
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

export interface IAppState {
  phase: AppPhase;
  isInitialized: boolean;
  isRunning: boolean;
  errorMessage?: string;
  currentTool: DrawingTool;
  timestamp: number;
  created?: Date;
  updated?: Date;
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

export interface ILogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
  timestamp: number;
}

/**
 * エラー・例外関連
 */
export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';

export interface IAppError {
  level: ErrorLevel;
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  timestamp: number;
  created?: Date;
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
export function isAppPhase(value: any): value is AppPhase {
  return typeof value === 'string' && 
    ['loading', 'initializing', 'ready', 'running', 'paused', 'error', 'destroyed'].includes(value);
}