// PenTool.ts - ペンツール・基本描画・EventBus連携強化
// Phase1確実動作・Phase2拡張準備・エラー修正

import { IEventData } from '../types/drawing.types.js';
import { EventBus } from '../core/EventBus.js';
import { DRAWING_CONSTANTS } from '../constants/drawing-constants.js';

/**
 * 描画ツール共通インターフェース
 */
export interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  getSettings(): any;
  updateSettings(settings: Partial<any>): void;
}

/**
 * ペンツール・基本描画・確実動作
 */
export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus | null = null;
  private settings = {
    size: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_SIZE,
    opacity: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_OPACITY,
    color: 0x800000, // ふたばマルーン
    smoothing: true,
    pressureSensitive: true,
    blendMode: DRAWING_CONSTANTS.BLEND_MODES.NORMAL
  };

  private isActive = false;

  /**
   * EventBus設定・依存注入対応
   */
  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * ツール有効化・カーソル変更・設定適用
   */
  public activate(): void {
    this.isActive = true;
    
    // カーソル変更・視覚フィードバック
    document.body.style.cursor = 'crosshair';
    
    // ペンツール設定をDrawingEngineに送信
    if (this.eventBus) {
      this.eventBus.emit('tool:pen-mode', {
        size: this.settings.size,
        opacity: this.settings.opacity,
        color: this.settings.color,
        blendMode: this.settings.blendMode,
        smoothing: this.settings.smoothing,
        timestamp: performance.now()
      });
    }
    
    console.log('ペンツール有効化・120Hz入力対応準備完了');
  }

  /**
   * ツール無効化・カーソル復元
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    console.log('ペンツール無効化');
  }

  /**
   * 描画開始・EventBus経由でDrawingEngineに委譲
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive || !this.eventBus) return;
    
    // DrawingEngineが実際の描画処理を担当
    // ペンツール固有の処理があれば此処に追加
    console.log(`ペンツール描画開始: (${event.x}, ${event.y}), 筆圧: ${event.pressure || 1.0}`);
  }

  /**
   * 描画移動・EventBus経由でDrawingEngineに委譲
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.eventBus) return;
    
    // ペンツール固有の処理
    // 筆圧感度がオンの場合、サイズを動的調整
    if (this.settings.pressureSensitive && event.pressure !== undefined) {
      const dynamicSize = this.settings.size * event.pressure;
      
      // リアルタイムサイズ変更をDrawingEngineに通知
      this.eventBus.emit('tool:dynamic-size', {
        size: dynamicSize,
        originalSize: this.settings.size,
        pressure: event.pressure,
        tool: this.name,
        timestamp: performance.now()
      });
    }
  }

  /**
   * 描画終了・EventBus経由でDrawingEngineに委譲
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive || !this.eventBus) return;
    
    console.log(`ペンツール描画終了: (${event.x}, ${event.y})`);
    
    // ペンツール固有の後処理があれば此処に追加
    // 例：ストローク統計、品質分析など
  }

  /**
   * 設定取得・現在の状態
   */
  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  /**
   * 設定更新・EventBus連携
   */
  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // 設定変更をDrawingEngineに通知
    if (this.eventBus && this.isActive) {
      if (newSettings.size !== undefined || 
          newSettings.opacity !== undefined || 
          newSettings.color !== undefined ||
          newSettings.blendMode !== undefined) {
        
        this.eventBus.emit('tool:pen-mode', {
          size: this.settings.size,
          opacity: this.settings.opacity,
          color: this.settings.color,
          blendMode: this.settings.blendMode,
          smoothing: this.settings.smoothing,
          timestamp: performance.now()
        });
      }
    }
    
    console.log('ペンツール設定更新:', {
      old: oldSettings,
      new: this.settings,
      changed: newSettings
    });
  }

  /**
   * ペンツール固有メソッド・筆圧感度設定
   */
  public setPressureSensitivity(enabled: boolean): void {
    this.settings.pressureSensitive = enabled;
    
    if (this.eventBus) {
      this.eventBus.emit('tool:pressure-sensitivity', {
        enabled,
        tool: this.name,
        timestamp: performance.now()
      });
    }
    
    console.log(`ペンツール筆圧感度: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * スムージング設定
   */
  public setSmoothing(enabled: boolean): void {
    this.settings.smoothing = enabled;
    
    if (this.eventBus) {
      this.eventBus.emit('drawing:settings-change', {
        smoothing: {
          enabled: enabled,
          factor: enabled ? DRAWING_CONSTANTS.PEN_TOOL.SMOOTHING_FACTOR : 0
        },
        tool: this.name,
        timestamp: performance.now()
      });
    }
    
    console.log(`ペンツールスムージング: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * ペンサイズ設定・範囲チェック付き
   */
  public setSize(size: number): void {
    const clampedSize = Math.max(
      DRAWING_CONSTANTS.PEN_TOOL.MIN_SIZE, 
      Math.min(DRAWING_CONSTANTS.PEN_TOOL.MAX_SIZE, size)
    );
    
    this.updateSettings({ size: clampedSize });
  }

  /**
   * 不透明度設定・範囲チェック付き
   */
  public setOpacity(opacity: number): void {
    const clampedOpacity = Math.max(
      DRAWING_CONSTANTS.PEN_TOOL.MIN_OPACITY, 
      Math.min(DRAWING_CONSTANTS.PEN_TOOL.MAX_OPACITY, opacity)
    );
    
    this.updateSettings({ opacity: clampedOpacity });
  }

  /**
   * 色設定・16進数対応
   */
  public setColor(color: number | string): void {
    let numericColor: number;
    
    if (typeof color === 'string') {
      // 16進数文字列を数値に変換
      numericColor = parseInt(color.replace('#', ''), 16);
    } else {
      numericColor = color;
    }
    
    this.updateSettings({ color: numericColor });
  }

  /**
   * プリセット設定適用・クイック設定
   */
  public applyPreset(presetName: string): void {
    const presets = {
      'fine': {
        size: 2,
        opacity: 1.0,
        pressureSensitive: true,
        smoothing: true
      },
      'normal': {
        size: 4,
        opacity: 0.8,
        pressureSensitive: true,
        smoothing: true
      },
      'bold': {
        size: 8,
        opacity: 1.0,
        pressureSensitive: false,
        smoothing: false
      },
      'sketch': {
        size: 3,
        opacity: 0.6,
        pressureSensitive: true,
        smoothing: true
      }
    };
    
    const preset = presets[presetName as keyof typeof presets];
    if (preset) {
      this.updateSettings(preset);
      console.log(`ペンツールプリセット適用: ${presetName}`);
    } else {
      console.warn(`未知のプリセット: ${presetName}`);
    }
  }

  /**
   * ツール情報取得・デバッグ用
   */
  public getToolInfo(): any {
    return {
      name: this.name,
      icon: this.icon,
      category: this.category,
      active: this.isActive,
      settings: this.getSettings(),
      constants: {
        minSize: DRAWING_CONSTANTS.PEN_TOOL.MIN_SIZE,
        maxSize: DRAWING_CONSTANTS.PEN_TOOL.MAX_SIZE,
        defaultSize: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_SIZE,
        minOpacity: DRAWING_CONSTANTS.PEN_TOOL.MIN_OPACITY,
        maxOpacity: DRAWING_CONSTANTS.PEN_TOOL.MAX_OPACITY
      },
      features: {
        pressureSensitive: true,
        smoothing: true,
        blendModes: true,
        realTimePreview: true
      }
    };
  }

  /**
   * 設定リセット・デフォルト値復元
   */
  public resetToDefaults(): void {
    this.settings = {
      size: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_SIZE,
      opacity: DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_OPACITY,
      color: 0x800000, // ふたばマルーン
      smoothing: true,
      pressureSensitive: true,
      blendMode: DRAWING_CONSTANTS.BLEND_MODES.NORMAL
    };
    
    // DrawingEngineに新設定送信
    if (this.eventBus && this.isActive) {
      this.eventBus.emit('tool:pen-mode', {
        ...this.settings,
        timestamp: performance.now()
      });
    }
    
    console.log('ペンツール設定リセット完了');
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    console.log('ペンツール終了処理開始...');
    
    try {
      this.deactivate();
      this.eventBus = null;
      console.log('ペンツール終了処理完了');
    } catch (error) {
      console.warn('ペンツール終了処理エラー:', error);
    }
  }
}