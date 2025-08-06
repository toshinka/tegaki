// src/core/PerformanceManager.ts - 性能監視基盤・メモリ管理・警告システム

import { EventBus } from './EventBus.js';

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  timestamp: number;
}

export interface MemoryInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

export class PerformanceManager {
  private eventBus: EventBus;
  private isMonitoring = false;
  private fpsHistory: number[] = [];
  private readonly targetFPS = 60; // 1_PROJECT_SPEC目標値
  private readonly memoryLimitMB = 1024; // 1GB制限
  private readonly warningMemoryMB = 800; // 警告800MB

  // FPS測定用
  private lastTime = 0;
  private frameCount = 0;
  private fpsInterval: number | null = null;
  private memoryInterval: number | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // 性能監視開始・FPS・メモリ・継続測定
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('PerformanceManager既に監視中');
      return;
    }
    
    this.isMonitoring = true;
    console.log('📊 性能監視開始: 60FPS目標・1GB制限');
    
    this.monitorFrameRate();
    this.monitorMemoryUsage();
  }

  // 性能監視停止・リソース解放
  public stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    
    console.log('📊 性能監視停止');
  }

  // フレームレート監視・60FPS目標・動的調整準備
  private monitorFrameRate(): void {
    this.lastTime = performance.now();
    this.frameCount = 0;

    const measureFPS = (currentTime: number) => {
      this.frameCount++;
      
      if (currentTime - this.lastTime >= 1000) { // 1秒間隔
        const currentFPS = (this.frameCount * 1000) / (currentTime - this.lastTime);
        
        this.fpsHistory.push(currentFPS);
        if (this.fpsHistory.length > 60) this.fpsHistory.shift();

        // 低FPS警告・Phase1基盤・Phase2調整
        if (currentFPS < 30) {
          console.warn(`⚠️ 低FPS警告: ${currentFPS.toFixed(1)}fps`);
          this.eventBus.emit('performance:fps-low', {
            currentFPS,
            targetFPS: this.targetFPS
          });
        }

        this.lastTime = currentTime;
        this.frameCount = 0;
      }

      if (this.isMonitoring) {
        requestAnimationFrame(measureFPS);
      }
    };

    requestAnimationFrame(measureFPS);
  }

  // メモリ監視・Chrome専用・1GB制限・警告通知
  private monitorMemoryUsage(): void {
    const checkMemory = () => {
      try {
        const memory = this.getMemoryInfo();
        if (memory && memory.usedJSHeapSize) {
          const usedMB = memory.usedJSHeapSize / (1024 * 1024);
          
          if (usedMB > this.warningMemoryMB) {
            console.warn(`⚠️ メモリ警告: ${usedMB.toFixed(1)}MB`);
            this.eventBus.emit('performance:memory-warning', {
              used: usedMB,
              limit: this.memoryLimitMB
            });
          }

          // 緊急メモリ解放・1GB超過時
          if (usedMB > this.memoryLimitMB) {
            console.error(`🚨 メモリ限界到達: ${usedMB.toFixed(1)}MB - 緊急処理実行`);
            this.emergencyMemoryCleanup();
          }
        }
      } catch (error) {
        console.warn('メモリ情報取得不可:', error);
      }
    };

    // 5秒間隔でメモリチェック
    this.memoryInterval = window.setInterval(checkMemory, 5000);
    checkMemory(); // 即座に1回実行
  }

  // メモリ情報取得・Chrome/Edge対応
  private getMemoryInfo(): MemoryInfo | null {
    if ('memory' in performance) {
      return (performance as any).memory as MemoryInfo;
    }
    return null;
  }

  // 緊急メモリ解放・1GB超過時・強制GC
  private emergencyMemoryCleanup(): void {
    console.log('🧹 緊急メモリ解放実行中...');
    
    try {
      // ブラウザGC強制実行（開発環境・Chrome DevTools）
      if ('gc' in window) {
        (window as any).gc();
        console.log('✅ 手動GC実行完了');
      }

      // 古いFPS履歴削除
      this.fpsHistory = this.fpsHistory.slice(-30);
      
      console.log('✅ 緊急メモリ解放完了');
    } catch (error) {
      console.error('緊急メモリ解放失敗:', error);
    }
  }

  // 現在FPS取得・UI表示・デバッグ用
  public getCurrentFPS(): number {
    return this.fpsHistory.length > 0 ? this.fpsHistory[this.fpsHistory.length - 1] : 0;
  }

  // 平均FPS取得・性能評価・品質判定
  public getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
  }

  // メモリ使用量取得・MB単位・監視用
  public getMemoryUsage(): number {
    const memory = this.getMemoryInfo();
    if (memory && memory.usedJSHeapSize) {
      return memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  // 現在パフォーマンス取得・デバッグ・調整用
  public getCurrentMetrics(): PerformanceMetrics {
    return {
      fps: this.getCurrentFPS(),
      memoryUsage: this.getMemoryUsage(),
      renderTime: 0, // Phase2実装予定
      timestamp: performance.now()
    };
  }

  // 詳細統計・分析・最適化用
  public getDetailedStats(): {
    fps: { current: number; average: number; min: number; max: number };
    memory: { used: number; limit: number; percentage: number };
    monitoring: { duration: number; samples: number };
  } {
    const fpsMin = this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : 0;
    const fpsMax = this.fpsHistory.length > 0 ? Math.max(...this.fpsHistory) : 0;
    const memoryUsed = this.getMemoryUsage();
    
    return {
      fps: {
        current: this.getCurrentFPS(),
        average: this.getAverageFPS(),
        min: fpsMin,
        max: fpsMax
      },
      memory: {
        used: memoryUsed,
        limit: this.memoryLimitMB,
        percentage: (memoryUsed / this.memoryLimitMB) * 100
      },
      monitoring: {
        duration: this.isMonitoring ? performance.now() - this.lastTime : 0,
        samples: this.fpsHistory.length
      }
    };
  }

  // 性能評価・Tier判定・品質調整用
  public getPerformanceTier(): 'high' | 'medium' | 'low' {
    const avgFPS = this.getAverageFPS();
    const memoryUsage = this.getMemoryUsage();
    
    if (avgFPS >= 55 && memoryUsage < 400) {
      return 'high';
    } else if (avgFPS >= 30 && memoryUsage < 600) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // リソース解放・監視停止・メモリリーク防止
  public destroy(): void {
    this.stopMonitoring();
    this.fpsHistory = [];
    console.log('✅ PerformanceManager破棄完了');
  }
}