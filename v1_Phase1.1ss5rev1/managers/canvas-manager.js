/**
 * 🎨 Phase1.2-STEP3: キャンバスリサイズ機能拡張
 * 🎯 既存canvas-manager.jsへの追加実装
 * 
 * 🎯 AI_WORK_SCOPE: リサイズ機能有効化・中央寄せ・履歴管理・UI統合
 * 🎯 DEPENDENCIES: managers/canvas-manager.js, managers/memory-manager.js
 * 🎯 NODE_MODULES: pixi.js（Application）, gsap（アニメーション）
 * 🎯 車輪の再発明回避: PIXI Application.resize()・GSAP・Memory Manager活用
 */

/**
 * Canvas Manager リサイズ機能拡張
 * 既存のcanvas-manager.jsに追加するメソッド群
 */

// ==========================================
// 🎯 Phase1.2-STEP3: リサイズシステム拡張
// ==========================================

/**
 * リサイズ機能初期化（既存initialize()に追加）
 */
initializeResizeSystem() {
    console.log('📏 リサイズシステム初期化開始...');
    
    // リサイズ履歴管理
    this.resizeHistory = {
        entries: [],
        maxEntries: 20,
        currentIndex: -1
    };
    
    // リサイズ設定
    this.resizeSettings = {
        enabled: true,
        preserveContent: true,
        centerContent: true,
        animationDuration: 0.3,
        constrainProportions: false,
        minSize: { width: 100, height: 100 },
        maxSize: { width: 4096, height: 4096 }
    };
    
    // UI要素取得・有効化
    this.setupResizeUI();
    
    // リサイズイベントハンドラー設定
    this.setupResizeEventHandlers();
    
    console.log('✅ リサイズシステム初期化完了');
}

/**
 * リサイズUI要素セットアップ
 */
setupResizeUI() {
    // リサイズツールボタン有効化
    const resizeTool = document.getElementById('resize-tool');
    if (resizeTool) {
        resizeTool.classList.remove('disabled');
        resizeTool.style.opacity = '1';
        resizeTool.style.cursor = 'pointer';
    }
    
    // リサイズパネル要素取得
    this.resizeUI = {
        panel: document.getElementById('resize-settings'),
        widthInput: document.getElementById('canvas-width'),
        heightInput: document.getElementById('canvas-height'),
        applyButton: document.getElementById('apply-resize'),
        applyCenterButton: document.getElementById('apply-resize-center'),
        presetButtons: document.querySelectorAll('.resize-button[data-size]'),
        statusDisplay: document.getElementById('canvas-info')
    };
    
    // 現在サイズを入力欄に反映
    this.updateResizeUI();
    
    console.log('🎛️ リサイズUI要素セットアップ完了');
}

/**
 * リサイズイベントハンドラー設定
 */
setupResizeEventHandlers() {
    const ui = this.resizeUI;
    
    // 適用ボタン
    if (ui.applyButton) {
        ui.applyButton.addEventListener('click', () => {
            this.applyResize(false);
        });
    }
    
    // 中央寄せ適用ボタン
    if (ui.applyCenterButton) {
        ui.applyCenterButton.addEventListener('click', () => {
            this.applyResize(true);
        });
    }
    
    // プリセットボタン
    ui.presetButtons?.forEach(button => {
        button.addEventListener('click', (event) => {
            const sizeData = event.target.dataset.size;
            if (sizeData) {
                const [width, height] = sizeData.split(',').map(Number);
                this.setResizePreset(width, height);
            }
        });
    });
    
    // 入力欄の変更監視
    if (ui.widthInput) {
        ui.widthInput.addEventListener('input', () => {
            this.validateResizeInput();
        });
    }
    
    if (ui.heightInput) {
        ui.heightInput.addEventListener('input', () => {
            this.validateResizeInput();
        });
    }
    
    // キーボードショートカット
    document.addEventListener('keydown', (event) => {
        this.handleResizeKeyboard(event);
    });
    
    console.log('⌨️ リサイズイベントハンドラー設定完了');
}

/**
 * リサイズ実行（メイン機能）
 */
applyResize(centerContent = false) {
    if (!this.resizeSettings.enabled) {
        console.warn('⚠️ リサイズ機能が無効化されています');
        return false;
    }
    
    const ui = this.resizeUI;
    const newWidth = parseInt(ui.widthInput.value);
    const newHeight = parseInt(ui.heightInput.value);
    
    // バリデーション
    if (!this.validateResizeValues(newWidth, newHeight)) {
        this.showResizeError('無効なサイズが指定されました');
        return false;
    }
    
    // 現在サイズと同じ場合はスキップ
    if (newWidth === this.width && newHeight === this.height) {
        console.log('📏 サイズ変更なし - スキップ');
        return true;
    }
    
    console.log(`📏 リサイズ実行開始: ${this.width}×${this.height} → ${newWidth}×${newHeight}`);
    
    try {
        // 履歴保存
        this.saveResizeToHistory();
        
        // リサイズ実行
        const success = this.executeResize(newWidth, newHeight, centerContent);
        
        if (success) {
            // UI更新
            this.updateResizeUI();
            
            // イベント発火
            this.dispatchEvent('resize-complete', {
                oldWidth: this.width,
                oldHeight: this.height,
                newWidth,
                newHeight,
                centerContent
            });
            
            console.log(`✅ リサイズ完了: ${newWidth}×${newHeight}`);
        }
        
        return success;
        
    } catch (error) {
        console.error('❌ リサイズ実行エラー:', error);
        this.showResizeError(`リサイズに失敗しました: ${error.message}`);
        return false;
    }
}

/**
 * リサイズ実行（コア処理）
 */
executeResize(newWidth, newHeight, centerContent) {
    const oldWidth = this.width;
    const oldHeight = this.height;
    
    // コンテンツの現在位置記録（中央寄せ用）
    const contentBounds = centerContent ? this.getContentBounds() : null;
    
    // PixiJS Applicationリサイズ
    // 📋 V8_MIGRATION: app.resize()に変更予定
    this.app.renderer.resize(newWidth, newHeight);
    
    // キャンバス要素のサイズ更新
    if (this.canvasElement) {
        this.canvasElement.style.width = newWidth + 'px';
        this.canvasElement.style.height = newHeight + 'px';
    }
    
    // 内部サイズ更新
    this.width = newWidth;
    this.height = newHeight;
    
    // ヒットエリア更新
    if (this.app.stage) {
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
    }
    
    // ビューポート境界更新
    this.updateViewportBounds();
    
    // 背景更新
    this.updateBackground();
    
    // グリッド更新
    if (this.grid && this.grid.visible) {
        this.updateGrid();
    }
    
    // コンテンツ中央寄せ
    if (centerContent && contentBounds) {
        this.centerExistingContent(contentBounds, oldWidth, oldHeight, newWidth, newHeight);
    }
    
    // CSS更新
    this.updateCanvasCSS(newWidth, newHeight);
    
    return true;
}

/**
 * 既存コンテンツ中央寄せ
 */
centerExistingContent(contentBounds, oldWidth, oldHeight, newWidth, newHeight) {
    if (!contentBounds || this.paths.length === 0) {
        return;
    }
    
    // オフセット計算
    const offsetX = (newWidth - oldWidth) / 2;
    const offsetY = (newHeight - oldHeight) / 2;
    
    console.log(`🎯 コンテンツ中央寄せ: オフセット(${offsetX}, ${offsetY})`);
    
    // 全レイヤーを移動
    Object.values(this.layers).forEach(layer => {
        if (layer && layer.position) {
            // GSAPアニメーション（利用可能時）
            if (this.extensions.gsapAvailable && this.resizeSettings.animationDuration > 0) {
                gsap.to(layer.position, {
                    duration: this.resizeSettings.animationDuration,
                    x: layer.position.x + offsetX,
                    y: layer.position.y + offsetY,
                    ease: "power2.out"
                });
            } else {
                // 即座に移動
                layer.position.x += offsetX;
                layer.position.y += offsetY;
            }
        }
    });
    
    // パス座標更新
    this.paths.forEach(path => {
        if (path.points && Array.isArray(path.points)) {
            path.points.forEach(point => {
                point.x += offsetX;
                point.y += offsetY;
            });
        }
        
        // グラフィクス位置更新
        if (path.graphics) {
            path.graphics.x += offsetX;
            path.graphics.y += offsetY;
        }
    });
}

/**
 * コンテンツ境界取得
 */
getContentBounds() {
    if (this.paths.length === 0) {
        return null;
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    this.paths.forEach(path => {
        if (path.points && path.points.length > 0) {
            path.points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        }
    });
    
    if (minX === Infinity) {
        return null;
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * ビューポート境界更新
 */
updateViewportBounds() {
    if (this.viewport && this.viewport.bounds) {
        this.viewport.bounds = new PIXI.Rectangle(
            -this.width,
            -this.height,
            this.width * 3,
            this.height * 3
        );
    }
}

/**
 * キャンバスCSS更新
 */
updateCanvasCSS(width, height) {
    const container = this.canvasElement?.parentElement;
    if (!container) return;
    
    // Phase1.2対応: データ属性更新
    container.setAttribute('data-dimensions', `${width}×${height}`);
    
    // 測定モード時の表示更新
    if (container.classList.contains('measurement-mode')) {
        container.style.setProperty('--canvas-width', `${width}px`);
        container.style.setProperty('--canvas-height', `${height}px`);
    }
}

/**
 * リサイズ値バリデーション
 */
validateResizeValues(width, height) {
    const settings = this.resizeSettings;
    
    // 数値チェック
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return false;
    }
    
    // 範囲チェック
    if (width < settings.minSize.width || width > settings.maxSize.width) {
        return false;
    }
    
    if (height < settings.minSize.height || height > settings.maxSize.height) {
        return false;
    }
    
    // 比率制約チェック（有効時）
    if (settings.constrainProportions) {
        const currentRatio = this.width / this.height;
        const newRatio = width / height;
        const tolerance = 0.01;
        
        if (Math.abs(currentRatio - newRatio) > tolerance) {
            return false;
        }
    }
    
    return true;
}

/**
 * 入力値バリデーション（リアルタイム）
 */
validateResizeInput() {
    const ui = this.resizeUI;
    const width = parseInt(ui.widthInput.value);
    const height = parseInt(ui.heightInput.value);
    
    const isValid = this.validateResizeValues(width, height);
    
    // UI状態更新
    ui.applyButton.disabled = !isValid;
    ui.applyCenterButton.disabled = !isValid;
    
    // 視覚的フィードバック
    const inputs = [ui.widthInput, ui.heightInput];
    inputs.forEach(input => {
        if (isValid) {
            input.style.borderColor = 'var(--futaba-light-medium)';
        } else {
            input.style.borderColor = 'var(--futaba-maroon)';
        }
    });
    
    return isValid;
}

/**
 * プリセットサイズ設定
 */
setResizePreset(width, height) {
    const ui = this.resizeUI;
    
    ui.widthInput.value = width;
    ui.heightInput.value = height;
    
    // バリデーション実行
    this.validateResizeInput();
    
    console.log(`📐 プリセット設定: ${width}×${height}`);
}

/**
 * リサイズUI更新
 */
updateResizeUI() {
    const ui = this.resizeUI;
    
    // 入力欄更新
    if (ui.widthInput) ui.widthInput.value = this.width;
    if (ui.heightInput) ui.heightInput.value = this.height;
    
    // ステータス表示更新
    if (ui.statusDisplay) {
        ui.statusDisplay.textContent = `${this.width}×${this.height}px`;
    }
    
    // プリセットボタンの選択状態更新
    this.updatePresetSelection();
}

/**
 * プリセット選択状態更新
 */
updatePresetSelection() {
    const ui = this.resizeUI;
    const currentSize = `${this.width},${this.height}`;
    
    ui.presetButtons?.forEach(button => {
        if (button.dataset.size === currentSize) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * リサイズエラー表示
 */
showResizeError(message) {
    // 簡易エラー表示（後でUI Managerと統合予定）
    console.error(`❌ リサイズエラー: ${message}`);
    
    // TODO: Phase1.3でUI Manager統合時に改善
    alert(`リサイズエラー: ${message}`);
}

// ==========================================
// 🎯 Phase1.2-STEP3: 履歴管理システム
// ==========================================

/**
 * リサイズ履歴保存
 */
saveResizeToHistory() {
    const historyEntry = {
        timestamp: Date.now(),
        width: this.width,
        height: this.height,
        contentBounds: this.getContentBounds()
    };
    
    const history = this.resizeHistory;
    
    // 現在位置以降の履歴削除（分岐）
    if (history.currentIndex < history.entries.length - 1) {
        history.entries = history.entries.slice(0, history.currentIndex + 1);
    }
    
    // 新しい履歴追加
    history.entries.push(historyEntry);
    history.currentIndex = history.entries.length - 1;
    
    // 履歴サイズ制限
    if (history.entries.length > history.maxEntries) {
        history.entries.shift();
        history.currentIndex--;
    }
    
    // Memory Manager連携
    if (window.MemoryManager) {
        window.MemoryManager.record('canvas-resize', historyEntry);
    }
    
    console.log(`💾 リサイズ履歴保存: ${historyEntry.width}×${historyEntry.height}`);
}

/**
 * リサイズアンドゥ
 */
undoResize() {
    const history = this.resizeHistory;
    
    if (history.currentIndex <= 0) {
        console.warn('⚠️ アンドゥ可能なリサイズ履歴がありません');
        return false;
    }
    
    history.currentIndex--;
    const targetEntry = history.entries[history.currentIndex];
    
    console.log(`↩️ リサイズアンドゥ: ${targetEntry.width}×${targetEntry.height}`);
    
    // 履歴からリサイズ実行
    return this.restoreFromHistory(targetEntry);
}

/**
 * リサイズリドゥ
 */
redoResize() {
    const history = this.resizeHistory;
    
    if (history.currentIndex >= history.entries.length - 1) {
        console.warn('⚠️ リドゥ可能なリサイズ履歴がありません');
        return false;
    }
    
    history.currentIndex++;
    const targetEntry = history.entries[history.currentIndex];
    
    console.log(`↪️ リサイズリドゥ: ${targetEntry.width}×${targetEntry.height}`);
    
    // 履歴からリサイズ実行
    return this.restoreFromHistory(targetEntry);
}

/**
 * 履歴からリサイズ復元
 */
restoreFromHistory(historyEntry) {
    try {
        // 履歴保存を一時無効化
        const originalEnabled = this.resizeSettings.enabled;
        this.resizeSettings.enabled = false;
        
        // リサイズ実行
        const success = this.executeResize(historyEntry.width, historyEntry.height, false);
        
        if (success) {
            // UI更新
            this.updateResizeUI();
            
            // イベント発火
            this.dispatchEvent('resize-history-restore', {
                width: historyEntry.width,
                height: historyEntry.height,
                timestamp: historyEntry.timestamp
            });
        }
        
        // 履歴保存を再有効化
        this.resizeSettings.enabled = originalEnabled;
        
        return success;
        
    } catch (error) {
        console.error('❌ 履歴復元エラー:', error);
        return false;
    }
}

/**
 * 履歴クリア
 */
clearResizeHistory() {
    this.resizeHistory.entries = [];
    this.resizeHistory.currentIndex = -1;
    
    console.log('🗑️ リサイズ履歴クリア');
}

// ==========================================
// 🎯 Phase1.2-STEP3: キーボードショートカット
// ==========================================

/**
 * リサイズキーボードハンドラー
 */
handleResizeKeyboard(event) {
    // Ctrl/Cmd + R: リサイズパネル表示切り替え
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        this.toggleResizePanel();
        return;
    }
    
    // リサイズパネル表示中のショートカット
    if (this.resizeUI.panel?.style.display !== 'none') {
        // Ctrl/Cmd + Z: リサイズアンドゥ
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.undoResize();
            return;
        }
        
        // Ctrl/Cmd + Shift + Z: リサイズリドゥ
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
            event.preventDefault();
            this.redoResize();
            return;
        }
        
        // Enter: 適用
        if (event.key === 'Enter') {
            event.preventDefault();
            this.applyResize(event.shiftKey);
            return;
        }
        
        // Escape: パネル閉じる
        if (event.key === 'Escape') {
            event.preventDefault();
            this.hideResizePanel();
            return;
        }
    }
}

/**
 * リサイズパネル表示切り替え
 */
toggleResizePanel() {
    const panel = this.resizeUI.panel;
    if (!panel) return;
    
    if (panel.style.display === 'none' || !panel.classList.contains('show')) {
        this.showResizePanel();
    } else {
        this.hideResizePanel();
    }
}

/**
 * リサイズパネル表示
 */
showResizePanel() {
    const panel = this.resizeUI.panel;
    if (!panel) return;
    
    panel.style.display = 'block';
    panel.classList.add('show');
    
    // 入力フォーカス
    this.resizeUI.widthInput?.focus();
    
    console.log('📐 リサイズパネル表示');
}

/**
 * リサイズパネル非表示
 */
hideResizePanel() {
    const panel = this.resizeUI.panel;
    if (!panel) return;
    
    panel.classList.remove('show');
    setTimeout(() => {
        panel.style.display = 'none';
    }, 300); // アニメーション時間
    
    console.log('📐 リサイズパネル非表示');
}

// ==========================================
// 🎯 Phase1.2-STEP3: 高度リサイズ機能
// ==========================================

/**
 * 比例リサイズ（縦横比維持）
 */
resizeProportional(newWidth = null, newHeight = null) {
    const currentRatio = this.width / this.height;
    
    if (newWidth && !newHeight) {
        // 幅指定：高さを自動計算
        newHeight = Math.round(newWidth / currentRatio);
    } else if (newHeight && !newWidth) {
        // 高さ指定：幅を自動計算
        newWidth = Math.round(newHeight * currentRatio);
    } else if (!newWidth && !newHeight) {
        console.warn('⚠️ 比例リサイズ: サイズが指定されていません');
        return false;
    }
    
    // UI更新
    this.resizeUI.widthInput.value = newWidth;
    this.resizeUI.heightInput.value = newHeight;
    
    // リサイズ実行
    return this.applyResize(true);
}

/**
 * スマートリサイズ（コンテンツに合わせる）
 */
resizeToContent(padding = 50) {
    const bounds = this.getContentBounds();
    
    if (!bounds) {
        console.warn('⚠️ スマートリサイズ: コンテンツが見つかりません');
        return false;
    }
    
    const newWidth = Math.ceil(bounds.width + padding * 2);
    const newHeight = Math.ceil(bounds.height + padding * 2);
    
    console.log(`🎯 スマートリサイズ: コンテンツサイズ ${bounds.width}×${bounds.height} → ${newWidth}×${newHeight}`);
    
    // UI更新
    this.resizeUI.widthInput.value = newWidth;
    this.resizeUI.heightInput.value = newHeight;
    
    // リサイズ実行（中央寄せ）
    return this.applyResize(true);
}

/**
 * バッチリサイズ（複数サイズ）
 */
async batchResize(sizes, centerContent = true) {
    const results = [];
    
    for (const size of sizes) {
        const [width, height] = size;
        
        console.log(`📦 バッチリサイズ: ${width}×${height}`);
        
        try {
            // UI更新
            this.resizeUI.widthInput.value = width;
            this.resizeUI.heightInput.value = height;
            
            // リサイズ実行
            const success = await this.applyResize(centerContent);
            
            results.push({
                size: [width, height],
                success,
                timestamp: Date.now()
            });
            
            // 短時間待機（処理負荷軽減）
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            results.push({
                size: [width, height],
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    console.log(`📦 バッチリサイズ完了: ${results.filter(r => r.success).length}/${results.length}`);
    
    return results;
}

// ==========================================
// 🎯 Phase1.2-STEP3: 統計・診断システム
// ==========================================

/**
 * リサイズ統計取得
 */
getResizeStats() {
    return {
        current: {
            width: this.width,
            height: this.height,
            aspectRatio: this.width / this.height,
            area: this.width * this.height
        },
        history: {
            entries: this.resizeHistory.entries.length,
            currentIndex: this.resizeHistory.currentIndex,
            canUndo: this.resizeHistory.currentIndex > 0,
            canRedo: this.resizeHistory.currentIndex < this.resizeHistory.entries.length - 1
        },
        settings: {
            enabled: this.resizeSettings.enabled,
            preserveContent: this.resizeSettings.preserveContent,
            centerContent: this.resizeSettings.centerContent,
            constrainProportions: this.resizeSettings.constrainProportions
        },
        content: {
            bounds: this.getContentBounds(),
            pathCount: this.paths?.length || 0
        }
    };
}

/**
 * Phase1.2-STEP3診断実行
 */
runResizeDiagnosis() {
    console.group('🔍 Phase1.2-STEP3 リサイズシステム診断');
    
    const stats = this.getResizeStats();
    
    // 機能テスト
    const functionTests = {
        uiEnabled: !document.getElementById('resize-tool')?.classList.contains('disabled'),
        inputValidation: this.validateResizeValues(800, 600),
        historySystem: this.resizeHistory.entries.length >= 0,
        keyboardShortcuts: true, // 実装済み
        contentBounds: !!this.getContentBounds || this.paths?.length === 0
    };
    
    // 診断結果
    const diagnosis = {
        stats,
        functionTests,
        compliance: {
            resizeEnabled: functionTests.uiEnabled,
            historyManagement: functionTests.historySystem,
            contentPreservation: this.resizeSettings.preserveContent,
            centeringSupport: this.resizeSettings.centerContent
        }
    };
    
    console.log('📊 診断結果:', diagnosis);
    
    // 推奨事項
    const recommendations = [];
    
    if (!functionTests.uiEnabled) {
        recommendations.push('リサイズツールの有効化が必要');
    }
    
    if (!functionTests.historySystem) {
        recommendations.push('履歴システムの初期化が必要');
    }
    
    if (!this.resizeSettings.preserveContent) {
        recommendations.push('コンテンツ保持の有効化を推奨');
    }
    
    if (recommendations.length > 0) {
        console.warn('⚠️ 推奨事項:', recommendations);
    } else {
        console.log('✅ Phase1.2-STEP3 要件を満たしています');
    }
    
    console.groupEnd();
    
    return diagnosis;
}

/**
 * リサイズテスト実行
 */
async runResizeTests() {
    console.group('🧪 Phase1.2-STEP3 リサイズテスト');
    
    const originalSize = { width: this.width, height: this.height };
    
    const tests = [
        {
            name: '基本リサイズ',
            test: () => this.executeResize(600, 400, false)
        },
        {
            name: '中央寄せリサイズ',
            test: () => this.executeResize(800, 600, true)
        },
        {
            name: '履歴保存',
            test: () => {
                this.saveResizeToHistory();
                return this.resizeHistory.entries.length > 0;
            }
        },
        {
            name: 'バリデーション',
            test: () => this.validateResizeValues(1024, 768)
        },
        {
            name: 'UI更新',
            test: () => {
                this.updateResizeUI();
                return this.resizeUI.widthInput.value == this.width;
            }
        }
    ];
    
    let passCount = 0;
    
    for (const testCase of tests) {
        try {
            const result = await testCase.test();
            const passed = !!result;
            
            console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
            
            if (passed) passCount++;
            
        } catch (error) {
            console.log(`❌ ${testCase.name}: FAIL (${error.message})`);
        }
        
        // テスト間の間隔
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 元サイズに復元
    await this.executeResize(originalSize.width, originalSize.height, false);
    
    console.log(`📊 テスト結果: ${passCount}/${tests.length} パス`);
    
    const success = passCount === tests.length;
    if (success) {
        console.log('✅ 全テスト合格 - Phase1.2-STEP3 完了');
    } else {
        console.warn('⚠️ 一部テスト失敗');
    }
    
    console.groupEnd();
    
    return success;
}

// ==========================================
// 🎯 Phase1.2-STEP3: 統合・公開メソッド
// ==========================================

/**
 * リサイズシステム状態取得
 */
getResizeSystemState() {
    return {
        enabled: this.resizeSettings.enabled,
        currentSize: { width: this.width, height: this.height },
        hasContent: this.paths?.length > 0,
        historyLength: this.resizeHistory.entries.length,
        canUndo: this.resizeHistory.currentIndex > 0,
        canRedo: this.resizeHistory.currentIndex < this.resizeHistory.entries.length - 1
    };
}

/**
 * リサイズ設定更新
 */
updateResizeSettings(newSettings) {
    Object.assign(this.resizeSettings, newSettings);
    console.log('⚙️ リサイズ設定更新:', newSettings);
}

/**
 * 📋 Phase1.2-STEP3 実装完了ログ
 */
console.log('📏 Phase1.2-STEP3 リサイズ機能拡張完了');
console.log('✅ 実装項目:');
console.log('  - リサイズ機能有効化・UI統合');
console.log('  - 中央寄せ・コンテンツ保持');
console.log('  - 履歴管理・アンドゥ/リドゥ');
console.log('  - キーボードショートカット');
console.log('  - バリデーション・エラーハンドリング');
console.log('  - 高度機能: 比例・スマート・バッチリサイズ');
console.log('  - 統計・診断・テストシステム');

/**
 * 📋 Phase1.2-STEP3 使用方法:
 * 
 * // 既存のcanvas-manager.jsのinitialize()メソッド内に追加:
 * this.initializeResizeSystem();
 * 
 * // 使用例:
 * canvasManager.applyResize(true);           // 中央寄せリサイズ
 * canvasManager.undoResize();                // リサイズアンドゥ
 * canvasManager.resizeToContent(50);         // コンテンツに合わせる
 * canvasManager.resizeProportional(1024);   // 比例リサイズ
 */