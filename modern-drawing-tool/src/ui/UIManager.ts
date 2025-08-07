// src/ui/UIManager.ts - Phase1基本UI・イベント連携・2.5K最適化

import { EventBus } from '../core/EventBus.js';

export class UIManager {
  private eventBus: EventBus;
  private currentTool = 'pen';
  private currentColor = 0x800000;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
    console.log('🎨 UIManager初期化完了');
  }

  // イベントリスナー設定・ツール連携
  private setupEventListeners(): void {
    // Phase1では基本的なイベント処理のみ
    // メインのUI操作は main.ts で直接処理
  }

  // ツール変更・状態管理
  public setActiveTool(toolName: string): void {
    const previousTool = this.currentTool;
    this.currentTool = toolName;
    
    console.log(`🔧 UI: ツール変更 ${previousTool} → ${toolName}`);
    
    // UI要素の更新
    this.updateToolButtons(toolName);
  }

  // 色変更・状態管理
  public setActiveColor(color: number): void {
    const previousColor = this.currentColor;
    this.currentColor = color;
    
    console.log(`🎨 UI: 色変更 #${previousColor.toString(16)} → #${color.toString(16)}`);
    
    // UI要素の更新
    this.updateColorDisplay(color);
  }

  // ツールボタン状態更新
  private updateToolButtons(activeTool: string): void {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const tool = btn.getAttribute('data-tool');
      if (tool === activeTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 色表示更新
  private updateColorDisplay(color: number): void {
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    if (colorPicker) {
      const hexColor = `#${color.toString(16).padStart(6, '0')}`;
      colorPicker.value = hexColor;
    }
  }

  // パフォーマンス表示更新・外部から呼び出し
  public updatePerformanceDisplay(fps: number, objectCount: number): void {
    const fpsCounter = document.getElementById('fps-counter');
    const objectCounter = document.getElementById('object-counter');
    
    if (fpsCounter) fpsCounter.textContent = Math.round(fps).toString();
    if (objectCounter) objectCounter.textContent = objectCount.toString();
  }

  // ステータス更新・外部から呼び出し
  public updateStatus(message: string, duration = 3000): void {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = message;
      
      if (duration > 0) {
        setTimeout(() => {
          if (statusText.textContent === message) {
            statusText.textContent = '描画ツール準備完了 - マウスまたはペンタブレットで描画開始';
          }
        }, duration);
      }
    }
  }

  // UI状態取得・デバッグ用
  public getUIState(): {
    currentTool: string;
    currentColor: number;
    resolution: { width: number; height: number };
  } {
    return {
      currentTool: this.currentTool,
      currentColor: this.currentColor,
      resolution: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  // 初期化確認・Phase1最小限
  public isInitialized(): boolean {
    return document.getElementById('toolbar') !== null;
  }

  // リソース解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 UIManager破棄・リソース解放中...');
    
    // Phase1では特別なクリーンアップ不要
    // main.ts で作成されたDOM要素は自動的にクリーンアップされる
    
    console.log('✅ UIManager破棄完了');
  }
}