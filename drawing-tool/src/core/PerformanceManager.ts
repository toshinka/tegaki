// PerformanceManager.ts - 性能監視・メモリ管理・1GB制限・60FPS監視
// リアルタイム性能調整・警告通知・強制GC

import type { EventBus } from './EventBus.js';

/**
 * 性能メトリクス・監視データ
 */
interface IPerformanceMetrics {
  // FPS関連
  currentFPS: number;
  targetFPS: number;
  averageFPS: number;
  frameDrops: number;
  
  // メモリ関連
  memoryUsed: number; // MB
  memoryLimit: number; // MB
  textureMemory: number; // MB
  gpuMemory: number; // MB (推定)
  
  // CPU関連
  cpuUsage: number; // %
  renderTime: number; // ms
  drawCalls: number;
  
  // GPU関連
  gpuUsage: number; // %
  shaderCompilations: number;
  textureUploads: number;
  
  // タイムスタンプ
  timestamp: number;
}

/**
 * 性能警告レベル・段階的対応
 */
type PerformanceLevel = 'optimal' | 'good' | 'warning' | 'critical' | 'emergency';

/**
 * 自動性能調整設定
 */
interface IPerformanceAdjustment {
  level: PerformanceLevel;
  adjustments: {
    antialias: boolean;
    resolution: number;
    maxFPS: number;
    textureQuality: number;
    enableFilters: boolean;
  };
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
  private metricsHistory: IPerformanceMetrics[] = [];
  private readonly maxHistorySize = 300; // 5分間(1秒間隔)
  
  // FPS監視
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsHistory: number[] = [];
  private readonly fpsHistorySize = 60; // 1秒間のフレーム
  
  // メモリ監視
  private readonly memoryLimits = {
    warning: 800, // 800MB
    critical: 1024, // 1GB
    emergency: 1200 // 1.2GB
  };
  
  // 調整レベル設定
  private readonly performanceAdjustments: Record<PerformanceLevel, IPerformanceAdjustment> = {
    optimal: {
      level: 'optimal',
      adjustments: {
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        maxFPS: 60,
        textureQuality: 1.0,
        enableFilters: true
      }
    },
    good: {
      level: 'good',
      adjustments: {
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        maxFPS: 60,
        textureQuality: 0.9,
        enableFilters: true
      }
    },
    warning: {
      level: 'warning',
      adjustments: {
        antialias: false,
        resolution: 1,
        maxFPS: 30,
        textureQuality: 0.75,
        enableFilters: false
      }
    },
    critical: {
      level: 'critical',
      adjustments: {
        antialias: false,
        resolution: 0.75,
        maxFPS: 20,
        textureQuality: 0.5,
        enableFilters: false
      }
    },
    emergency: {
      level: 'emergency',
      adjustments: {
        antialias: false,
        resolution: 0.5,
        maxFPS: 15,
        textureQuality: 0.25,
        enableFilters: false
      }
    }
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // 初期メトリクス設定
    this.metrics = this.createEmptyMetrics();
    
    // ブラウザ性能API利用可能性チェック
    this.checkBrowserSupport();
    
    console.log('📊 PerformanceManager初期化完了');
  }

  /**
   * 性能監視開始・リアルタイム監視
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    
    // 1秒間隔でメトリクス収集
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
    }, 1000);
    
    // フレーム毎FPS計測
    this.startFPSMonitoring();
    
    console.log('📊 性能監視開始 - 1秒間隔');
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
   * メトリクス収集・統合データ取得
   */
  private collectMetrics(): void {
    const now = performance.now();
    
    // メモリ使用量取得
    const memoryInfo = this.getMemoryInfo();
    
    // FPS計算
    const currentFPS = this.calculateCurrentFPS();
    const averageFPS = this.calculateAverageFPS();
    
    // CPU使用率推定
    const cpuUsage = this.estimateCPUUsage();
    
    // 新しいメトリクス作成
    this.metrics = {
      currentFPS,
      targetFPS: 60, // 固定目標
      averageFPS,
      frameDrops: this.countFrameDrops(),
      
      memoryUsed: memoryInfo.used,
      memoryLimit: memoryInfo.limit,
      textureMemory: memoryInfo.textures,
      gpuMemory: memoryInfo.gpu,
      
      cpuUsage,
      renderTime: this.metrics.renderTime, // 前回値保持
      drawCalls: this.estimateDrawCalls(),
      
      gpuUsage: this.estimateGPUUsage(),
      shaderCompilations: 0, // TODO: 実装
      textureUploads: 0, // TODO: 実装
      
      timestamp: now
    };
    
    // 履歴保存
    this.metricsHistory.push(this.metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * メモリ情報取得・Chrome performance.memory利用
   */
  private getMemoryInfo(): { used: number; limit: number; textures: number; gpu: number } {
    // Chrome専用・performance.memory
    const memory = (performance as any).memory;
    
    if (memory) {
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.totalJSHeapSize / (1024 * 1024);
      
      return {
        used: usedMB,
        limit: Math.max(limitMB, this.memoryLimits.critical),
        textures: this.estimateTextureMemory(),
        gpu: this.estimateGPUMemory()
      };
    }
    
    // フォールバック・推定値
    return {
      used: this.estimateMemoryUsage(),
      limit: this.memoryLimits.critical,
      textures: this.estimateTextureMemory(),
      gpu: this.estimateGPUMemory()
    };
  }

  /**
   * FPS監視・リアルタイム計測
   */
  private startFPSMonitoring(): void {
    const updateFPS = (timestamp: number) => {
      if (!this.isMonitoring) return;
      
      // フレーム時間計算
      const deltaTime = timestamp - this.lastFrameTime;
      const fps = 1000 / deltaTime;
      
      // FPS履歴更新
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > this.fpsHistorySize) {
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
    
    const recentFrames = this.fpsHistory.slice(-10); // 直近10フレーム
    return recentFrames.reduce((sum, fps) => sum + fps, 0) / recentFrames.length;
  }

  /**
   * 平均FPS計算・長期傾向
   */
  private calculateAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    
    return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
  }

  /**
   * フレームドロップ数計算
   */
  private countFrameDrops(): number {
    return this.fpsHistory.filter(fps => fps < 50).length; // 50FPS以下をドロップ
  }

  /**
   * CPU使用率推定・レンダリング負荷
   */
  private estimateCPUUsage(): number {
    const avgFPS = this.calculateAverageFPS();
    const targetFPS = 60;
    
    // FPS低下からCPU負荷推定
    const usage = Math.max(0, (targetFPS - avgFPS) / targetFPS * 100);
    return Math.min(100, usage);
  }

  /**
   * 描画コール数推定
   */
  private estimateDrawCalls(): number {
    // TODO: PixiJS統計から取得
    return Math.floor(Math.random() * 100) + 50; // 仮実装
  }

  /**
   * GPU使用率推定
   */
  private estimateGPUUsage(): number {
    const fps = this.calculateCurrentFPS();
    
    // FPS基準GPU負荷推定
    if (fps > 55) return Math.random() * 30 + 20; // 20-50%
    if (fps > 30) return Math.random() * 40 + 40; // 40-80%
    return Math.random() * 30 + 70; // 70-100%
  }

  /**
   * テクスチャメモリ推定
   */
  private estimateTextureMemory(): number {
    // TODO: PIXI.Texture統計から計算
    return Math.floor(Math.random() * 200) + 50; // 50-250MB仮値
  }

  /**
   * GPUメモリ推定
   */
  private estimateGPUMemory(): number {
    return this.estimateTextureMemory() * 1.5; // テクスチャ×1.5倍推定
  }

  /**
   * メモリ使用量推定・フォールバック
   */
  private estimateMemoryUsage(): number {
    // DOM要素数・キャンバスサイズから推定
    const elements = document.querySelectorAll('*').length;
    const canvasArea = window.innerWidth * window.innerHeight;
    
    return (elements * 0.1) + (canvasArea / 1000000 * 10); // 概算MB
  }

  /**
   * 性能分析・自動調整判定
   */
  private analyzePerformance(): void {
    const level = this.determinePerformanceLevel();
    const previousLevel = this.getPreviousPerformanceLevel();
    
    // レベル変化時のみ対応
    if (level !== previousLevel) {
      this.handlePerformanceLevelChange(level, previousLevel);
    }
    
    // 警告通知
    this.checkWarningConditions();
  }

  /**
   * 性能レベル判定・段階分類
   */
  private determinePerformanceLevel(): PerformanceLevel {
    const { memoryUsed, currentFPS, cpuUsage } = this.metrics;
    
    // 緊急事態・即座対応
    if (memoryUsed > this.memoryLimits.emergency || currentFPS < 10) {
      return 'emergency';
    }
    
    // 危険・積極的対応
    if (memoryUsed > this.memoryLimits.critical || currentFPS < 20 || cpuUsage > 90) {
      return 'critical';
    }
    
    // 警告・予防的対応
    if (memoryUsed > this.memoryLimits.warning || currentFPS < 40 || cpuUsage > 70) {
      return 'warning';
    }
    
    // 良好・軽微調整
    if (currentFPS > 50 && cpuUsage < 50) {
      return 'optimal';
    }
    
    return 'good';
  }

  /**
   * 前回性能レベル取得
   */
  private getPreviousPerformanceLevel(): PerformanceLevel {
    if (this.metricsHistory.length < 2) return 'good';
    
    const previousMetrics = this.metricsHistory[this.metricsHistory.length - 2];
    const { memoryUsed, currentFPS, cpuUsage } = previousMetrics;
    
    if (memoryUsed > this.memoryLimits.emergency || currentFPS < 10) return 'emergency';
    if (memoryUsed > this.memoryLimits.critical || currentFPS < 20 || cpuUsage > 90) return 'critical';
    if (memoryUsed > this.memoryLimits.warning || currentFPS < 40 || cpuUsage > 70) return 'warning';
    if (currentFPS > 50 && cpuUsage < 50) return 'optimal';
    
    return 'good';
  }

  /**
   * 性能レベル変化処理・自動調整
   */
  private handlePerformanceLevelChange(newLevel: PerformanceLevel, oldLevel: PerformanceLevel): void {
    console.log(`📊 性能レベル変化: ${oldLevel} → ${newLevel}`);
    
    const adjustment = this.performanceAdjustments[newLevel];
    
    // 性能調整イベント発火
    this.eventBus.emit('performance:level-change', {
      level: newLevel,
      previousLevel: oldLevel,
      adjustments: adjustment.adjustments,
      metrics: this.metrics,
      timestamp: performance.now()
    });
    
    // 緊急時・強制GC実行
    if (newLevel === 'emergency' || newLevel === 'critical') {
      this.forceGarbageCollection();
    }
  }

  /**
   * 警告条件チェック・通知発行
   */
  private checkWarningConditions(): void {
    const { memoryUsed, currentFPS, cpuUsage, gpuUsage } = this.metrics;
    
    // メモリ警告
    if (memoryUsed > this.memoryLimits.warning) {
      this.eventBus.emit('performance:warning', {
        used: memoryUsed,
        limit: this.memoryLimits.critical,
        type: 'memory',
        message: `メモリ使用量が ${memoryUsed.toFixed(1)}MB に到達しました`
      });
    }
    
    // FPS警告
    if (currentFPS < 30) {
      this.eventBus.emit('performance:warning', {
        used: currentFPS,
        limit: 60,
        type: 'fps',
        message: `FPSが ${currentFPS.toFixed(1)} に低下しています`
      });
    }
    
    // GPU警告
    if (gpuUsage > 85) {
      this.eventBus.emit('performance:warning', {
        used: gpuUsage,
        limit: 100,
        type: 'gpu',
        message: `GPU使用率が ${gpuUsage.toFixed(1)}% です`
      });
    }
  }

  /**
   * 強制ガベージコレクション・メモリ解放
   */
  private forceGarbageCollection(): void {
    console.log('🗑️ 強制ガベージコレクション実行');
    
    // ブラウザGC強制実行（開発環境）
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // 手動メモリ解放処理
    this.eventBus.emit('performance:force-gc', {
      reason: 'memory-pressure',
      timestamp: performance.now()
    });
  }

  /**
   * ブラウザ対応確認
   */
  private checkBrowserSupport(): void {
    const hasMemoryAPI = !!(performance as any).memory;
    const hasHighResTime = !!performance.now;
    
    console.log('📊 ブラウザ性能API対応:', {
      memoryAPI: hasMemoryAPI,
      highResolutionTime: hasHighResTime,
      userAgent: navigator.userAgent.split(' ').pop()
    });
  }

  /**
   * 空メトリクス作成
   */
  private createEmptyMetrics(): IPerformanceMetrics {
    return {
      currentFPS: 0,
      targetFPS: 60,
      averageFPS: 0,
      frameDrops: 0,
      memoryUsed: 0,
      memoryLimit: this.memoryLimits.critical,
      textureMemory: 0,
      gpuMemory: 0,
      cpuUsage: 0,
      renderTime: 0,
      drawCalls: 0,
      gpuUsage: 0,
      shaderCompilations: 0,
      textureUploads: 0,
      timestamp: performance.now()
    };
  }

  /**
   * 現在メトリクス取得
   */
  public getCurrentMetrics(): IPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * メトリクス履歴取得・グラフ用
   */
  public getMetricsHistory(limit = 60): IPerformanceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * 性能統計取得・分析用
   */
  public getPerformanceStats() {
    if (this.metricsHistory.length === 0) {
      return {
        avgFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        avgMemory: 0,
        maxMemory: 0,
        frameDropRate: 0
      };
    }
    
    const fps = this.metricsHistory.map(m => m.currentFPS);
    const memory = this.metricsHistory.map(m => m.memoryUsed);
    const drops = this.metricsHistory.map(m => m.frameDrops);
    
    return {
      avgFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
      minFPS: Math.min(...fps),
      maxFPS: Math.max(...fps),
      avgMemory: memory.reduce((a, b) => a + b, 0) / memory.length,
      maxMemory: Math.max(...memory),
      frameDropRate: drops.reduce((a, b) => a + b, 0) / drops.length
    };
  }

  /**
   * リソース解放・監視停止
   */
  public destroy(): void {
    console.log('📊 PerformanceManager終了処理開始...');
    
    this.stopMonitoring();
    this.metricsHistory = [];
    this.fpsHistory = [];
    
    console.log('📊 PerformanceManager終了処理完了');
  }
}