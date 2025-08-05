export interface MemoryStatus {
  status: 'normal' | 'warning' | 'critical' | 'unknown';
  used: number;
}

export class PerformanceManager {
  private readonly MAX_MEMORY_MB = 1024;  // 1GB制限・参考資料継承
  private readonly WARNING_MEMORY_MB = 800; // 警告800MB・参考資料継承
  private currentFPS = 0;
  private frameHistory: number[] = [];

  public checkMemoryUsage(): MemoryStatus {
    // Chrome専用・performance.memory利用
    const memory = (performance as any).memory;
    if (!memory) return { status: 'unknown', used: 0 };
    
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    
    if (usedMB > this.MAX_MEMORY_MB) {
      return { status: 'critical', used: usedMB };
    }
    
    if (usedMB > this.WARNING_MEMORY_MB) {
      return { status: 'warning', used: usedMB };
    }
    
    return { status: 'normal', used: usedMB };
  }

  public startFPSMonitoring(): void {
    let lastTime = performance.now();
    
    const monitor = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      this.currentFPS = 1000 / deltaTime;
      
      // FPS履歴管理・移動平均
      this.frameHistory.push(this.currentFPS);
      if (this.frameHistory.length > 60) {
        this.frameHistory.shift();
      }
      
      lastTime = currentTime;
      requestAnimationFrame(monitor);
    };
    
    requestAnimationFrame(monitor);
  }

  public getCurrentFPS(): number {
    return this.currentFPS;
  }

  public getAverageFPS(): number {
    if (this.frameHistory.length === 0) return 0;
    return this.frameHistory.reduce((sum, fps) => sum + fps, 0) / this.frameHistory.length;
  }
}