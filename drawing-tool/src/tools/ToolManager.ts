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
    // Phase2ツール初期化・EventBus注入
    const penTool = new PenTool(this.eventBus);
    const eraserTool = new EraserTool(this.eventBus);
    const brushTool = new BrushTool(this.eventBus);
    const fillTool = new FillTool(this.eventBus);
    const shapeTool = new ShapeTool(this.eventBus);
    
    this.tools.set('pen', penTool);
    this.tools.set('eraser', eraserTool);
    this.tools.set('brush', brushTool);
    this.tools.set('fill', fillTool);
    this.tools.set('shape', shapeTool);
    
    // デフォルトツール設定
    this.setCurrentTool('pen');
  }

  private setupEventListeners(): void {
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.setCurrentTool(data.toolName);
    });

    // 描画イベントを現在のツールに転送
    this.eventBus.on('drawing:start', (data) => {
      if (this.currentTool) {
        this.currentTool.onPointerDown(data);
      }
    });

    this.eventBus.on('drawing:move', (data) => {
      if (this.currentTool) {
        this.currentTool.onPointerMove(data);
      }
    });

    this.eventBus.on('drawing:end', (data) => {
      if (this.currentTool) {
        this.currentTool.onPointerUp(data);
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

    console.log(`ツール切り替え: ${previousToolName} → ${toolName}`);
  }

  public getCurrentTool(): IDrawingTool | null {
    return this.currentTool;
  }

  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  public getToolSettings(toolName?: string): any {
    const tool = toolName ? this.tools.get(toolName) : this.currentTool;
    return tool ? tool.getSettings() : null;
  }

  public updateToolSettings(settings: any, toolName?: string): void {
    const tool = toolName ? this.tools.get(toolName) : this.currentTool;
    if (tool) {
      tool.updateSettings(settings);
    }
  }

  public destroy(): void {
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    this.tools.clear();
    this.currentTool = null;
  }
}