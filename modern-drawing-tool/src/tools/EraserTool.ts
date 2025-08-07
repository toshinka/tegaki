// src/tools/EraserTool.ts - 消しゴムツール基本実装・Phase1基盤

import { EventBus, IEventData } from '../core/EventBus';

export interface EraserToolSettings {
  size: number;
  opacity: number;
  hardness: number;
  eraseMode: 'normal' | 'soft' | 'hard';
  minSize: number;
  maxSize: number;
}

export class EraserTool {
  private eventBus: EventBus;
  private settings: EraserToolSettings = {
    size: 8, // ペンより大きめ
    opacity: 1.0, // 完全消去
    hardness: 1.0,
    eraseMode: 'normal',
    minSize: 2,
    maxSize: 50
  };

  private isActive = false;
  private isDrawing = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
    console.log('🗑️ EraserTool初期化完了');
  }

  // イベントリスナー設定
  private setupEventListeners(): void {
    this.eventBus.on('tool:change', (data) => {
      if (data.toolName === 'eraser') {
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
    document.body.style.cursor = 'grab';
    console.log('🗑️ 消しゴムツール有効化');
  }

  // ツール無効化
  public deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    console.log('🗑️ 消しゴムツール無効化');
  }

  // 設定取得
  public getSettings(): EraserToolSettings {
    return { ...this.settings };
  }

  // 設定更新
  public updateSettings(newSettings: Partial<EraserToolSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    console.log('🗑️ 消しゴム設定更新:', {
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

  // ツール状態取得
  public getToolState(): {
    isActive: boolean;
    isDrawing: boolean;
    settings: EraserToolSettings;
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
    console.log('✅ EraserTool破棄完了');
  }
}