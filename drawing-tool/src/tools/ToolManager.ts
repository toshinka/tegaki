// ToolManager.ts - ツール管理・Phase2全ツール対応・安全な実装
// pen/brush/eraser/fill/shape統合管理・エラー処理強化

import { EventBus } from '../core/EventBus.js';
import { PenTool, IDrawingTool } from './PenTool.js';
import { BrushTool } from './BrushTool.js';
import { EraserTool } from './EraserTool.js';
import { FillTool } from './FillTool.js';
import { ShapeTool } from './ShapeTool.js';

/**
 * ツール管理・Phase2対応・5つのツール統合
 */
export class ToolManager {
  private eventBus: EventBus;
  private tools: Map<string, IDrawingTool> = new Map();
  private currentTool: IDrawingTool | null = null;
  private previousToolName: string = 'none';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initializeTools();
    this.setupEventListeners();
  }

  /**
   * Phase2全ツール初期化・段階的実装
   */
  private initializeTools(): void {
    console.log('🔧 Phase2ツール初期化開始...');
    
    try {
      // Phase1基本ツール・確実動作
      const penTool = new PenTool();
      const eraserTool = new EraserTool();
      
      // EventBus注入・各ツールに通信機能提供
      if (typeof (penTool as any).setEventBus === 'function') {
        (penTool as any).setEventBus(this.eventBus);
      }
      if (typeof (eraserTool as any).setEventBus === 'function') {
        (eraserTool as any).setEventBus(this.eventBus);
      }
      
      this.tools.set('pen', penTool);
      this.tools.set('eraser', eraserTool);
      
      // Phase2新ツール・段階的追加
      try {
        const brushTool = new BrushTool();
        if (typeof (brushTool as any).setEventBus === 'function') {
          (brushTool as any).setEventBus(this.eventBus);
        }
        this.tools.set('brush', brushTool);
        console.log('✅ BrushTool初期化成功');
      } catch (error) {
        console.warn('⚠️ BrushTool初期化失敗:', error);
      }
      
      try {
        const fillTool = new FillTool();
        if (typeof (fillTool as any).setEventBus === 'function') {
          (fillTool as any).setEventBus(this.eventBus);
        }
        this.tools.set('fill', fillTool);
        console.log('✅ FillTool初期化成功');
      } catch (error) {
        console.warn('⚠️ FillTool初期化失敗:', error);
      }
      
      try {
        const shapeTool = new ShapeTool();
        if (typeof (shapeTool as any).setEventBus === 'function') {
          (shapeTool as any).setEventBus(this.eventBus);
        }
        this.tools.set('shape', shapeTool);
        console.log('✅ ShapeTool初期化成功');
      } catch (error) {
        console.warn('⚠️ ShapeTool初期化失敗:', error);
      }
      
      // 利用可能ツール一覧表示
      const availableTools = Array.from(this.tools.keys());
      console.log(`🔧 利用可能ツール: ${availableTools.join(', ')}`);
      
      // デフォルトツール設定・確実に動作するペンツール
      this.setCurrentTool('pen');
      
    } catch (error) {
      console.error('❌ ツール初期化エラー:', error);
      // 最低限ペンツールだけでも動作させる
      this.fallbackToBasicTools();
    }
  }

  /**
   * フォールバック・基本ツールのみ
   */
  private fallbackToBasicTools(): void {
    console.log('🔧 フォールバックモード: 基本ツールのみ');
    
    this.tools.clear();
    
    try {
      const penTool = new PenTool();
      if (typeof (penTool as any).setEventBus === 'function') {
        (penTool as any).setEventBus(this.eventBus);
      }
      this.tools.set('pen', penTool);
      this.setCurrentTool('pen');
      console.log('✅ 基本ペンツール動作確保');
    } catch (error) {
      console.error('❌ 基本ツール初期化も失敗:', error);
    }
  }

  /**
   * イベントリスナー設定・UI連携
   */
  private setupEventListeners(): void {
    // UIツールバーからの切り替え
    this.eventBus.on('ui:toolbar-click', (data) => {
      if (data?.tool) {
        this.activateTool(data.tool);
      }
    });

    // キーボードショートカット対応
    this.eventBus.on('input:keyboard-shortcut', (data) => {
      if (data?.action === 'tool-switch' && data?.tool) {
        this.activateTool(data.tool);
      }
    });

    // ツール設定変更
    this.eventBus.on('ui:tool-settings-change', (data) => {
      if (this.currentTool && data?.settings) {
        this.updateCurrentToolSettings(data.settings);
      }
    });
  }

  /**
   * ツール有効化・安全な切り替え
   */
  public activateTool(toolName: string): boolean {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        console.warn(`⚠️ ツール未発見: ${toolName}`);
        return false;
      }

      const previousToolName = this.currentTool?.name || 'none';

      // 現在のツール無効化・安全な処理
      if (this.currentTool) {
        try {
          this.currentTool.deactivate();
        } catch (error) {
          console.warn(`⚠️ ツール無効化エラー (${previousToolName}):`, error);
        }
      }

      // 新しいツール有効化
      this.currentTool = tool;
      this.previousToolName = previousToolName;
      
      try {
        this.currentTool.activate();
      } catch (error) {
        console.error(`❌ ツール有効化エラー (${toolName}):`, error);
        // 有効化失敗時は前のツールに戻す
        this.rollbackTool();
        return false;
      }

      // ツール変更イベント発火
      this.eventBus.emit('tool:change', {
        tool: toolName,
        previousTool: previousToolName,
        timestamp: performance.now()
      });
      
      console.log(`ツール切り替え: ${previousToolName} → ${toolName}`);
      return true;

    } catch (error) {
      console.error(`❌ ツール切り替えエラー (${toolName}):`, error);
      return false;
    }
  }

  /**
   * ツール切り替え失敗時のロールバック
   */
  private rollbackTool(): void {
    console.log('🔄 ツール切り替えロールバック実行');
    
    if (this.previousToolName !== 'none' && this.tools.has(this.previousToolName)) {
      const previousTool = this.tools.get(this.previousToolName);
      if (previousTool) {
        this.currentTool = previousTool;
        try {
          this.currentTool.activate();
          console.log(`✅ ロールバック成功: ${this.previousToolName}`);
        } catch (error) {
          console.error('❌ ロールバックも失敗:', error);
          this.fallbackToBasicTools();
        }
      }
    } else {
      // ベーシックツールにフォールバック
      this.fallbackToBasicTools();
    }
  }

  /**
   * 互換性のあるsetCurrentTool・既存コード対応
   */
  public setCurrentTool(toolName: string): void {
    this.activateTool(toolName);
  }

  /**
   * 現在ツール設定更新
   */
  private updateCurrentToolSettings(settings: any): void {
    if (!this.currentTool) return;

    try {
      // ツール設定更新・各ツール個別処理
      if (typeof (this.currentTool as any).updateSettings === 'function') {
        (this.currentTool as any).updateSettings(settings);
      }

      // 共通設定適用
      if (settings.size !== undefined) {
        this.eventBus.emit('drawing:size-change', {
          size: settings.size,
          tool: this.currentTool.name,
          timestamp: performance.now()
        });
      }

      if (settings.color !== undefined) {
        this.eventBus.emit('drawing:color-change', {
          color: settings.color,
          tool: this.currentTool.name,
          timestamp: performance.now()
        });
      }

      if (settings.opacity !== undefined) {
        this.eventBus.emit('drawing:opacity-change', {
          opacity: settings.opacity,
          tool: this.currentTool.name,
          timestamp: performance.now()
        });
      }

    } catch (error) {
      console.warn('⚠️ ツール設定更新エラー:', error);
    }
  }

  /**
   * 現在ツール取得
   */
  public getCurrentTool(): IDrawingTool | null {
    return this.currentTool;
  }

  /**
   * 現在ツール名取得・文字列版
   */
  public getCurrentToolName(): string {
    return this.currentTool?.name || 'none';
  }

  /**
   * 利用可能ツール一覧取得
   */
  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * ツール存在確認
   */
  public hasToolname(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * ツール情報取得・デバッグ用
   */
  public getToolInfo(toolName: string): any {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      icon: tool.icon,
      category: tool.category,
      active: this.currentTool === tool,
      available: true
    };
  }

  /**
   * 全ツール情報取得
   */
  public getAllToolsInfo(): any[] {
    return Array.from(this.tools.keys()).map(toolName => 
      this.getToolInfo(toolName)
    ).filter(info => info !== null);
  }

  /**
   * ツール統計取得・使用状況監視
   */
  public getToolUsageStats(): any {
    return {
      totalTools: this.tools.size,
      currentTool: this.getCurrentToolName(),
      availableTools: this.getAvailableTools(),
      lastActivation: this.currentTool ? performance.now() : 0
    };
  }

  /**
   * 次のツールに切り替え・循環
   */
  public switchToNextTool(): void {
    const tools = this.getAvailableTools();
    if (tools.length <= 1) return;

    const currentIndex = tools.indexOf(this.getCurrentToolName());
    const nextIndex = (currentIndex + 1) % tools.length;
    const nextTool = tools[nextIndex];

    this.activateTool(nextTool);
  }

  /**
   * 前のツールに切り替え・循環
   */
  public switchToPreviousTool(): void {
    const tools = this.getAvailableTools();
    if (tools.length <= 1) return;

    const currentIndex = tools.indexOf(this.getCurrentToolName());
    const prevIndex = currentIndex <= 0 ? tools.length - 1 : currentIndex - 1;
    const prevTool = tools[prevIndex];

    this.activateTool(prevTool);
  }

  /**
   * 全ツール無効化・緊急停止
   */
  public deactivateAllTools(): void {
    console.log('🛑 全ツール無効化実行');
    
    if (this.currentTool) {
      try {
        this.currentTool.deactivate();
      } catch (error) {
        console.warn('⚠️ ツール無効化エラー:', error);
      }
      this.currentTool = null;
    }

    this.eventBus.emit('tool:all-deactivated', {
      timestamp: performance.now()
    });
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    console.log('🔄 ToolManager終了処理開始...');
    
    try {
      // 現在ツール無効化
      this.deactivateAllTools();
      
      // 全ツール破棄
      for (const [name, tool] of this.tools) {
        try {
          if (typeof (tool as any).destroy === 'function') {
            (tool as any).destroy();
          }
        } catch (error) {
          console.warn(`⚠️ ツール破棄エラー (${name}):`, error);
        }
      }
      
      // コレクションクリア
      this.tools.clear();
      this.currentTool = null;
      this.previousToolName = 'none';
      
      console.log('✅ ToolManager終了処理完了');
      
    } catch (error) {
      console.error('❌ ToolManager終了処理エラー:', error);
    }
  }
}

// 型定義エクスポート・外部利用
export type { IDrawingTool };