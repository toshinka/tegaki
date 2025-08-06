// src/tools/EraserTool.ts - 消しゴムツール基本実装・Phase1簡易版

import { IDrawingTool } from './PenTool.js';
import { IEventData } from '../core/EventBus.js';

export interface EraserToolSettings {
  size: number;
  opacity: number;
  hardness: number; // Phase2実装予定・0.0-1.0
  eraseMode: 'normal' | 'soft' | 'hard'; // Phase2実装予定
  minSize: number;
  maxSize: number;
}

export class EraserTool implements IDrawingTool {
  public readonly name = 'eraser';
  public readonly icon = '🗑️'; // Phase1簡易・Phase2専用アイコン
  public readonly category = 'editing' as const;

  // 消しゴム設定・Phase2拡張準備
  private settings: EraserToolSettings = {
    size: 8, // ペンより大きめ・消しやすさ
    opacity: 1.0, // 完全消去・Phase1シンプル
    hardness: 1.0, // Phase2実装予定・完全硬度
    eraseMode: 'normal', // Phase2: normal/soft/hard
    minSize: 2,
    maxSize: 50
  };

  private isActive = false;
  private isDrawing = false;

  // ツール有効化・カーソル変更・消しゴムモード
  public activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'grab';
    console.log('🗑️ 消しゴムツール有効化');
    
    // Phase2: 消しゴム専用UI・プレビューサイズ表示予定
  }

  // ツール無効化・状態リセット
  public deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    console.log('🗑️ 消しゴムツール無効化');
  }

  // Phase1基本消しゴム・白色描画で消去表現
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    this.isDrawing = true;
    console.log(`🗑️ 消しゴム開始: ${event.pointerType}, 筆圧: ${event.pressure.toFixed(2)}`);
    
    // Phase1: 背景色(白)で上書き描画・簡易消去
    // Phase2: 真の消去・レイヤーマスク・ブレンドモード実装予定
    // DrawingEngineで背景色設定が必要
  }

  // 消去継続・状態管理
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.isDrawing) return;
    
    // DrawingEngineが処理・背景色描画
    // Phase2: 消去範囲プレビュー・リアルタイム表示
  }

  // 消去終了・状態リセット
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    if (this.isDrawing) {
      console.log('🗑️ 消しゴム終了');
      this.isDrawing = false;
    }
  }

  // 設定取得・UI同期
  public getSettings(): EraserToolSettings {
    return { ...this.settings };
  }

  // 設定更新・リアルタイム反映
  public updateSettings(newSettings: Partial<EraserToolSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    console.log('🗑️ 消しゴム設定更新:', {
      変更前: oldSettings,
      変更後: this.settings,
      差分: newSettings
    });
  }

  // サイズ設定・消去範囲・UI連携
  public setSize(size: number): void {
    const clampedSize = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    this.updateSettings({ size: clampedSize });
  }

  // 硬度設定・Phase2実装予定・エッジ柔らかさ
  public setHardness(hardness: number): void {
    const clampedHardness = Math.max(0.0, Math.min(1.0, hardness));
    this.updateSettings({ hardness: clampedHardness });
  }

  // 消去モード設定・Phase2機能
  public setEraseMode(mode: 'normal' | 'soft' | 'hard'): void {
    this.updateSettings({ eraseMode: mode });
    console.log(`🗑️ 消去モード変更: ${mode}`);
  }

  // ツール状態取得・デバッグ・UI同期
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

  // 設定リセット・デフォルト値復元
  public resetSettings(): void {
    const defaultSettings: EraserToolSettings = {
      size: 8,
      opacity: 1.0,
      hardness: 1.0,
      eraseMode: 'normal',
      minSize: 2,
      maxSize: 50
    };
    
    this.settings = { ...defaultSettings };
    console.log('🗑️ 消しゴム設定リセット');
  }

  // プリセット適用・Phase2機能・消去タイプ
  public applyPreset(presetName: string): void {
    const presets: Record<string, Partial<EraserToolSettings>> = {
      'fine': { size: 4, hardness: 1.0 },
      'normal': { size: 8, hardness: 0.8 },
      'soft': { size: 12, hardness: 0.5, eraseMode: 'soft' },
      'large': { size: 20, hardness: 0.9 }
    };
    
    const preset = presets[presetName];
    if (preset) {
      this.updateSettings(preset);
      console.log(`🗑️ 消しゴムプリセット適用: ${presetName}`);
    } else {
      console.warn(`未知の消しゴムプリセット: ${presetName}`);
    }
  }

  // Phase1制限事項・Phase2改善予定
  public getPhase1Limitations(): string[] {
    return [
      '背景色での上書き描画・真の消去ではない',
      '透明度・レイヤー対応なし',
      'アンドゥ・消去履歴なし',
      '消去プレビューなし',
      'ブレンドモード未対応'
    ];
  }

  // Phase2実装予定機能
  public getPhase2Features(): string[] {
    return [
      '真の消去・レイヤーマスク',
      'ソフト・ハード消去モード',
      '消去範囲プレビュー表示',
      '消去アニメーション',
      'アンドゥ・リドゥ対応',
      '選択範囲内消去'
    ];
  }
}