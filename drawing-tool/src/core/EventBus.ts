// EventBus.ts - 型安全イベント通信・疎結合アーキテクチャ
// 全システム間通信・履歴・デバッグ支援

import * as PIXI from 'pixi.js';

/**
 * イベントデータ型定義・型安全通信保証
 */
export interface IEventData {
  type: string;
  timestamp: number;
  data: any;
  source?: string;
  target?: string;
}

/**
 * 具体的なイベントデータ型定義
 */
export interface ISpecificEventData {
  // 描画イベント
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string; timestamp: number };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number; timestamp: number };
  'drawing:end': { point: PIXI.Point; timestamp: number };
  
  // ツールイベント
  'tool:change': { tool: string; previousTool?: string; settings?: any };
  'tool:setting-change': { toolName: string; setting: string; value: any };
  
  // UIイベント
  'ui:toolbar-click': { toolName: string; buttonElement?: HTMLElement };
  'color:change': { color: number; hsv?: { h: number; s: number; v: number } };
  'brush:sizeChange': { size: number };
  'brush:opacityChange': { opacity: number };
  
  // パフォーマンスイベント
  'performance:warning': { used: number; limit: number; type: 'memory' | 'fps' | 'gpu'; message: string };
  'performance:critical': { metric: string; value: number; threshold: number; action: string };
  'performance:renderer-initialized': { renderer: string };
  'performance:update': { fps?: number; memory?: number; gpu?: number };
  
  // レイヤーイベント
  'layer:create': { id: string; name: string; index: number };
  'layer:delete': { id: string; name: string };
  'layer:reorder': { id: string; newIndex: number; oldIndex: number };
  'layer:visibility-change': { id: string; visible: boolean };
  
  // エラーイベント
  'error:global': { message: string; filename?: string; lineno?: number };
  'error:promise-rejection': { reason: any };
  'error:pixi': { message: string; component: string };
  
  // テストイベント
  'test:basic-function': { test: boolean };
}

/**
 * イベントリスナー管理・自動解除対応
 */
interface IEventListener {
  callback: (data: IEventData) => void;
  once: boolean;
  id: number;
}

/**
 * イベント履歴・デバッグ用
 */
interface IEventHistoryItem {
  event: string;
  data: any;
  timestamp: number;
  listenersCount: number;
}

/**
 * 型安全イベントバス・システム間通信中心
 */
export class EventBus {
  private listeners = new Map<string, IEventListener[]>();
  private nextListenerId = 1;
  private eventHistory: IEventHistoryItem[] = [];
  private readonly maxHistorySize = 1000;
  private debugMode = false;

  constructor(enableDebug = false) {
    // 開発環境判定 - __DEV__が未定義の場合の対応
    const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ||
                  typeof location !== 'undefined' && location.hostname === 'localhost';
    this.debugMode = enableDebug || isDev;
    
    if (this.debugMode) {
      console.log('📡 EventBus初期化完了 - デバッグモード有効');
    }
  }

  /**
   * 型安全イベントリスナー登録
   * @param event イベント名
   * @param callback コールバック関数
   * @param once 一回実行フラグ
   * @returns クリーンアップ関数
   */
  public on(
    event: string,
    callback: (data: IEventData) => void,
    once = false
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listener: IEventListener = {
      callback,
      once,
      id: this.nextListenerId++
    };

    this.listeners.get(event)!.push(listener);

    if (this.debugMode) {
      console.log(`📡 リスナー登録: ${event} [ID:${listener.id}]`);
    }

    // クリーンアップ関数返却
    return () => this.off(event, listener.id);
  }

  /**
   * 一回実行イベントリスナー登録
   */
  public once(
    event: string,
    callback: (data: IEventData) => void
  ): () => void {
    return this.on(event, callback, true);
  }

  /**
   * イベントリスナー削除
   */
  public off(event: string, listenerId: number): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    const index = eventListeners.findIndex(l => l.id === listenerId);
    if (index >= 0) {
      eventListeners.splice(index, 1);
      
      if (this.debugMode) {
        console.log(`📡 リスナー削除: ${event} [ID:${listenerId}]`);
      }
    }

    // 空配列削除
    if (eventListeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * 型安全イベント発火・データ検証
   */
  public emit(event: string, data: IEventData): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      if (this.debugMode && !event.startsWith('test:')) {
        console.warn(`📡 リスナーなし: ${event}`);
      }
      return;
    }

    // イベント履歴記録
    this.recordEvent(event, data, eventListeners.length);

    // リスナー実行・エラーハンドリング
    const listenersToRemove: number[] = [];

    for (const listener of eventListeners) {
      try {
        listener.callback(data);
        
        // once実行リスナー削除対象
        if (listener.once) {
          listenersToRemove.push(listener.id);
        }
        
      } catch (error) {
        console.error(`📡 リスナーエラー: ${event} [ID:${listener.id}]`, error);
        
        // エラー発生リスナー削除（自動回復）
        listenersToRemove.push(listener.id);
      }
    }

    // once・エラーリスナー削除
    for (const id of listenersToRemove) {
      this.off(event, id);
    }

    if (this.debugMode && !event.startsWith('performance:') && !event.startsWith('test:')) {
      console.log(`📡 イベント発火: ${event} → ${eventListeners.length}リスナー`);
    }
  }

  /**
   * イベント履歴記録・デバッグ支援
   */
  private recordEvent(event: string, data: any, listenersCount: number): void {
    const historyItem: IEventHistoryItem = {
      event,
      data: this.debugMode ? data : null, // デバッグ時のみデータ保持
      timestamp: performance.now(),
      listenersCount
    };

    this.eventHistory.push(historyItem);

    // 履歴サイズ制限
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * 全イベントリスナー削除
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      if (this.debugMode) {
        console.log(`📡 全リスナー削除: ${event}`);
      }
    } else {
      const eventCount = this.listeners.size;
      this.listeners.clear();
      if (this.debugMode) {
        console.log(`📡 全イベント削除: ${eventCount}種類`);
      }
    }
  }

  /**
   * リスナー存在確認
   */
  public hasListeners(event: string): boolean {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.length > 0 : false;
  }

  /**
   * リスナー数取得
   */
  public getListenerCount(event?: string): number {
    if (event) {
      const eventListeners = this.listeners.get(event);
      return eventListeners ? eventListeners.length : 0;
    }
    
    // 全イベントリスナー数
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * デバッグ情報取得
   */
  public getDebugInfo() {
    const events = Array.from(this.listeners.keys()).map(event => ({
      event: event,
      listenerCount: this.getListenerCount(event)
    }));

    return {
      totalEvents: this.listeners.size,
      totalListeners: this.getListenerCount(),
      events,
      recentHistory: this.eventHistory.slice(-10),
      debugMode: this.debugMode
    };
  }

  /**
   * イベント履歴取得・デバッグ用
   */
  public getEventHistory(eventFilter?: string, limit = 50): IEventHistoryItem[] {
    let history = this.eventHistory;
    
    if (eventFilter) {
      history = history.filter(item => item.event === eventFilter);
    }
    
    return history.slice(-limit);
  }

  /**
   * パフォーマンス統計取得
   */
  public getPerformanceStats() {
    const recentEvents = this.eventHistory.slice(-100);
    const eventCounts = new Map<string, number>();
    
    for (const item of recentEvents) {
      eventCounts.set(item.event, (eventCounts.get(item.event) || 0) + 1);
    }
    
    return {
      recentEventCount: recentEvents.length,
      eventFrequency: Array.from(eventCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      averageListenersPerEvent: recentEvents.length > 0 
        ? recentEvents.reduce((sum, item) => sum + item.listenersCount, 0) / recentEvents.length 
        : 0
    };
  }

  /**
   * リソース解放・アプリケーション終了時
   */
  public destroy(): void {
    if (this.debugMode) {
      console.log('📡 EventBus終了処理開始...', this.getDebugInfo());
    }
    
    this.removeAllListeners();
    this.eventHistory = [];
    this.nextListenerId = 1;
    
    if (this.debugMode) {
      console.log('📡 EventBus終了処理完了');
    }
  }
}