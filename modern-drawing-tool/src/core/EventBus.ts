// src/core/EventBus.ts - 型安全通信・疎結合基盤・Claude理解容易

import { Point } from 'pixi.js';

// Phase1基本イベント・Phase2拡張準備
export interface IEventData {
  // 描画イベント・Phase1基盤
  'drawing:start': { 
    point: Point; 
    pressure: number; 
    pointerType: 'mouse' | 'pen';
  };
  'drawing:move': { 
    point: Point; 
    pressure: number; 
    velocity: number; 
  };
  'drawing:end': { point: Point; };
  
  // ツールイベント・Phase1基盤
  'tool:change': { toolName: string; previousTool: string; };
  
  // UIイベント・Phase1基盤
  'ui:color-change': { color: number; previousColor: number; };
  'ui:toolbar-click': { tool: string; };
  
  // 性能イベント・Phase1監視基盤
  'performance:fps-low': { currentFPS: number; targetFPS: number; };
  'performance:memory-warning': { used: number; limit: number; };
}

export type EventListener<K extends keyof IEventData> = (data: IEventData[K]) => void;

export class EventBus {
  private listeners: Map<keyof IEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number }> = [];
  private isDestroyed = false;

  // 型安全リスナー登録・自動解除・メモリリーク防止
  public on<K extends keyof IEventData>(
    event: K,
    callback: EventListener<K>
  ): () => void {
    if (this.isDestroyed) {
      console.warn('EventBus已破棄済み・リスナー登録無効');
      return () => {};
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 自動解除関数返却・Claude理解容易・保守性
    return () => this.off(event, callback);
  }

  // リスナー解除・メモリリーク防止
  public off<K extends keyof IEventData>(
    event: K,
    callback: EventListener<K>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  // 型安全イベント発火・エラー処理・ログ出力
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void {
    if (this.isDestroyed) {
      console.warn('EventBus破棄済み・イベント発火無効');
      return;
    }

    const listeners = this.listeners.get(event);
    if (listeners && listeners.size > 0) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`EventBus error in ${event}:`, error);
        }
      });
    }

    // デバッグ支援・Phase1開発効率化
    this.eventHistory.push({ event: event as string, timestamp: performance.now() });
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  // デバッグ情報取得・イベント履歴・Claude理解支援
  public getEventHistory(): Array<{ event: string; timestamp: number }> {
    return [...this.eventHistory];
  }

  // 統計情報・リスナー数・パフォーマンス監視
  public getStats(): { totalListeners: number; eventTypes: number } {
    let totalListeners = 0;
    this.listeners.forEach(listeners => {
      totalListeners += listeners.size;
    });

    return {
      totalListeners,
      eventTypes: this.listeners.size
    };
  }

  // リソース解放・メモリリーク防止・アプリ終了時
  public destroy(): void {
    this.listeners.clear();
    this.eventHistory = [];
    this.isDestroyed = true;
    console.log('EventBus destroyed - リソース解放完了');
  }
}