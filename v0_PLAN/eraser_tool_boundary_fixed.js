/**
 * 🎯 境界越え消去開始処理（Phase1.4 新機能）
 */
handleBoundaryCrossIn(x, y, eventData) {
    if (!this.isActive) return;
    
    try {
        console.log(`🗑️ 境界越え消去開始: EraserTool at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        
        const pressure = eventData.pressure || 1.0; // 消しゴムは通常フル圧力
        
        // 既存の消去開始メソッドを呼び出し
        this.startErasing(x, y, pressure);
        
        // EventBus通知
        if (this.eventBus) {
            this.eventBus.safeEmit('BOUNDARY_ERASING_STARTED', {
                tool: this.name,
                position: { x, y },
                pressure,
                fromBoundary: true
            });
        }
        
        return true;
        
    } catch (error) {
        console.error(`境界越え消去エラー: ${error.message}`);
        return false;
    }
}