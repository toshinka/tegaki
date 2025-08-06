// src/tools/PenTool.ts - ペンツール基本実装・IDrawingTool準拠

import { IDrawingTool, type ToolSettings, type ToolState } from './IDrawingTool.js';
import { type IEventData } from '../core/EventBus.js';

export interface PenToolSettings extends ToolSettings {
  // ペン固有設定・ToolSettings 拡張
  smoothingFactor: number;  // スムージング強度・0.0-1.0
}

export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = '✏️'; // Phase1簡易・Phase2 SVG化
  public readonly category = 'drawing' as const;

  private settings: PenToolSettings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたばmaroon・4_UI_STYLE_GUIDE準拠
    smoothing: true,
    pressureSensitive: true,
    minSize: 1,
    maxSize: 20,
    smoothingFactor: 0.5  // ペン固有設定
  };

  private isActive = false;
  private isDrawing = false;

  // ツール有効化・カーソル変更・UI更新
  public activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('✏️ ペンツール有効化');
    
    // Phase2: ツール固有設定UI表示予定
  }

  // ツール無効化・状態リセット
  public deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    console.log('✏️ ペンツール無効化');
  }

  // 描画開始・DrawingEngineに委譲・状態管理のみ
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    this.isDrawing = true;
    console.log(`✏️ ペン描画開始: ${event.pointerType}, 筆圧: ${event.pressure.toFixed(2)}`);
    
    // DrawingEngineが実際の描画処理・ツールは設定管理
    // 設定はDrawingEngineのコンストラクタ、色変更イベントで反映される
  }

  // 描画継続・状態管理のみ
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.isDrawing) return;
    
    // DrawingEngineが処理・ツールは状態管理
    // ベロシティベース調整等はPhase2実装予定
  }

  // 描画終了・状態リセット
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    if (this.isDrawing) {
      console.log('✏️ ペン描画終了');
      this.isDrawing = false;
    }
  }

  // 設定取得・UI同期・永続化準備
  public getSettings(): PenToolSettings {
    return { ...this.settings };
  }

  // 設定更新・リアルタイム反映・UI連携
  public updateSettings(newSettings: Partial<PenToolSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    console.log('✏️ ペンツール設定更新:', {
      変更前: oldSettings,
      変更後: this.settings,
      差分: newSettings
    });
    
    // Phase2: 設定永続化・localStorage保存予定
  }

  // サイズ設定・UI連携・範囲チェック
  public setSize(size: number): void {
    const clampedSize = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    this.updateSettings({ size: clampedSize });
  }

  // 不透明度設定・0.1-1.0範囲
  public setOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.updateSettings({ opacity: clampedOpacity });
  }

  // 色設定・16進数・UI連携
  public setColor(color: number): void {
    this.updateSettings({ color });
  }

  // スムージング切り替え・描画品質
  public setSmoothingEnabled(enabled: boolean): void {
    this.updateSettings({ smoothing: enabled });
  }

  // 筆圧感度切り替え・ペンタブレット対応
  public setPressureSensitive(enabled: boolean): void {
    this.updateSettings({ pressureSensitive: enabled });
  }

  // ツール状態取得・デバッグ・UI同期
  public getToolState(): ToolState {
    return {
      isActive: this.isActive,
      isDrawing: this.isDrawing,
      lastAction: this.isDrawing ? 'drawing' : this.isActive ? 'active' : 'inactive',
      timestamp: performance.now()
    };
  }

  // 設定リセット・デフォルト値・初期化
  public resetSettings(): void {
    const defaultSettings: PenToolSettings = {
      size: 4,
      opacity: 0.8,
      color: 0x800000,
      smoothing: true,
      pressureSensitive: true,
      minSize: 1,
      maxSize: 20
    };
    
    this.settings = { ...defaultSettings };
    console.log('✏️ ペンツール設定リセット');
  }

  // プリセット適用・Phase2機能・設定管理
  public applyPreset(presetName: string): void {
    const presets: Record<string, Partial<PenToolSettings>> = {
      'fine': { size: 2, opacity: 0.9 },
      'normal': { size: 4, opacity: 0.8 },
      'thick': { size: 8, opacity: 0.7 },
      'marker': { size: 12, opacity: 0.6, smoothing: false }
    };
    
    const preset = presets[presetName];
    if (preset) {
      this.updateSettings(preset);
      console.log(`✏️ プリセット適用: ${presetName}`);
    } else {
      console.warn(`未知のプリセット: ${presetName}`);
    }
  }
}