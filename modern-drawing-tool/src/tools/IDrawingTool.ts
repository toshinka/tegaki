// src/tools/IDrawingTool.ts - ツール統一インターフェース・契約定義・曖昧さ完全排除

import { type IEventData } from '../core/EventBus.js';

/**
 * 描画ツール統一インターフェース
 * 
 * Phase1基本ツール・Phase2拡張ツール共通契約
 * すべての描画ツールは本インターフェースを実装必須
 * 
 * 設計思想:
 * - ツール = 入力解釈 + プレビュー表示 + DrawingEngine委譲
 * - 状態管理 = activate/deactivate明確化
 * - イベント応答 = 3段階必須（Down→Move→Up）
 * - 設定外部化 = getSettings/updateSettings必須
 */
export interface IDrawingTool {
  // ツール基本情報・UI表示用・識別用
  readonly name: string;
  readonly icon: string; // Phase1 emoji・Phase2 SVG path
  readonly category: 'drawing' | 'editing' | 'selection' | 'transform';
  readonly description?: string; // ツールチップ用
  
  // ライフサイクル管理・明確な状態遷移
  activate(): void;    // ツール選択時・UI更新・カーソル変更
  deactivate(): void;  // ツール解除時・状態クリア・リソース解放
  
  // 入力イベント処理・3段階必須・InputManager→ToolManager→各ツール
  onPointerDown(event: IEventData['drawing:start']): void;  // 描画開始・状態設定
  onPointerMove(event: IEventData['drawing:move']): void;   // 描画継続・プレビュー更新
  onPointerUp(event: IEventData['drawing:end']): void;     // 描画確定・DrawingEngine委譲
  
  // 設定管理・UI同期・永続化準備
  getSettings(): ToolSettings;                              // 現在設定取得・UI反映用
  updateSettings(settings: Partial<ToolSettings>): void;    // 設定変更・リアルタイム反映
  
  // デバッグ・監視・状態確認（Phase1開発支援）
  getToolState?(): ToolState;                              // Optional・デバッグ用
  
  // Phase2拡張予定・現在未使用
  onKeyDown?(event: KeyboardEvent): boolean;               // ショートカット処理・戻り値=処理済み
  onKeyUp?(event: KeyboardEvent): boolean;                 // ショートカット解除
}

/**
 * ツール設定共通ベース
 * 全ツール共通設定・ツール固有設定は extends で拡張
 */
export interface ToolSettings {
  // 基本描画設定
  size: number;          // ブラシサイズ・1-100px
  opacity: number;       // 不透明度・0.1-1.0
  color?: number;        // 色・16進数・消しゴムは無色
  
  // 入力設定  
  pressureSensitive: boolean;  // 筆圧感度・ペンタブレット対応
  smoothing: boolean;          // スムージング・手ブレ軽減
  
  // 範囲制限
  minSize: number;       // 最小サイズ
  maxSize: number;       // 最大サイズ
}

/**
 * ツール状態情報・デバッグ・監視用
 */
export interface ToolState {
  isActive: boolean;     // アクティブ状態
  isDrawing: boolean;    // 描画中状態
  lastAction?: string;   // 最後のアクション・デバッグ用
  timestamp: number;     // 状態更新時刻
}

/**
 * ツール種別定義・Phase2拡張準備
 * category プロパティで使用
 */
export type ToolCategory = 'drawing' | 'editing' | 'selection' | 'transform';

/**
 * ツール作成ファクトリー関数型・Phase2実装予定
 * ToolManager での動的ツール生成用
 */
export type ToolFactory = () => IDrawingTool;

/**
 * ツール登録情報・Phase2ツール管理システム用
 */
export interface ToolRegistration {
  name: string;
  factory: ToolFactory;
  shortcut?: string;     // キーボードショートカット
  group?: string;        // ツールグループ・UI配置用
  enabled?: boolean;     // 有効/無効・Phase2機能制限用
}