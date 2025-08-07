// src/core/EventBus.ts - 型安全通信・疎結合基盤・Claude理解容易

import type { Point } from 'pixi.js';

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
  'ui:resize': { width: number; height: number; };
  
  // 性能イベント・Phase1監視基盤
  'performance:fps-low': { currentFPS: number; targetFPS: number; };
  'performance:memory-warning': { used: number; limit: number; };
  'performance:error': { message: string; source: string; lineno: number; };
}

export type EventListener<K extends keyof IEventData> = (data: IEventData[K]) => void;

export class EventBus {
  private listeners: Map<keyof IEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number; data?: any }> = [];
  private isDestroyed = false;

  // 型安全リスナー登録・自動解除・メモリリーク防止
  public on<K extends keyof IEventData>(
    event: K,
    callback: EventListener<K>
  ): () => void {
    if (this.isDestroyed) {
      console.warn('EventBus破棄済み・リスナー登録無効');
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

    // デバッグ支援・Phase1開発効率化（開発時のみ詳細ログ）
    if (import.meta.env.DEV) {
      this.eventHistory.push({ 
        event: event as string, 
        timestamp: performance.now(),
        data: structuredClone ? structuredClone(data) : data
      });
      if (this.eventHistory.length > 1000) {
        this.eventHistory = this.eventHistory.slice(-1000);
      }
    }
  }

  // 一度だけ実行されるリスナー・メモリ効率化
  public once<K extends keyof IEventData>(
    event: K,
    callback: EventListener<K>
  ): () => void {
    const onceWrapper = (data: IEventData[K]) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    
    return this.on(event, onceWrapper);
  }

  // イベント存在チェック・デバッグ支援
  public hasListeners<K extends keyof IEventData>(event: K): boolean {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size > 0 : false;
  }

  // 全イベントリスナー取得・デバッグ用
  public getListenerCount<K extends keyof IEventData>(event: K): number {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  // デバッグ情報取得・イベント履歴・Claude理解支援
  public getEventHistory(): Array<{ event: string; timestamp: number; data?: any }> {
    return [...this.eventHistory];
  }

  // 統計情報・リスナー数・パフォーマンス監視
  public getStats(): { 
    totalListeners: number; 
    eventTypes: number; 
    historySize: number;
    memoryUsage: number;
  } {
    let totalListeners = 0;
    this.listeners.forEach(listeners => {
      totalListeners += listeners.size;
    });

    return {
      totalListeners,
      eventTypes: this.listeners.size,
      historySize: this.eventHistory.length,
      memoryUsage: JSON.stringify(this.eventHistory).length // 概算
    };
  }

  // 特定イベントの履歴フィルタリング・デバッグ用
  public getEventHistoryByType<K extends keyof IEventData>(
    eventType: K,
    limit: number = 100
  ): Array<{ event: string; timestamp: number; data?: any }> {
    return this.eventHistory
      .filter(entry => entry.event === eventType)
      .slice(-limit);
  }

  // イベント履歴クリア・メモリ節約
  public clearHistory(): void {
    this.eventHistory = [];
    console.log('EventBus: イベント履歴をクリアしました');
  }

  // 全リスナー削除・特定イベント
  public removeAllListeners<K extends keyof IEventData>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  // リソース解放・メモリリーク防止・アプリ終了時
  public destroy(): void {
    console.log('🔄 EventBus破棄・リソース解放中...');
    
    this.listeners.clear();
    this.eventHistory = [];
    this.isDestroyed = true;
    
    console.log('✅ EventBus破棄完了・リソース解放完了');
  }
}