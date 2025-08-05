import { EventBus } from '../core/EventBus.js';
import { PenTool, IDrawingTool } from './PenTool.js';
import { EraserTool } from './EraserTool.js';
import { BrushTool } from './BrushTool.js';
import { FillTool } from './FillTool.js';
import { ShapeTool } from './ShapeTool.js';

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
    // Phase2完全実装・EventBus注入・責任分界
    const penTool = new PenTool(this.eventBus);
    const brushTool = new BrushTool(this.eventBus);
    const eraserTool = new EraserTool(this.eventBus);
    const fillTool = new FillTool(this.eventBus);
    const shapeTool = new ShapeTool(this.eventBus);
    
    this.tools.set('pen', penTool);
    this.tools.set('brush', brushTool);
    this.tools.set('eraser', eraserTool);
    this.tools.set('fill', fillTool);
    this.tools.set('shape', shapeTool);
    
    // デフォルトツール設定
    this.setCurrentTool('pen');
  }

  private setupEventListeners(): void {
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.setCurrentTool(data.tool);
    });

    // ツール設定変更イベント
    this.eventBus.on('ui:tool-setting-change', (data) => {
      if (this.currentTool && this.currentTool.name === data.toolName) {
        this.currentTool.updateSettings(data.settings);
      }
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
      previousTool: previousToolName,
      settings: tool.getSettings()
    });
    
    console.log(`ツール切り替え: ${previousToolName} → ${toolName}`);
  }

  public getCurrentTool(): IDrawingTool | null {
    return this.currentTool;
  }

  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  public getToolSettings(toolName: string): any {
    const tool = this.tools.get(toolName);
    return tool ? tool.getSettings() : null;
  }

  public updateToolSettings(toolName: string, settings: any): void {
    const tool = this.tools.get(toolName);
    if (tool) {
      tool.updateSettings(settings);
    }
  }

  public destroy(): void {
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    this.tools.clear();
  }
}