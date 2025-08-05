import { EventBus } from '../core/EventBus.js';
import { PenTool, IDrawingTool } from './PenTool.js';

export class ToolManager {
  private eventBus: EventBus;
  private tools: Map<string, IDrawingTool> = new Map();
  private currentTool: IDrawingTool | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initializeTools();
    this.setupEventListeners();
  }

  private initializeTools(): void {
    // Phase1基本ツール・参考資料の段階実装継承
    const penTool = new PenTool();
    this.tools.set('pen', penTool);
    
    // デフォルトツール設定
    this.setCurrentTool('pen');
  }

  private setupEventListeners(): void {
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.setCurrentTool(data.tool);
    });
  }

  public setCurrentTool(toolName: string): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      console.warn(`ツール未発見: ${toolName}`);
      return;
    }

    const previousToolName = this.currentTool?.name || 'none';

    // 現在のツール無効化
    if (this.currentTool) {
      this.currentTool.deactivate();
    }

    // 新しいツール有効化
    this.currentTool = tool;
    this.currentTool.activate();

    // ツール変更イベント発火
    this.eventBus.emit('tool:change', {
      toolName,
      previousTool: previousToolName
    });
  }

  public getCurrentTool(): IDrawingTool | null {
    return this.currentTool;
  }

  public destroy(): void {
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    this.tools.clear();
  }
}