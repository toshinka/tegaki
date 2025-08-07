// src/tools/PenTool.ts - ペンツール基本実装・Phase1基盤

import { EventBus, IEventData } from '../core/EventBus';

export interface PenToolSettings {
  size: number;
  opacity: number;
  color: number;
  smoothing: boolean;
  pressureSensitive: boolean;
  minSize: number;
  maxSize: number;
}

export class PenTool {
  private eventBus: EventBus;
  private settings: PenToolSettings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたばmaroon
    smoothing: true,
    pressureSensitive: true,
    minSize: 1,
    maxSize: 20
  };

  private isActive = false;
  private isDrawing = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
    console.log('✏️ PenTool初期化完了');
  }

  // イベントリスナー設定
  private setupEventListeners(): void {
    this.eventBus.on('tool:change', (data) => {
      if (data.toolName === 'pen') {
        this.activate();
      } else {
        this.deactivate();
      }
    });
  }

  // ツール有効化
  public activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('✏️ ペンツール有効化');
  }

  // ツール無効化
  public deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    console.log('✏️ ペンツール無効化');
  }

  // 設定取得
  public getSettings(): PenToolSettings {
    return { ...this.settings };
  }

  // 設定更新
  public updateSettings(newSettings: Partial<PenToolSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    console.log('✏️ ペンツール設定更新:', {
      変更前: oldSettings,
      変更後: this.settings,
      差分: newSettings
    });
  }

  // サイズ設定
  public setSize(size: number): void {
    const clampedSize = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    this.updateSettings({ size: clampedSize });
  }

  // 不透明度設定
  public setOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.updateSettings({ opacity: clampedOpacity });
  }

  // 色設定
  public setColor(color: number): void {
    this.updateSettings({ color });
  }

  // ツール状態取得
  public getToolState(): {
    isActive: boolean;
    isDrawing: boolean;
    settings: PenToolSettings;
  } {
    return {
      isActive: this.isActive,
      isDrawing: this.isDrawing,
      settings: this.getSettings()
    };
  }

  // リソース解放
  public destroy(): void {
    this.deactivate();
    console.log('✅ PenTool破棄完了');
  }
}