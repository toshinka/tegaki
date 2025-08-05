import { IEventData } from '../types/drawing.types.js';

/**
 * 型安全イベントバス・システム間通信中心
 */
export class EventBus {
  private listeners: Map<keyof IEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number }> = [];

  public on<K extends keyof IEventData>(
    event: K,
    callback: (data: IEventData[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 自動解除関数返却
    return () => this.off(event, callback);
  }

  public emit<K extends keyof IEventData>(
    event: K,
    data: IEventData[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`EventBus error in ${event}:`, error);
        }
      });
    }

    // イベント履歴記録
    this.eventHistory.push({
      event: event as string,
      timestamp: performance.now()
    });
  }

  public off<K extends keyof IEventData>(
    event: K,
    callback: (data: IEventData[K]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  public destroy(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}