// PerformanceManager.ts - 性能監視・メモリ管理 (簡略版)
// リアルタイム性能調整・警告通知

import type { EventBus } from './EventBus.js';

/**
 * 性能メトリクス・監視データ
 */
interface IPerformanceMetrics {
  fps: number;
  memory: number; // MB
  timestamp: number;
}

/**
 * 性能監視・自動最適化システム
 */
export class PerformanceManager {
  private eventBus: EventBus;
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  
  // 性能データ
  private metrics: IPerformanceMetrics;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsHistory: number[] = [];
  
  // メモリ制限
  private readonly memoryLimits = {
    warning: 800, // 800MB
    critical: 1024 // 1GB
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // 初期メトリクス設定
    this.metrics = {
      fps: 0,
      memory: 0,
      timestamp: performance.now()
    };
    
    console.log('📊 PerformanceManager初期化完了');
  }

  /**
   * 性能監視開始
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    
    // 1秒間隔でメトリクス収集
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
      this.checkPerformance();
    }, 1000);
    
    // フレーム毎FPS計測
    this.startFPSMonitoring();
    
    console.log('📊 性能監視開始');
  }

  /**
   * 性能監視停止
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('📊 性能監視停止');
  }

  /**
   * メトリクス収集
   */
  private collectMetrics(): void {
    const currentFPS = this.calculateCurrentFPS();
    const memoryUsed = this.getMemoryUsage();
    
    this.metrics = {
      fps: currentFPS,
      memory: memoryUsed,
      timestamp: performance.now()
    };
  }

  /**
   * FPS監視開始
   */
  private startFPSMonitoring(): void {
    const updateFPS = (timestamp: number) => {
      if (!this.isMonitoring) return;
      
      // フレーム時間計算
      const deltaTime = timestamp - this.lastFrameTime;
      const fps = 1000 / deltaTime;
      
      // FPS履歴更新（直近60フレーム）
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      this.lastFrameTime = timestamp;
      this.frameCount++;
      
      requestAnimationFrame(updateFPS);
    };
    
    requestAnimationFrame(updateFPS);
  }

  /**
   * 現在FPS計算
   */
  private calculateCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    
    const recentFrames = this.fpsHistory.slice(-30); // 直近30フレーム
    return recentFrames.reduce((sum, fps) => sum + fps, 0) / recentFrames.length;
  }

  /**
   * メモリ使用量取得
   */
  private getMemoryUsage(): number {
    // Chrome専用・performance.memory
    const memory = (performance as any).memory;
    
    if (memory) {
      return memory.usedJSHeapSize / (1024 * 1024);
    }
    
    // フォールバック・推定値
    return this.estimateMemoryUsage();
  }

  /**
   * メモリ使用量推定
   */
  private estimateMemoryUsage(): number {
    // DOM要素数・キャンバスサイズから推定
    const elements = document.querySelectorAll('*').length;
    const canvasArea = window.innerWidth * window.innerHeight;
    
    return (elements * 0.05) + (canvasArea / 1000000 * 5); // 概算MB
  }

  /**
   * 性能チェック・警告判定
   */
  private checkPerformance(): void {
    const { fps, memory } = this.metrics;
    
    // パフォーマンス更新イベント
    this.eventBus.emit('performance:update', {
      fps,
      memory,
      timestamp: performance.now()
    });
    
    // メモリ警告
    if (memory > this.memoryLimits.warning) {
      this.eventBus.emit('performance:warning', {
        used: memory,
        limit: this.memoryLimits.critical,
        type: 'memory',
        message: `メモリ使用量: ${memory.toFixed(1)}MB`
      });
      
      if (memory > this.memoryLimits.critical) {
        this.forceGarbageCollection();
      }
    }
    
    // FPS警告
    if (fps < 30 && fps > 0) {
      this.eventBus.emit('performance:warning', {
        used: fps,
        limit: 60,
        type: 'fps', 
        message: `FPS低下: ${fps.toFixed(1)}`
      });
    }
  }

  /**
   * 強制ガベージコレクション
   */
  private forceGarbageCollection(): void {
    console.log('🗑️ 強制ガベージコレクション実行');
    
    // ブラウザGC強制実行（開発環境）
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // メモリ解放通知
    this.eventBus.emit('performance:force-gc', {
      reason: 'memory-pressure',
      timestamp: performance.now()
    });
  }

  /**
   * 現在メトリクス取得
   */
  public getCurrentMetrics(): IPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 性能統計取得
   */
  public getPerformanceStats() {
    if (this.fpsHistory.length === 0) {
      return {
        avgFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        currentMemory: this.metrics.memory
      };
    }
    
    const fps = this.fpsHistory;
    
    return {
      avgFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
      minFPS: Math.min(...fps),
      maxFPS: Math.max(...fps),
      currentMemory: this.metrics.memory
    };
  }

  /**
   * 監視状態取得
   */
  public isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * デバッグ情報取得
   */
  public getDebugInfo() {
    return {
      isMonitoring: this.isMonitoring,
      metrics: this.metrics,
      frameCount: this.frameCount,
      fpsHistoryLength: this.fpsHistory.length,
      memoryLimits: this.memoryLimits
    };
  }

  /**
   * リソース解放
   */
  public destroy(): void {
    console.log('📊 PerformanceManager終了処理開始...');
    
    this.stopMonitoring();
    this.fpsHistory = [];
    
    console.log('✅ PerformanceManager終了処理完了');
  }
}