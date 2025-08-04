// ToolManager.ts - Phase1基本ツール管理・ペン/消しゴム
// 段階的実装・ふたば色UI・筆圧対応準備

import type { EventBus } from '../core/EventBus.js';

/**
 * ツール種別・Phase1基本セット
 */
export type ToolType = 'pen' | 'eraser' | 'bucket' | 'eyedropper';

/**
 * ツール設定・共通インターフェース
 */
export interface IToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  size: number;
  opacity: number;
  color: number;
  pressure: boolean;
  smoothing: number;
}

/**
 * 基本ツール抽象クラス
 */
abstract class BaseTool {
  protected config: IToolConfig;
  protected eventBus: EventBus;
  protected isActive = false;

  constructor(config: IToolConfig, eventBus: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
  }

  /**
   * ツール有効化
   */
  public activate(): void {
    this.isActive = true;
    this.onActivate();
  }

  /**
   * ツール無効化
   */
  public deactivate(): void {
    this.isActive = false;
    this.onDeactivate();
  }

  /**
   * 設定更新
   */
  public updateConfig(updates: Partial<IToolConfig>): void {
    this.config = { ...this.config, ...updates };
    this.onConfigUpdate();
  }

  /**
   * ツール情報取得
   */
  public getConfig(): IToolConfig {
    return { ...this.config };
  }

  /**
   * アクティブ状態確認
   */
  public getIsActive(): boolean {
    return this.isActive;
  }

  // 抽象メソッド・各ツール実装
  protected abstract onActivate(): void;
  protected abstract onDeactivate(): void;
  protected abstract onConfigUpdate(): void;

  /**
   * 描画開始処理
   */
  public abstract onDrawStart(x: number, y: number, pressure?: number): void;

  /**
   * 描画中処理
   */
  public abstract onDrawMove(x: number, y: number, pressure?: number): void;

  /**
   * 描画終了処理
   */
  public abstract onDrawEnd(): void;
}

/**
 * ペンツール・基本描画
 */
class PenTool extends BaseTool {
  private isDrawing = false;

  protected onActivate(): void {
    this.eventBus.emit('tool:activated', { 
      tool: 'pen', 
      config: this.config,
      timestamp: Date.now()
    });
    console.log('✏️ ペンツール有効化');
  }

  protected onDeactivate(): void {
    this.isDrawing = false;
    this.eventBus.emit('tool:deactivated', { 
      tool: 'pen',
      timestamp: Date.now()
    });
  }

  protected onConfigUpdate(): void {
    this.eventBus.emit('tool:config-updated', {
      tool: 'pen',
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawStart(x: number, y: number, pressure = 1.0): void {
    if (!this.isActive) return;

    this.isDrawing = true;
    
    this.eventBus.emit('drawing:stroke-start', {
      tool: 'pen',
      x, y, pressure,
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawMove(x: number, y: number, pressure = 1.0): void {
    if (!this.isActive || !this.isDrawing) return;

    this.eventBus.emit('drawing:stroke-move', {
      tool: 'pen',
      x, y, pressure,
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawEnd(): void {
    if (!this.isActive || !this.isDrawing) return;

    this.isDrawing = false;
    
    this.eventBus.emit('drawing:stroke-end', {
      tool: 'pen',
      timestamp: Date.now()
    });
  }
}

/**
 * 消しゴムツール・基本削除
 */
class EraserTool extends BaseTool {
  private isErasing = false;

  protected onActivate(): void {
    this.eventBus.emit('tool:activated', { 
      tool: 'eraser', 
      config: this.config,
      timestamp: Date.now()
    });
    console.log('🧹 消しゴムツール有効化');
  }

  protected onDeactivate(): void {
    this.isErasing = false;
    this.eventBus.emit('tool:deactivated', { 
      tool: 'eraser',
      timestamp: Date.now()
    });
  }

  protected onConfigUpdate(): void {
    this.eventBus.emit('tool:config-updated', {
      tool: 'eraser',
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawStart(x: number, y: number, pressure = 1.0): void {
    if (!this.isActive) return;

    this.isErasing = true;
    
    this.eventBus.emit('drawing:erase-start', {
      tool: 'eraser',
      x, y, pressure,
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawMove(x: number, y: number, pressure = 1.0): void {
    if (!this.isActive || !this.isErasing) return;

    this.eventBus.emit('drawing:erase-move', {
      tool: 'eraser',
      x, y, pressure,
      config: this.config,
      timestamp: Date.now()
    });
  }

  public onDrawEnd(): void {
    if (!this.isActive || !this.isErasing) return;

    this.isErasing = false;
    
    this.eventBus.emit('drawing:erase-end', {
      tool: 'eraser',
      timestamp: Date.now()
    });
  }
}

/**
 * ツール管理・切り替え・設定管理
 */
export class ToolManager {
  private eventBus: EventBus;
  private tools: Map<ToolType, BaseTool> = new Map();
  private activeTool: BaseTool | null = null;
  private activeToolType: ToolType = 'pen';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initializeTools();
    this.setupEventHandlers();
    console.log('🔧 ToolManager初期化完了');
  }

  /**
   * 基本ツール初期化・Phase1セット
   */
  private initializeTools(): void {
    // ペンツール・ふたばマルーン初期色
    const penConfig: IToolConfig = {
      id: 'pen',
      name: 'ペン',
      icon: '✏️',
      size: 3,
      opacity: 1.0,
      color: 0x800000, // ふたばマルーン
      pressure: true,
      smoothing: 0.5
    };
    
    // 消しゴムツール
    const eraserConfig: IToolConfig = {
      id: 'eraser',
      name: '消しゴム',
      icon: '🧹',
      size: 10,
      opacity: 1.0,
      color: 0xffffff, // 削除用白
      pressure: true,
      smoothing: 0.2
    };

    this.tools.set('pen', new PenTool(penConfig, this.eventBus));
    this.tools.set('eraser', new EraserTool(eraserConfig, this.eventBus));

    console.log('🎨 基本ツールセット初期化:', {
      tools: Array.from(this.tools.keys()),
      defaultTool: 'pen'
    });
  }

  /**
   * イベントハンドラー設定
   */
  private setupEventHandlers(): void {
    // UIからのツール切り替え
    this.eventBus.on('ui:tool-select', (data: { tool: ToolType }) => {
      this.activateTool(data.tool);
    });

    // UI からの設定変更
    this.eventBus.on('ui:tool-config', (data: { tool: ToolType; config: Partial<IToolConfig> }) => {
      this.updateToolConfig(data.tool, data.config);
    });

    // 入力システムからの描画イベント
    this.eventBus.on('input:draw-start', (data: { x: number; y: number; pressure?: number }) => {
      this.activeTool?.onDrawStart(data.x, data.y, data.pressure);
    });

    this.eventBus.on('input:draw-move', (data: { x: number; y: number; pressure?: number }) => {
      this.activeTool?.onDrawMove(data.x, data.y, data.pressure);
    });

    this.eventBus.on('input:draw-end', () => {
      this.activeTool?.onDrawEnd();
    });
  }

  /**
   * ツール有効化・切り替え
   */
  public activateTool(toolType: ToolType): boolean {
    const tool = this.tools.get(toolType);
    if (!tool) {
      console.warn(`⚠️ 未知のツール: ${toolType}`);
      return false;
    }

    // 現在のツール無効化
    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    // 新しいツール有効化
    this.activeTool = tool;
    this.activeToolType = toolType;
    this.activeTool.activate();

    // UI通知
    this.eventBus.emit('tool:changed', {
      previousTool: this.activeToolType,
      currentTool: toolType,
      config: tool.getConfig(),
      timestamp: Date.now()
    });

    console.log(`🔄 ツール切り替え: ${toolType}`);
    return true;
  }

  /**
   * アクティブツール取得
   */
  public getActiveTool(): ToolType {
    return this.activeToolType;
  }

  /**
   * ツール設定取得
   */
  public getToolConfig(toolType: ToolType): IToolConfig | null {
    const tool = this.tools.get(toolType);
    return tool?.getConfig() || null;
  }

  /**
   * ツール設定更新
   */
  public updateToolConfig(toolType: ToolType, updates: Partial<IToolConfig>): boolean {
    const tool = this.tools.get(toolType);
    if (!tool) {
      console.warn(`⚠️ ツール設定更新失敗: ${toolType}`);
      return false;
    }

    tool.updateConfig(updates);
    
    // アクティブツールなら即座にUI反映
    if (toolType === this.activeToolType) {
      this.eventBus.emit('tool:active-config-updated', {
        tool: toolType,
        config: tool.getConfig(),
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * 利用可能ツール一覧取得
   */
  public getAvailableTools(): ToolType[] {
    return Array.from(this.tools.keys());
  }

  /**
   * ツール情報一覧取得・UI構築用
   */
  public getToolsInfo(): Array<{ type: ToolType; config: IToolConfig; active: boolean }> {
    return Array.from(this.tools.entries()).map(([type, tool]) => ({
      type,
      config: tool.getConfig(),
      active: type === this.activeToolType
    }));
  }

  /**
   * ショートカットキー処理
   */
  public handleShortcut(key: string): boolean {
    const shortcuts: Record<string, ToolType> = {
      'p': 'pen',
      'e': 'eraser',
      'b': 'bucket',
      'i': 'eyedropper'
    };

    const toolType = shortcuts[key.toLowerCase()];
    if (toolType && this.tools.has(toolType)) {
      return this.activateTool(toolType);
    }

    return false;
  }

  /**
   * ツールプリセット保存・Phase2準備
   */
  public savePreset(name: string, toolType: ToolType): boolean {
    const tool = this.tools.get(toolType);
    if (!tool) return false;

    // プリセット保存処理・Phase2で実装
    console.log(`💾 ツールプリセット保存準備: ${name} - ${toolType}`);
    return true;
  }

  /**
   * デバッグ情報取得
   */
  public getDebugInfo() {
    return {
      activeToolType: this.activeToolType,
      availableTools: this.getAvailableTools(),
      toolsCount: this.tools.size,
      toolsInfo: this.getToolsInfo()
    };
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    console.log('🔄 ToolManager終了処理開始...');

    try {
      // アクティブツール無効化
      if (this.activeTool) {
        this.activeTool.deactivate();
        this.activeTool = null;
      }

      // 全ツール削除
      this.tools.clear();

      console.log('✅ ToolManager終了処理完了');

    } catch (error) {
      console.error('⚠️ ToolManager終了処理エラー:', error);
    }
  }
}