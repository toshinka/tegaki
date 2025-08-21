/**
 * 🛠️ MODIFIED: PixiJSアプリケーション初期化（倍サイズ問題対応版）
 * ISSUE: 400×400設定が800×800で表示される問題を修正
 * SOLUTION: Canvas DOM要素のサイズを明示的に設定
 */
async initializePixiApp() {
    try {
        const canvasConfig = this.configManager.getCanvasConfig();
        const pixiConfig = this.configManager.getPixiConfig();
        
        console.log(`🎨 PixiJS初期化開始: ${canvasConfig.width}×${canvasConfig.height}px`);
        
        // 🛠️ MODIFIED: DPI補償処理を完全削除
        this.app = new PIXI.Application({
            width: canvasConfig.width,
            height: canvasConfig.height,
            backgroundColor: canvasConfig.backgroundColor,
            antialias: pixiConfig.antialias,
            resolution: 1, // MODIFIED: 固定値1（devicePixelRatio使用せず）
            autoDensity: false // MODIFIED: 高DPI自動調整を明示的に無効化
        });
        // REASON: Phase2レイヤー実装の複雑性削減、ふたばちゃんねる投稿対策
        // V8_READY: PixiJSv8移行時に再検討
        
        // Canvas要素を取得または作成
        let canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            // drawing-canvas が存在しない場合は canvas-container を使用
            const container = document.getElementById('canvas-container') || 
                             document.querySelector('.canvas-container');
            if (container) {
                // 既存の内容をクリア
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
                canvasElement = container;
            } else {
                throw new Error('Canvas container element not found');
            }
        }
        
        // PixiJS Canvas要素をコンテナに追加
        canvasElement.appendChild(this.app.view);
        
        // 🛠️ MODIFIED: Canvas DOM要素のサイズを明示的に設定（倍サイズ問題対応）
        // REASON: 高DPI対応除去により、設定値とDOM表示を1:1対応に統一
        this.app.view.style.width = `${canvasConfig.width}px`;
        this.app.view.style.height = `${canvasConfig.height}px`;
        
        // 🛠️ ADDED: Canvas要素のHTML属性も明示設定
        // REASON: 内部解像度とDOM表示サイズの不一致を防止
        this.app.view.width = canvasConfig.width;
        this.app.view.height = canvasConfig.height;
        
        // 🛠️ ADDED: Container自体のサイズも統一
        const container = canvasElement.parentElement || canvasElement;
        if (container && container !== document.body) {
            container.style.width = `${canvasConfig.width}px`;
            container.style.height = `${canvasConfig.height}px`;
            
            // デバッグ情報をdata属性として設定
            container.setAttribute('data-dimensions', `${canvasConfig.width}×${canvasConfig.height}`);
            container.setAttribute('data-expected-size', `${canvasConfig.width}×${canvasConfig.height}`);
        }
        
        // Canvas要素の基本設定
        this.app.view.style.cursor = pixiConfig.cursor || 'crosshair';
        this.app.view.style.touchAction = 'none'; // タッチスクロール防止
        this.app.view.id = 'main-canvas'; // ID設定
        
        // 🛠️ ADDED: 倍率補正防止の追加設定
        this.app.view.style.transform = 'none';
        this.app.view.style.zoom = '1';
        this.app.view.style.objectFit = 'none';
        
        // 🛠️ ADDED: サイズ検証とデバッグ情報
        this.validateCanvasSize(canvasConfig.width, canvasConfig.height);
        
        console.log('✅ PixiJSアプリケーション初期化完了（倍サイズ問題対応版）');
        console.log(`📐 設定サイズ: ${canvasConfig.width}×${canvasConfig.height}px`);
        console.log(`📐 Canvas DOM: ${this.app.view.clientWidth}×${this.app.view.clientHeight}px`);
        console.log(`📐 Canvas属性: ${this.app.view.width}×${this.app.view.height}px`);
        console.log(`📐 Resolution: ${this.app.renderer.resolution} (固定)`);
        
    } catch (error) {
        console.error('❌ PixiJSアプリケーション初期化失敗:', error);
        throw error;
    }
}

/**
 * 🛠️ NEW: Canvasサイズ検証メソッド（倍サイズ問題診断）
 * PURPOSE: 設定値とDOM表示サイズの一致確認・不一致警告
 */
validateCanvasSize(expectedWidth, expectedHeight) {
    try {
        const canvas = this.app.view;
        const container = canvas.parentElement;
        
        const actualWidth = canvas.clientWidth;
        const actualHeight = canvas.clientHeight;
        const styleWidth = parseInt(canvas.style.width) || 0;
        const styleHeight = parseInt(canvas.style.height) || 0;
        const attrWidth = canvas.width;
        const attrHeight = canvas.height;
        
        const validation = {
            expected: { width: expectedWidth, height: expectedHeight },
            actual: { width: actualWidth, height: actualHeight },
            style: { width: styleWidth, height: styleHeight },
            attribute: { width: attrWidth, height: attrHeight },
            container: container ? {
                width: container.clientWidth,
                height: container.clientHeight
            } : null
        };
        
        // サイズ一致確認
        const isConsistent = (
            expectedWidth === actualWidth &&
            expectedHeight === actualHeight &&
            expectedWidth === styleWidth &&
            expectedHeight === styleHeight &&
            expectedWidth === attrWidth &&
            expectedHeight === attrHeight
        );
        
        // コンテナサイズも確認
        const containerConsistent = !container || (
            expectedWidth === container.clientWidth &&
            expectedHeight === container.clientHeight
        );
        
        validation.isConsistent = isConsistent && containerConsistent;
        
        // デバッグ情報をコンテナに設定
        if (container) {
            container.setAttribute('data-actual-size', `${actualWidth}×${actualHeight}`);
            container.setAttribute('data-size-mismatch', (!validation.isConsistent).toString());
            
            if (this.configManager && typeof this.configManager.get === 'function') {
                const debugMode = this.configManager.get('canvas.debugSize', false);
                container.setAttribute('data-debug-size', debugMode.toString());
            }
        }
        
        // 結果ログ出力
        if (validation.isConsistent) {
            console.log('✅ Canvasサイズ検証: 一致');
        } else {
            console.warn('⚠️ Canvasサイズ不一致検出:', validation);
            
            // ErrorManager経由で警告
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', 
                    `Canvasサイズ不一致: 期待値${expectedWidth}×${expectedHeight}、実際${actualWidth}×${actualHeight}`, 
                    { additionalInfo: 'Canvas初期化', validation }
                );
            }
        }
        
        return validation;
        
    } catch (error) {
        console.error('❌ Canvasサイズ検証エラー:', error);
        return null;
    }
}

/**
 * 🛠️ MODIFIED: キャンバスリサイズ（倍サイズ問題対応版）
 */
resize(newWidth, newHeight, centerContent = false) {
    if (!this.app) {
        console.warn('⚠️ PixiJSアプリが初期化されていません');
        return;
    }
    
    try {
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        console.log(`📐 キャンバスリサイズ開始: ${oldWidth}×${oldHeight} → ${newWidth}×${newHeight}`);
        
        // ConfigManager経由での妥当性確認
        const canvasConfig = this.configManager.getCanvasConfig();
        const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
        const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
        
        this.canvasWidth = validWidth;
        this.canvasHeight = validHeight;
        
        // 座標管理システム更新
        if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
            this.coordinateManager.updateCanvasSize(validWidth, validHeight);
        }
        
        // 🛠️ MODIFIED: アプリケーションリサイズ（DPI考慮なし・DOM要素同期）
        this.app.renderer.resize(validWidth, validHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
        
        // 🛠️ ADDED: Canvas DOM要素のサイズを同期更新（倍サイズ問題対応）
        this.app.view.style.width = `${validWidth}px`;
        this.app.view.style.height = `${validHeight}px`;
        this.app.view.width = validWidth;
        this.app.view.height = validHeight;
        
        // 🛠️ ADDED: Container サイズも同期更新
        const container = this.app.view.parentElement;
        if (container && container !== document.body) {
            container.style.width = `${validWidth}px`;
            container.style.height = `${validHeight}px`;
            
            // デバッグ情報更新
            container.setAttribute('data-dimensions', `${validWidth}×${validHeight}`);
            container.setAttribute('data-expected-size', `${validWidth}×${validHeight}`);
        }
        
        // 境界管理システム更新
        if (this.boundaryManager && typeof this.boundaryManager.createExpandedHitArea === 'function') {
            this.boundaryManager.createExpandedHitArea();
        }
        
        // 🛠️ ADDED: リサイズ後のサイズ検証
        this.validateCanvasSize(validWidth, validHeight);
        
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit('canvas.resized', {
                width: validWidth,
                height: validHeight,
                previousWidth: oldWidth,
                previousHeight: oldHeight,
                dpiCompensation: false, // 倍率補正なし
                timestamp: Date.now()
            });
        }
        
        console.log(`✅ キャンバスリサイズ完了: ${validWidth}×${validHeight} (DPI補償なし)`);
        
    } catch (error) {
        if (this.errorManager && typeof this.errorManager.showError === 'function') {
            this.errorManager.showError('error', 
                `キャンバスリサイズエラー: ${error.message}`, 
                { additionalInfo: 'キャンバスリサイズ', newWidth, newHeight }
            );
        }
    }
}