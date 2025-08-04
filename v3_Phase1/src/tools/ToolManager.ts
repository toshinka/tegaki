// src/tools/ToolManager.ts - Phase2拡張版
// 高度ツール管理・レイヤー対応・設定保存

import { EventBus, IEventData } from '../core/EventBus.js';
import { PenTool } from './PenTool.js';
import { EraserTool } from './EraserTool.js';
import { BrushTool } from './BrushTool.js';
import { ShapeTool } from './ShapeTool.js';
import { FillTool } from './FillTool.js';
import { SelectionTool } from './SelectionTool.js';
import type { IDrawingTool, ToolSettings } from '../types/drawing.types.js';

export class ToolManager {
  private eventBus: EventBus;
  private tools: Map<string, IDrawingTool> = new Map();
  private currentTool: IDrawingTool | null = null;
  private previousTool: IDrawingTool | null = null;
  
  // ツール設定管理
  private toolSettings: Map<string, ToolSettings> = new Map();
  private globalSettings = {
    pressureSensitive: true,
    smoothing: true,
    snapToGrid: false,
    gridSize: 10
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initializeTools();
    this.setupEventListeners();
    this.loadToolSettings();
  }

  /**
   * Phase2ツール初期化・全ツール登録
   */
  private initializeTools(): void {
    // 基本描画ツール
    this.registerTool(new PenTool());
    this.registerTool(new EraserTool());
    this.registerTool(new BrushTool());
    
    // 図形・塗りつぶしツール
    this.registerTool(new ShapeTool());
    this.registerTool(new FillTool());
    
    // 選択・編集ツール
    this.registerTool(new SelectionTool());
    
    console.log(`🔧 ${this.tools.size}個のツールを登録完了`);
  }

  /**
   * ツール登録・プラグイン対応
   */
  public registerTool(tool: IDrawingTool): void {
    this.tools.set(tool.name, tool);
    
    // デフォルト設定作成
    if (!this.toolSettings.has(tool.name)) {
      this.toolSettings.set(tool.name, tool.getSettings());
    }
  }

  /**
   * ツール有効化・状態管理
   */
  public activateTool(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      console.warn(`⚠️ ツール '${toolName}' が見つかりません`);
      return false;
    }

    // 現在のツール無効化
    if (this.currentTool) {
      this.previousTool = this.currentTool;
      this.currentTool.deactivate();
    }

    // 新しいツール有効化
    this.currentTool = tool;
    tool.activate();
    
    // 設定適用
    const settings = this.toolSettings.get(toolName);
    if (settings) {
      tool.updateSettings(settings);
    }

    // イベント発火
    this.eventBus.emit('tool:change', {
      toolName,
      previousTool: this.previousTool?.name || 'none'
    });

    console.log(`✅ ツール切り替え: ${toolName}`);
    return true;
  }

  /**
   * 前回ツールに戻る・ショートカット対応
   */
  public activatePreviousTool(): boolean {
    if (this.previousTool) {
      return this.activateTool(this.previousTool.name);
    }
    return false;
  }

  /**
   * ツール設定更新・リアルタイム反映
   */
  public updateToolSetting(toolName: string, setting: string, value: any): void {
    const tool = this.tools.get(toolName);
    if (!tool) return;

    // 設定更新
    const currentSettings = this.toolSettings.get(toolName) || {};
    const newSettings = { ...currentSettings, [setting]: value };
    this.toolSettings.set(toolName, newSettings);

    // アクティブツールに即座反映
    if (this.currentTool?.name === toolName) {
      tool.updateSettings({ [setting]: value });
    }

    // イベント発火
    this.eventBus.emit('tool:setting-update', {
      toolName,
      setting,
      value
    });

    // 設定自動保存
    this.saveToolSettings();
  }

  /**
   * イベントリスナー設定・描画イベント中継
   */
  private setupEventListeners(): void {
    // 描画イベントを現在のツールに中継
    this.eventBus.on('drawing:start', (data) => {
      this.currentTool?.onPointerDown?.(data);
    });

    this.eventBus.on('drawing:move', (data) => {
      this.currentTool?.onPointerMove?.(data);
    });

    this.eventBus.on('drawing:end', (data) => {
      this.currentTool?.onPointerUp?.(data);
    });

    // キーボードショートカット
    this.eventBus.on('keyboard:shortcut', (data) => {
      this.handleKeyboardShortcut(data.key, data.modifiers);
    });

    // レイヤー変更時の設定更新
    this.eventBus.on('layer:change', (data) => {
      this.updateToolsForLayer(data.layerId);
    });
  }

  /**
   * キーボードショートカット処理
   */
  private handleKeyboardShortcut(key: string, modifiers: string[]): void {
    const shortcuts: Record<string, string> = {
      'p': 'pen',
      'b': 'brush',
      'e': 'eraser',
      'r': 'rectangle',
      'c': 'circle',
      'f': 'fill',
      's': 'selection'
    };

    // 基本ツール切り替え
    if (shortcuts[key.toLowerCase()]) {
      this.activateTool(shortcuts[key.toLowerCase()]);
      return;
    }

    // 特殊操作
    switch (key.toLowerCase()) {
      case 'tab':
        // 前回ツール切り替え
        this.activatePreviousTool();
        break;
        
      case '[':
        // ブラシサイズ減少
        this.adjustBrushSize(-2);
        break;
        
      case ']':
        // ブラシサイズ増加
        this.adjustBrushSize(2);
        break;
        
      case 'shift+[':
        // 不透明度減少
        this.adjustOpacity(-0.1);
        break;
        
      case 'shift+]':
        // 不透明度増加
        this.adjustOpacity(0.1);
        break;
    }
  }

  /**
   * ブラシサイズ調整・アクティブツール対応
   */
  private adjustBrushSize(delta: number): void {
    if (!this.currentTool) return;

    const settings = this.currentTool.getSettings();
    if ('size' in settings) {
      const newSize = Math.max(1, Math.min(200, settings.size + delta));
      this.updateToolSetting(this.currentTool.name, 'size', newSize);
    }
  }

  /**
   * 不透明度調整・アクティブツール対応
   */
  private adjustOpacity(delta: number): void {
    if (!this.currentTool) return;

    const settings = this.currentTool.getSettings();
    if ('opacity' in settings) {
      const newOpacity = Math.max(0, Math.min(1, settings.opacity + delta));
      this.updateToolSetting(this.currentTool.name, 'opacity', newOpacity);
    }
  }

  /**
   * レイヤー変更時の設定更新
   */
  private updateToolsForLayer(layerId: string): void {
    // レイヤー固有の設定があれば適用
    // Phase2ではレイヤーシステムとの連携準備
    if (this.currentTool) {
      this.eventBus.emit('tool:layer-context-change', {
        toolName: this.currentTool.name,
        layerId
      });
    }
  }

  /**
   * ツール設定保存・localStorage活用
   */
  private saveToolSettings(): void {
    try {
      const settingsData = {};
      this.toolSettings.forEach((settings, toolName) => {
        settingsData[toolName] = settings;
      });

      localStorage.setItem('drawingTool:toolSettings', JSON.stringify({
        tools: settingsData,
        global: this.globalSettings,
        version: '4.1',
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('⚠️ ツール設定保存失敗:', error);
    }
  }

  /**
   * ツール設定読み込み・復元
   */
  private loadToolSettings(): void {
    try {
      const saved = localStorage.getItem('drawingTool:toolSettings');
      if (!saved) return;

      const data = JSON.parse(saved);
      if (data.version === '4.1' && data.tools) {
        // ツール設定復元
        Object.entries(data.tools).forEach(([toolName, settings]) => {
          this.toolSettings.set(toolName, settings as ToolSettings);
        });

        // グローバル設定復元
        if (data.global) {
          this.globalSettings = { ...this.globalSettings, ...data.global };
        }

        console.log('✅ ツール設定復元完了');
      }
    } catch (error) {
      console.warn('⚠️ ツール設定読み込み失敗:', error);
    }
  }

  /**
   * 現在のツール情報取得
   */
  public getCurrentTool(): IDrawingTool | null {
    return this.currentTool;
  }

  /**
   * 登録済みツール一覧取得
   */
  public getAvailableTools(): Array<{ name: string; icon: string; category: string }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      icon: tool.icon,
      category: tool.category
    }));
  }

  /**
   * ツール設定取得・UI表示用
   */
  public getToolSettings(toolName: string): ToolSettings | null {
    return this.toolSettings.get(toolName) || null;
  }

  /**
   * グローバル設定管理
   */
  public updateGlobalSetting(setting: string, value: any): void {
    this.globalSettings = { ...this.globalSettings, [setting]: value };
    this.saveToolSettings();

    // 全ツールに通知
    this.eventBus.emit('tool:global-setting-change', {
      setting,
      value
    });
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    // 現在のツール無効化
    if (this.currentTool) {
      this.currentTool.deactivate();
    }

    // 設定保存
    this.saveToolSettings();

    // クリーンアップ
    this.tools.clear();
    this.toolSettings.clear();
    this.currentTool = null;
    this.previousTool = null;

    console.log('🔧 ToolManager終了・設定保存完了');
  }
}