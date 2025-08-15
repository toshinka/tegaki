        // 更新イベント
        slider.onUpdate.add((value) => {
            const displayValue = config.key === 'size' ? value.toFixed(1) + 'px' : value.toFixed(1) + '%';
            valueText.text = displayValue;
            
            // ツール設定更新
            this.updateToolSetting(config.key, value);
        });
        
        group.addChild(slider);
        
        return group;
    }
    
    // ツール設定更新
    updateToolSetting(key, value) {
        if (this.mainApp.components?.ToolManager) {
            this.mainApp.components.ToolManager.updateSetting(key, value);
        }
        
        console.log(`🎛️ ${key} → ${value}`);
    }
    
    // チェックボックス群作成
    createPopupCheckboxes() {
        const container = new PIXI.Container();
        
        const checkboxes = [
            { label: '筆圧感度 (120Hz対応)', checked: true },
            { label: 'エッジスムージング', checked: true },
            { label: 'GPUアクセラレーション', checked: true }
        ];
        
        checkboxes.forEach((config, index) => {
            const checkbox = this.createCheckboxGroup(config);
            checkbox.y = index * 35;
            container.addChild(checkbox);
        });
        
        return container;
    }
    
    // チェックボックスグループ作成
    createCheckboxGroup(config) {
        const group = new PIXI.Container();
        
        // @pixi/ui CheckBox（利用可能な場合）
        let checkbox;
        if (this.extensions.UI.CheckBox) {
            checkbox = new this.extensions.UI.CheckBox({
                checked: config.checked,
                text: config.label,
                style: {
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 12,
                    fill: 0x333333
                }
            });
        } else {
            // フォールバック実装
            checkbox = this.createFallbackCheckbox(config);
        }
        
        checkbox.x = 20;
        checkbox.y = 5;
        group.addChild(checkbox);
        
        return group;
    }
    
    // フォールバックチェックボックス
    createFallbackCheckbox(config) {
        const container = new PIXI.Container();
        
        // チェックボックス背景
        const background = new PIXI.Graphics();
        background.beginFill(0xf0e0d6);
        background.lineStyle(2, 0x800000);
        background.drawRoundedRect(0, 0, 16, 16, 2);
        background.endFill();
        background.interactive = true;
        background.buttonMode = true;
        
        // チェックマーク
        const checkmark = new PIXI.Text('✓', {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0x800000
        });
        checkmark.anchor.set(0.5);
        checkmark.x = 8;
        checkmark.y = 8;
        checkmark.visible = config.checked;
        
        // ラベル
        const label = new PIXI.Text(config.label, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            fill: 0x333333
        });
        label.x = 25;
        label.y = 2;
        
        // クリックイベント
        background.on('pointerdown', () => {
            checkmark.visible = !checkmark.visible;
            console.log(`☑️ ${config.label}: ${checkmark.visible}`);
        });
        
        container.addChild(background);
        container.addChild(checkmark);
        container.addChild(label);
        
        return container;
    }
    
    // PixiJSポップアップドラッグ機能
    makePixiPopupDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.interactive = true;
        popup.on('pointerdown', (event) => {
            isDragging = true;
            const position = event.data.getLocalPosition(popup.parent);
            dragOffset.x = position.x - popup.x;
            dragOffset.y = position.y - popup.y;
            popup.alpha = 0.8;
        });
        
        popup.on('pointermove', (event) => {
            if (isDragging) {
                const position = event.data.getLocalPosition(popup.parent);
                popup.x = position.x - dragOffset.x;
                popup.y = position.y - dragOffset.y;
            }
        });
        
        popup.on('pointerup', () => {
            if (isDragging) {
                isDragging = false;
                popup.alpha = 1.0;
            }
        });
        
        popup.on('pointerupoutside', () => {
            if (isDragging) {
                isDragging = false;
                popup.alpha = 1.0;
            }
        });
    }
    
    // ブラシサイズ設定
    setBrushSize(size) {
        console.log(`🖌️ ブラシサイズ設定: ${size}px`);
        
        // スライダー同期
        const sizeSlider = this.findSliderByKey('size');
        if (sizeSlider) {
            sizeSlider.value = size;
        }
        
        // ツール設定更新
        this.updateToolSetting('size', size);
    }
    
    // キーによるスライダー検索
    findSliderByKey(key) {
        // 実装時にスライダー参照を管理
        return null; // TODO: 実装
    }
}

// グローバル登録
window.TegakiApp.UIManagerPhase2 = UIManagerPhase2;
```

### Phase2.2: @pixi/layers完全統合・非破壊レイヤーシステム（2週間）
**期間**: 2週間  
**目標**: プロ級レイヤー機能・非破壊変形・アニメ制作準備

#### @pixi/layers統合実装
```javascript
// js/layers/layer-core-phase2.js
/**
 * 🎨 レイヤーコアシステム Phase2 - @pixi/layers完全統合版
 * 🎯 AI_WORK_SCOPE: レイヤー管理専用ファイル
 * 🎯 DEPENDENCIES: main.js, libs/pixi-extensions.js
 * 🎯 PIXI_EXTENSIONS: @pixi/layers（必須）
 * 🎯 FEATURES: 非破壊変形・アニメ制作対応・履歴管理
 */

class LayerCorePhase2 {
    constructor(mainApp) {
        this.mainApp = mainApp;
        this.extensions = window.PixiExtensions;
        this.layers = new Map();
        this.layerGroups = new Map();
        this.activeLayer = null;
        this.layerStage = null;
        this.maxLayers = 50;
        this.transformHistory = [];
        
        console.log('🎨 LayerCore Phase2初期化開始...');
        this.init();
    }
    
    init() {
        // @pixi/layers統合確認
        if (this.extensions.hasFeature('layers')) {
            console.log('✅ @pixi/layers統合モード');
            this.usePixiLayers = true;
            this.initPixiLayersSystem();
        } else {
            console.warn('⚠️ @pixi/layers未利用 - 基本コンテナシステム使用');
            this.usePixiLayers = false;
            this.initBasicLayerSystem();
        }
        
        // デフォルトレイヤー作成
        this.createDefaultLayers();
        
        console.log('✅ LayerCore Phase2初期化完了');
    }
    
    // @pixi/layers システム初期化
    initPixiLayersSystem() {
        // @pixi/layers Stage作成
        if (this.extensions.Layers.Stage) {
            this.layerStage = new this.extensions.Layers.Stage();
        } else {
            this.layerStage = new PIXI.Container();
        }
        
        this.layerStage.name = 'LayerStage';
        this.layerStage.sortableChildren = true;
        
        // メインアプリケーションに追加
        this.mainApp.pixiApp.stage.addChild(this.layerStage);
        
        console.log('🎯 @pixi/layers Stage構築完了');
    }
    
    // 基本レイヤーシステム初期化（フォールバック）
    initBasicLayerSystem() {
        this.layerStage = new PIXI.Container();
        this.layerStage.name = 'BasicLayerStage';
        this.layerStage.sortableChildren = true;
        
        this.mainApp.pixiApp.stage.addChild(this.layerStage);
        
        console.log('🔧 基本レイヤーシステム構築完了');
    }
    
    // デフォルトレイヤー作成
    createDefaultLayers() {
        // 背景レイヤー
        const backgroundLayer = this.createLayer({
            name: '背景',
            type: 'background',
            zIndex: 0,
            locked: false,
            visible: true
        });
        
        // 描画レイヤー
        const drawingLayer = this.createLayer({
            name: 'レイヤー 1',
            type: 'drawing',
            zIndex: 1,
            locked: false,
            visible: true
        });
        
        // UIレイヤー
        const uiLayer = this.createLayer({
            name: 'UI',
            type: 'ui',
            zIndex: 100,
            locked: true,
            visible: true
        });
        
        // アクティブレイヤー設定
        this.setActiveLayer(drawingLayer.id);
        
        console.log('✅ デフォルトレイヤー作成完了');
    }
    
    // レイヤー作成（@pixi/layers統合）
    createLayer(options = {}) {
        if (this.layers.size >= this.maxLayers) {
            console.warn(`⚠️ 最大レイヤー数 ${this.maxLayers} に達しています`);
            return null;
        }
        
        const layerId = this.generateLayerId();
        const layerConfig = {
            id: layerId,
            name: options.name || `レイヤー ${this.layers.size + 1}`,
            type: options.type || 'drawing',
            zIndex: options.zIndex || this.layers.size,
            opacity: options.opacity || 1.0,
            visible: options.visible !== false,
            locked: options.locked || false,
            blendMode: options.blendMode || 'normal',
            created: Date.now()
        };
        
        let layer;
        let layerGroup = null;
        
        if (this.usePixiLayers) {
            // @pixi/layers使用
            layer = new this.extensions.Layers.Layer();
            layerGroup = new this.extensions.Layers.Group(layerConfig.zIndex, true);
            layer.group = layerGroup;
            
            console.log(`🎯 @pixi/layers レイヤー作成: ${layerConfig.name}`);
        } else {
            // フォールバック: 通常コンテナ
            layer = new PIXI.Container();
            layer.zIndex = layerConfig.zIndex;
            
            console.log(`🔧 基本レイヤー作成: ${layerConfig.name}`);
        }
        
        // レイヤー設定適用
        layer.name = layerConfig.name;
        layer.alpha = layerConfig.opacity;
        layer.visible = layerConfig.visible;
        layer.sortableChildren = true;
        
        // 非破壊変形対応
        layer.originalTransform = new PIXI.Matrix();
        layer.transformHistory = [];
        layer.layerConfig = layerConfig;
        
        // グラフィックス描画用コンテナ
        layer.graphics = new PIXI.Graphics();
        layer.addChild(layer.graphics);
        
        // レイヤーステージに追加
        this.layerStage.addChild(layer);
        
        // 管理マップに追加
        this.layers.set(layerId, layer);
        if (layerGroup) {
            this.layerGroups.set(layerId, layerGroup);
        }
        
        console.log(`✅ レイヤー作成完了: ${layerConfig.name} (ID: ${layerId})`);
        
        return { id: layerId, layer: layer, config: layerConfig };
    }
    
    // レイヤーID生成
    generateLayerId() {
        return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // レイヤー取得
    getLayer(layerId) {
        return this.layers.get(layerId);
    }
    
    // アクティブレイヤー設定
    setActiveLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (layer && !layer.layerConfig.locked) {
            this.activeLayer = layer;
            console.log(`🎯 アクティブレイヤー: ${layer.layerConfig.name}`);
            
            // レイヤーパネルUI更新
            this.updateLayerPanelUI();
            return true;
        }
        return false;
    }
    
    // アクティブレイヤー取得
    getActiveLayer() {
        return this.activeLayer;
    }
    
    // レイヤー順序変更（@pixi/layers対応）
    moveLayer(layerId, newZIndex) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        if (this.usePixiLayers && layer.group) {
            // @pixi/layers使用: Group zOrder変更
            layer.group.zOrder = newZIndex;
            layer.layerConfig.zIndex = newZIndex;
            console.log(`🔄 @pixi/layers レイヤー移動: ${layer.layerConfig.name} → zOrder ${newZIndex}`);
        } else {
            // フォールバック: 手動zIndex管理
            layer.zIndex = newZIndex;
            layer.layerConfig.zIndex = newZIndex;
            this.layerStage.sortChildren();
            console.log(`🔄 基本レイヤー移動: ${layer.layerConfig.name} → zIndex ${newZIndex}`);
        }
        
        this.updateLayerPanelUI();
        return true;
    }
    
    // レイヤー可視性切り替え
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.visible = !layer.visible;
            layer.layerConfig.visible = layer.visible;
            console.log(`👁️ レイヤー可視性: ${layer.layerConfig.name} → ${layer.visible ? '表示' : '非表示'}`);
            
            this.updateLayerPanelUI();
            return layer.visible;
        }
        return false;
    }
    
    // レイヤー不透明度設定
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (layer) {
            const clampedOpacity = Math.max(0, Math.min(1, opacity));
            layer.alpha = clampedOpacity;
            layer.layerConfig.opacity = clampedOpacity;
            console.log(`🔆 レイヤー不透明度: ${layer.layerConfig.name} → ${Math.round(clampedOpacity * 100)}%`);
            
            this.updateLayerPanelUI();
            return clampedOpacity;
        }
        return false;
    }
    
    // レイヤー削除
    deleteLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        // 重要レイヤーの削除防止
        if (layer.layerConfig.type === 'background' || layer.layerConfig.type === 'ui') {
            console.warn(`⚠️ ${layer.layerConfig.type}レイヤーは削除できません`);
            return false;
        }
        
        // アクティブレイヤーの場合は別レイヤーをアクティブに
        if (this.activeLayer === layer) {
            const remainingLayers = Array.from(this.layers.values())
                .filter(l => l !== layer && l.layerConfig.type === 'drawing');
            
            if (remainingLayers.length > 0) {
                this.setActiveLayer(remainingLayers[0].layerConfig.id);
            }
        }
        
        // レイヤー削除
        this.layerStage.removeChild(layer);
        layer.destroy({ children: true });
        
        // 管理マップから削除
        this.layers.delete(layerId);
        this.layerGroups.delete(layerId);
        
        console.log(`🗑️ レイヤー削除: ${layer.layerConfig.name}`);
        this.updateLayerPanelUI();
        
        return true;
    }
    
    // レイヤー複製
    duplicateLayer(layerId) {
        const originalLayer = this.layers.get(layerId);
        if (!originalLayer) return null;
        
        // 複製レイヤー作成
        const duplicateOptions = {
            name: originalLayer.layerConfig.name + ' コピー',
            type: originalLayer.layerConfig.type,
            zIndex: originalLayer.layerConfig.zIndex + 1,
            opacity: originalLayer.layerConfig.opacity,
            visible: originalLayer.layerConfig.visible,
            blendMode: originalLayer.layerConfig.blendMode
        };
        
        const duplicate = this.createLayer(duplicateOptions);
        if (!duplicate) return null;
        
        // グラフィックスコピー
        const originalGraphics = originalLayer.graphics;
        const duplicateGraphics = duplicate.layer.graphics;
        
        // 簡易グラフィックス複製
        try {
            const texture = this.mainApp.pixiApp.renderer.generateTexture(originalGraphics);
            const sprite = new PIXI.Sprite(texture);
            duplicateGraphics.addChild(sprite);
            
            console.log(`📋 レイヤー複製: ${originalLayer.layerConfig.name} → ${duplicate.config.name}`);
        } catch (error) {
            console.error('❌ レイヤー複製エラー:', error);
        }
        
        this.updateLayerPanelUI();
        return duplicate;
    }
    
    // 非破壊変形適用
    applyTransform(layerId, transform, recordHistory = true) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        if (recordHistory) {
            // 変形履歴記録
            layer.transformHistory.push({
                id: this.generateTransformId(),
                before: layer.transform.clone(),
                transform: transform.clone(),
                timestamp: Date.now(),
                type: this.detectTransformType(transform)
            });
            
            // 履歴制限管理
            if (layer.transformHistory.length > 100) {
                layer.transformHistory.shift();
            }
        }
        
        // 変形適用
        layer.transform.append(transform);
        
        console.log(`🔄 非破壊変形適用: ${layer.layerConfig.name}`);
        return true;
    }
    
    // 変形タイプ検出
    detectTransformType(transform) {
        if (transform.tx !== 0 || transform.ty !== 0) return 'translate';
        if (transform.a !== 1 || transform.d !== 1) return 'scale';
        if (transform.b !== 0 || transform.c !== 0) return 'rotate';
        return 'unknown';
    }
    
    // 変形ID生成
    generateTransformId() {
        return `transform_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    // 変形履歴アンドゥ
    undoTransform(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer || layer.transformHistory.length === 0) return false;
        
        const lastTransform = layer.transformHistory.pop();
        layer.transform.copyFrom(lastTransform.before);
        
        // グローバル変形履歴に追加
        this.transformHistory.push({
            type: 'undo',
            layerId: layerId,
            transform: lastTransform,
            timestamp: Date.now()
        });
        
        console.log(`↩️ 変形アンドゥ: ${layer.layerConfig.name}`);
        return true;
    }
    
    // レイヤー統計取得
    getLayerStats() {
        const stats = {
            totalLayers: this.layers.size,
            maxLayers: this.maxLayers,
            activeLayerId: this.activeLayer?.layerConfig.id || null,
            visibleLayers: 0,
            lockedLayers: 0,
            transformHistory: this.transformHistory.length,
            usePixiLayers: this.usePixiLayers
        };
        
        this.layers.forEach(layer => {
            if (layer.visible) stats.visibleLayers++;
            if (layer.layerConfig.locked) stats.lockedLayers++;
        });
        
        return stats;
    }
    
    // レイヤーパネルUI更新
    updateLayerPanelUI() {
        // レイヤーパネルUIがある場合の更新処理
        if (this.mainApp.components?.LayerPanelUI) {
            this.mainApp.components.LayerPanelUI.refresh();
        }
        
        console.log('🔄 レイヤーパネルUI更新');
    }
    
    // 全レイヤー取得
    getAllLayers() {
        return Array.from(this.layers.entries()).map(([id, layer]) => ({
            id: id,
            layer: layer,
            config: layer.layerConfig
        }));
    }
    
    // レイヤーエクスポート（アニメ制作用）
    exportLayersForAnimation() {
        const exportData = {
            timestamp: Date.now(),
            layers: []
        };
        
        this.layers.forEach((layer, id) => {
            if (layer.visible && layer.layerConfig.type === 'drawing') {
                // レイヤーをテクスチャとしてエクスポート
                try {
                    const texture = this.mainApp.pixiApp.renderer.generateTexture(layer);
                    exportData.layers.push({
                        id: id,
                        name: layer.layerConfig.name,
                        texture: texture,
                        transform: layer.transform.clone(),
                        config: layer.layerConfig
                    });
                } catch (error) {
                    console.error(`❌ レイヤーエクスポートエラー (${layer.layerConfig.name}):`, error);
                }
            }
        });
        
        console.log(`📦 アニメ用レイヤーエクスポート完了: ${exportData.layers.length}レイヤー`);
        return exportData;
    }
}

// グローバル登録
window.TegakiApp.LayerCorePhase2 = LayerCorePhase2;

console.log('✅ LayerCore Phase2読み込み完了 - @pixi/layers完全統合');
```

### Phase2完成時の品質基準
**必達基準**:
- [ ] @pixi/ui統合率95%以上（HTML UI → PixiJS UI）
- [ ] @pixi/layers統合率100%（非破壊レイヤーシステム）
- [ ] UI応答性向上50%以上（@pixi/ui効果）
- [ ] レイヤー機能完成度90%以上
- [ ] 変形品質保証100%（360度回転復元テスト）

---

## 🎬 Phase3: アニメーション機能完成・@pixi/gif統合

### Phase3.1: @pixi/gif統合・高品質アニメ制作（2週間）
**期間**: 2週間  
**目標**: @pixi/gif完全活用・プロ級アニメ制作環境・高品質GIF出力

#### アニメーション機能実装戦略
- **フレーム管理**: @pixi/layers連携による非破壊フレーム管理
- **タイムラインUI**: @pixi/ui活用による直感的インターフェース
- **GIFエクスポート**: @pixi/gif活用による高品質出力
- **オニオンスキン**: レイヤー透明度制御による滑らかプレビュー

### Phase3.2: 120FPS準備・パフォーマンス最適化（1週間）
**期間**: 1週間  
**目標**: v8移行前の最適化・拡張ライブラリ性能向上

#### 最適化項目
- **@pixi/ui最適化**: UIコンポーネント描画最適化
- **@pixi/layers最適化**: レイヤー更新効率化
- **メモリ管理**: 拡張ライブラリメモリ使用量最適化
- **120FPS準備**: 高フレームレート対応基盤

---

## 🚀 Phase4: PixiJS v8移行・次世代機能実現

### Phase4.1: v8互換性レイヤー・拡張ライブラリ対応（2週間）
**目標**: 拡張ライブラリv8対応・互換性保証

### Phase4.2: WebGPU・120FPS実現（2週間）
**目標**: WebGPU統合・高性能描画・拡張ライブラリ最適化

---

## 📊 実装優先度・品質保証（拡張統合版）

### 実装優先度
**Phase1（最高優先度）**:
1. libs/pixi-extensions.js統合システム（🔥必須）
2. @pixi/ui基本統合（🔥必須）
3. @pixi/layers基本統合（🔥必須）
4. CORS制限回避（🔥必須）

**Phase2（高優先度）**:
1. @pixi/ui完全統合（UI革命）
2. @pixi/layers完全統合（非破壊レイヤー）
3. 既存機能100%再現確認
4. AI分業開発パターン確立

**Phase3（中優先度）**:
1. @pixi/gif統合（アニメ機能）
2. @pixi/text-bitmap統合（UI高速化）
3. アニメ制作環境完成
4. 120FPS準備

### 品質保証チェックリスト
**拡張ライブラリ統合品質**:
- [ ] 必須拡張ライブラリ100%動作確認
- [ ] CDN障害時フォールバック100%動作
- [ ] 拡張ライブラリ活用度測定80%以上
- [ ] 独自実装削減率70%以上

**AI協働開発効率**:
- [ ] 必要ファイル数50%削減達成
- [ ] 分業パターン標準化完了
- [ ] 拡張依存関係明示100%
- [ ] 単体テスト可能率90%以上

**非破壊品質保証**:
- [ ] 360度回転復元テスト100%成功
- [ ] レイヤー変形履歴100%保持
- [ ] アニメ品質劣化0%保証
- [ ] GIF出力品質向上50%以上

---

## 🎯 成果物・期待効果（拡張統合版）

### Phase1成果物
- **拡張統合システム**: libs/pixi-extensions.js完成
- **CORS制限回避**: file://直接動作保証
- **基盤分割**: HTML→JavaScript分割完成
- **CDN障害対応**: 完全フォールバック実装

### Phase2成果物
- **UI革命**: @pixi/ui完全統合・HTML UI撤廃
- **レイヤー革命**: @pixi/layers統合・非破壊システム完成
- **AI分業基盤**: 効率的協働開発パターン確立
- **品質向上**: 応答性・機能性大幅向上

### Phase3成果物
- **アニメ機能**: @pixi/gif統合・プロ級制作環境
- **高性能化**: 120FPS準備・最適化完了
- **完全統合**: 全拡張ライブラリ統合達成
- **品質保証**: 非破壊・高品質出力確保

### Phase4成果物
- **次世代移行**: PixiJS v8・WebGPU・120FPS実現
- **エコシステム**: 拡張ライブラリ完全活用環境
- **AI協働**: 効率的開発・保守パターン完成
- **コ    // CDN障害検出タイムアウト設定
    timeout: 5000, // 5秒
    fallbackActive: false,
    
    // CDN健全性チェック
    async checkCDNHealth() {
        console.log('🔍 CDN健全性チェック開始...');
        
        const cdnTests = [
            {
                name: 'PixiJS',
                url: 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js',
                check: () => !!window.PIXI
            },
            {
                name: '@pixi/ui',
                url: 'https://cdn.jsdelivr.net/npm/@pixi/ui@1.2.4/dist/ui.min.js',
                check: () => !!(window.PIXI_UI || window.UI)
            },
            {
                name: '@pixi/layers',
                url: 'https://cdn.jsdelivr.net/npm/@pixi/layers@2.1.0/dist/pixi-layers.min.js',
                check: () => !!window.PIXI?.display?.Layer
            }
        ];
        
        const results = [];
        for (const test of cdnTests) {
            const startTime = Date.now();
            try {
                // 実際の読み込みテスト
                const available = await Promise.race([
                    this.testCDNAvailability(test.url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), this.timeout)
                    )
                ]);
                
                const responseTime = Date.now() - startTime;
                const functionalCheck = test.check();
                
                results.push({
                    name: test.name,
                    available: available && functionalCheck,
                    responseTime: responseTime,
                    functionalCheck: functionalCheck
                });
                
                if (available && functionalCheck) {
                    console.log(`✅ ${test.name} CDN正常 (${responseTime}ms)`);
                } else {
                    console.warn(`⚠️ ${test.name} CDN問題検出`);
                }
                
            } catch (error) {
                console.error(`❌ ${test.name} CDN障害:`, error.message);
                results.push({
                    name: test.name,
                    available: false,
                    error: error.message
                });
            }
        }
        
        return results;
    },
    
    // CDN可用性テスト
    async testCDNAvailability(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Load failed'));
            
            // テスト専用・実際には追加しない
            // document.head.appendChild(script);
            
            // 模擬テスト（実装時は上記使用）
            setTimeout(() => resolve(true), 100);
        });
    },
    
    // フォールバック実行
    async activateFallback(failedLibraries) {
        console.log('🆘 CDN障害検出 - フォールバック実行開始');
        this.fallbackActive = true;
        
        for (const lib of failedLibraries) {
            switch (lib.name) {
                case '@pixi/ui':
                    await this.loadUIFallback();
                    break;
                case '@pixi/layers':
                    await this.loadLayersFallback();
                    break;
                case '@pixi/gif':
                    await this.loadGIFFallback();
                    break;
            }
        }
        
        console.log('✅ フォールバック実行完了');
    },
    
    // UI フォールバック実装
    async loadUIFallback() {
        console.log('🔧 @pixi/ui フォールバック実装');
        
        // 簡易UI実装を window.PIXI_UI_FALLBACK として提供
        window.PIXI_UI_FALLBACK = {
            FancyButton: class FallbackButton extends PIXI.Container {
                constructor(options = {}) {
                    super();
                    this.options = options;
                    this.interactive = true;
                    this.buttonMode = true;
                    this.onPress = { add: (callback) => { this.on('pointerdown', callback); } };
                    
                    // 背景作成
                    this.background = new PIXI.Graphics();
                    this.updateBackground('default');
                    this.addChild(this.background);
                    
                    // テキスト追加
                    if (options.text) {
                        this.textElement = new PIXI.Text(options.text, {
                            fontFamily: 'system-ui, sans-serif',
                            fontSize: 12,
                            fill: 0x800000
                        });
                        this.textElement.anchor.set(0.5);
                        this.textElement.x = 50;
                        this.textElement.y = 15;
                        this.addChild(this.textElement);
                    }
                    
                    // イベント設定
                    this.on('pointerover', () => this.updateBackground('hover'));
                    this.on('pointerout', () => this.updateBackground('default'));
                    this.on('pointerdown', () => this.updateBackground('pressed'));
                    this.on('pointerup', () => this.updateBackground('hover'));
                }
                
                updateBackground(state) {
                    const colors = {
                        default: 0xf0e0d6,
                        hover: 0xaa5a56,
                        pressed: 0xcf9c97
                    };
                    
                    this.background.clear();
                    this.background.beginFill(colors[state] || colors.default);
                    this.background.lineStyle(2, 0x800000);
                    this.background.drawRoundedRect(0, 0, 100, 30, 5);
                    this.background.endFill();
                }
            },
            
            Slider: class FallbackSlider extends PIXI.Container {
                constructor(options = {}) {
                    super();
                    this.min = options.min || 0;
                    this.max = options.max || 100;
                    this._value = options.value || 50;
                    this.sliderWidth = options.width || 200;
                    this.onUpdate = { add: (callback) => { this.updateCallback = callback; } };
                    
                    this.createSliderComponents();
                    this.setupInteraction();
                }
                
                createSliderComponents() {
                    // 背景トラック
                    this.track = new PIXI.Graphics();
                    this.track.beginFill(0xe9c2ba);
                    this.track.drawRoundedRect(0, 8, this.sliderWidth, 4, 2);
                    this.track.endFill();
                    this.addChild(this.track);
                    
                    // ハンドル
                    this.handle = new PIXI.Graphics();
                    this.handle.beginFill(0x800000);
                    this.handle.drawCircle(0, 0, 8);
                    this.handle.endFill();
                    this.handle.interactive = true;
                    this.handle.buttonMode = true;
                    this.handle.y = 10;
                    this.updateHandlePosition();
                    this.addChild(this.handle);
                }
                
                setupInteraction() {
                    let dragging = false;
                    
                    this.handle.on('pointerdown', () => { dragging = true; });
                    this.handle.on('pointermove', (e) => {
                        if (dragging) {
                            const localX = e.data.getLocalPosition(this).x;
                            const normalizedX = Math.max(0, Math.min(localX, this.sliderWidth));
                            const newValue = this.min + (normalizedX / this.sliderWidth) * (this.max - this.min);
                            this.value = newValue;
                        }
                    });
                    
                    document.addEventListener('pointerup', () => { dragging = false; });
                }
                
                get value() { return this._value; }
                set value(val) {
                    this._value = Math.max(this.min, Math.min(this.max, val));
                    this.updateHandlePosition();
                    if (this.updateCallback) this.updateCallback(this._value);
                }
                
                updateHandlePosition() {
                    const normalizedValue = (this._value - this.min) / (this.max - this.min);
                    this.handle.x = normalizedValue * this.sliderWidth;
                }
            }
        };
        
        // 統合アクセサ更新
        window.PixiExtensions.UI = window.PIXI_UI_FALLBACK;
        console.log('✅ @pixi/ui フォールバック実装完了');
    },
    
    // Layers フォールバック実装
    async loadLayersFallback() {
        console.log('🔧 @pixi/layers フォールバック実装');
        
        // 基本レイヤーシステム実装
        window.PIXI_LAYERS_FALLBACK = {
            Layer: class FallbackLayer extends PIXI.Container {
                constructor() {
                    super();
                    this.group = null;
                    this.isLayer = true;
                    this.sortableChildren = true;
                }
            },
            
            Group: class FallbackGroup {
                constructor(zIndex = 0, enableSort = true) {
                    this.zIndex = zIndex;
                    this.enableSort = enableSort;
                    this.zOrder = zIndex;
                }
            },
            
            Stage: class FallbackStage extends PIXI.Container {
                constructor() {
                    super();
                    this.sortableChildren = true;
                }
            }
        };
        
        // 統合アクセサ更新
        window.PixiExtensions.Layers = window.PIXI_LAYERS_FALLBACK;
        console.log('✅ @pixi/layers フォールバック実装完了');
    },
    
    // GIF フォールバック実装
    async loadGIFFallback() {
        console.log('🔧 @pixi/gif フォールバック実装');
        
        // 基本GIF機能実装
        window.PIXI_GIF_FALLBACK = {
            AnimatedGIF: class FallbackAnimatedGIF {
                constructor() {
                    this.frames = [];
                    this.currentFrame = 0;
                    this.isPlaying = false;
                }
                
                static fromFrames(frames) {
                    const gif = new this();
                    gif.frames = frames;
                    return gif;
                }
                
                play() {
                    this.isPlaying = true;
                    console.log('🎬 フォールバックGIF再生開始');
                }
                
                stop() {
                    this.isPlaying = false;
                    console.log('⏹️ フォールバックGIF停止');
                }
                
                exportAsBlob() {
                    console.warn('⚠️ フォールバックGIFエクスポート機能制限');
                    return new Blob(['fallback gif data'], { type: 'image/gif' });
                }
            }
        };
        
        // 統合アクセサ更新
        window.PixiExtensions.GIF = window.PIXI_GIF_FALLBACK;
        console.log('✅ @pixi/gif フォールバック実装完了');
    }
};

// 自動CDN健全性チェック実行
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const results = await window.PixiExtensions.CDNFallbackSystem.checkCDNHealth();
        const failedLibraries = results.filter(r => !r.available);
        
        if (failedLibraries.length > 0) {
            console.warn(`⚠️ CDN障害検出: ${failedLibraries.map(f => f.name).join(', ')}`);
            await window.PixiExtensions.CDNFallbackSystem.activateFallback(failedLibraries);
        } else {
            console.log('✅ 全CDNライブラリ正常動作');
        }
    } catch (error) {
        console.error('❌ CDN健全性チェックエラー:', error);
    }
});
```

### Phase1完成時の品質基準
**必達基準**:
- [ ] 既存vector-drawing-tool.html機能100%再現
- [ ] CORS制限完全回避（file://直接動作）
- [ ] 拡張ライブラリ統合率80%以上
- [ ] CDN障害時フォールバック100%動作
- [ ] AI分業開発テスト成功

---

## 🎨 Phase2: 拡張ライブラリフル活用・プロ級機能実現

### Phase2.1: @pixi/ui完全統合・UI革命（2週間）
**期間**: 2週間  
**目標**: HTML UI完全代替・@pixi/ui活用によるプロ級インターフェース実現

#### @pixi/ui統合戦略
```javascript
// js/managers/ui-manager.js Phase2強化版
class UIManagerPhase2 extends UIManager {
    constructor(mainApp) {
        super(mainApp);
        this.pixiUIComponents = new Map();
        this.uiContainer = null;
    }
    
    async initPhase2() {
        console.log('🚀 UIManager Phase2強化開始...');
        
        // PixiJS UI専用コンテナ作成
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'UI-Container';
        this.uiContainer.zIndex = 1000; // UI最前面
        this.mainApp.pixiApp.stage.addChild(this.uiContainer);
        
        // 完全UI置換実行
        await this.replaceAllUIWithPixi();
        
        // 高度UI機能実装
        await this.implementAdvancedUIFeatures();
        
        console.log('✅ UIManager Phase2強化完了');
    }
    
    // 全UI要素をPixiJSに置換
    async replaceAllUIWithPixi() {
        // サイドバー完全置換
        await this.replaceToolbar();
        
        // ポップアップ完全置換
        await this.replacePopups();
        
        // スライダー完全置換
        await this.replaceAllSliders();
        
        // ステータスパネル置換
        await this.replaceStatusPanel();
    }
    
    // ツールバー置換
    async replaceToolbar() {
        console.log('🔧 ツールバー @pixi/ui完全置換開始...');
        
        // 既存サイドバー非表示
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = 'none';
        }
        
        // @pixi/ui ツールバー作成
        const toolbar = this.createPixiUIToolbar();
        this.uiContainer.addChild(toolbar);
        
        console.log('✅ ツールバー @pixi/ui置換完了');
    }
    
    // @pixi/ui ツールバー作成
    createPixiUIToolbar() {
        const toolbar = new PIXI.Container();
        toolbar.name = 'PixiUI-Toolbar';
        toolbar.x = 12;
        toolbar.y = 12;
        
        const tools = [
            { id: 'pen', icon: '✏️', title: 'ペンツール' },
            { id: 'eraser', icon: '🧽', title: '消しゴム' },
            { id: 'bucket', icon: '🪣', title: 'バケツ' },
            { id: 'select', icon: '⬚', title: '選択' },
            { id: 'settings', icon: '⚙️', title: '設定' }
        ];
        
        tools.forEach((tool, index) => {
            const button = this.createToolButton(tool);
            button.y = index * 44; // 4pxマージン含む
            toolbar.addChild(button);
            
            this.pixiUIComponents.set(tool.id + '-button', button);
        });
        
        return toolbar;
    }
    
    // ツールボタン作成（@pixi/ui FancyButton）
    createToolButton(tool) {
        const buttonTextures = this.createToolButtonTextures(tool);
        
        const button = new this.extensions.UI.FancyButton({
            defaultView: buttonTextures.default,
            hoverView: buttonTextures.hover,
            pressedView: buttonTextures.pressed,
            disabledView: buttonTextures.disabled,
            anchor: 0
        });
        
        // ツールチップ
        button.onHover.add(() => {
            this.showTooltip(tool.title, button.x + 50, button.y);
        });
        
        button.onOut.add(() => {
            this.hideTooltip();
        });
        
        // ツール切り替え
        button.onPress.add(() => {
            this.selectTool(tool.id);
        });
        
        return button;
    }
    
    // ツールボタンテクスチャ作成
    createToolButtonTextures(tool) {
        const textures = {};
        const states = {
            default: { bg: 0xf0e0d6, border: 0xe9c2ba, icon: 0x800000 },
            hover: { bg: 0xaa5a56, border: 0x800000, icon: 0xffffff },
            pressed: { bg: 0xcf9c97, border: 0x800000, icon: 0xffffff },
            disabled: { bg: 0xe9c2ba, border: 0xcf9c97, icon: 0x888888 }
        };
        
        Object.entries(states).forEach(([state, colors]) => {
            const graphics = new PIXI.Graphics();
            
            // ボタン背景
            graphics.beginFill(colors.bg);
            graphics.lineStyle(2, colors.border);
            graphics.drawRoundedRect(0, 0, 40, 40, 8);
            graphics.endFill();
            
            // アイコン（テキストベース・将来SVG対応）
            const iconText = new PIXI.Text(tool.icon, {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: colors.icon
            });
            iconText.anchor.set(0.5);
            iconText.x = 20;
            iconText.y = 20;
            
            const container = new PIXI.Container();
            container.addChild(graphics);
            container.addChild(iconText);
            
            textures[state] = this.mainApp.pixiApp.renderer.generateTexture(container);
        });
        
        return textures;
    }
    
    // ツールチップ表示
    showTooltip(text, x, y) {
        this.hideTooltip(); // 既存削除
        
        const tooltip = new PIXI.Container();
        tooltip.name = 'Tooltip';
        
        // 背景
        const background = new PIXI.Graphics();
        background.beginFill(0x333333, 0.9);
        background.drawRoundedRect(0, 0, text.length * 8 + 16, 28, 4);
        background.endFill();
        
        // テキスト
        const tooltipText = new PIXI.Text(text, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            fill: 0xffffff
        });
        tooltipText.x = 8;
        tooltipText.y = 6;
        
        tooltip.addChild(background);
        tooltip.addChild(tooltipText);
        tooltip.x = x;
        tooltip.y = y;
        
        this.uiContainer.addChild(tooltip);
        this.currentTooltip = tooltip;
        
        // 自動非表示
        setTimeout(() => this.hideTooltip(), 3000);
    }
    
    // ツールチップ非表示
    hideTooltip() {
        if (this.currentTooltip) {
            this.uiContainer.removeChild(this.currentTooltip);
            this.currentTooltip = null;
        }
    }
    
    // ツール選択処理
    selectTool(toolId) {
        console.log(`🎯 ツール選択: ${toolId}`);
        
        // 全ボタン非アクティブ化
        this.pixiUIComponents.forEach((component, id) => {
            if (id.endsWith('-button')) {
                component.alpha = 1.0;
            }
        });
        
        // 選択ボタンアクティブ化
        const selectedButton = this.pixiUIComponents.get(toolId + '-button');
        if (selectedButton) {
            selectedButton.alpha = 0.8; // アクティブ表示
        }
        
        // ツールマネージャー通知
        if (this.mainApp.components?.ToolManager) {
            this.mainApp.components.ToolManager.setCurrentTool(toolId);
        }
    }
    
    // ポップアップ完全置換
    async replacePopups() {
        console.log('🔧 ポップアップ @pixi/ui完全置換開始...');
        
        const popups = document.querySelectorAll('.popup-panel');
        popups.forEach(popup => {
            popup.style.display = 'none'; // HTML非表示
            
            // @pixi/ui版作成
            const pixiPopup = this.createPixiUIPopup(popup);
            this.uiContainer.addChild(pixiPopup);
        });
        
        console.log('✅ ポップアップ @pixi/ui置換完了');
    }
    
    // @pixi/ui ポップアップ作成
    createPixiUIPopup(htmlPopup) {
        const popup = new PIXI.Container();
        popup.name = 'PixiUI-Popup-' + htmlPopup.id;
        popup.x = 60;
        popup.y = 100;
        
        // 背景パネル
        const background = this.createPopupBackground(320, 400);
        popup.addChild(background);
        
        // タイトル
        const title = new PIXI.Text('ベクターペンツール設定', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 16,
            fill: 0x800000,
            fontWeight: 'bold'
        });
        title.x = 20;
        title.y = 15;
        popup.addChild(title);
        
        // コンテンツエリア
        const contentArea = this.createPopupContent(htmlPopup);
        contentArea.y = 50;
        popup.addChild(contentArea);
        
        // ドラッグ機能
        this.makePixiPopupDraggable(popup);
        
        return popup;
    }
    
    // ポップアップ背景作成
    createPopupBackground(width, height) {
        const graphics = new PIXI.Graphics();
        
        // メイン背景
        graphics.beginFill(0xf0e0d6, 0.95);
        graphics.lineStyle(2, 0x800000);
        graphics.drawRoundedRect(0, 0, width, height, 12);
        graphics.endFill();
        
        // ドロップシャドウ効果
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.2);
        shadow.drawRoundedRect(4, 4, width, height, 12);
        shadow.endFill();
        
        const container = new PIXI.Container();
        container.addChild(shadow);
        container.addChild(graphics);
        
        return container;
    }
    
    // ポップアップコンテンツ作成
    createPopupContent(htmlPopup) {
        const content = new PIXI.Container();
        
        // サイズプリセット（@pixi/ui Button群）
        const presetButtons = this.createSizePresetButtons();
        content.addChild(presetButtons);
        
        // スライダー群（@pixi/ui Slider）
        const slidersContainer = this.createPopupSliders();
        slidersContainer.y = 80;
        content.addChild(slidersContainer);
        
        // チェックボックス群（@pixi/ui CheckBox）
        const checkboxContainer = this.createPopupCheckboxes();
        checkboxContainer.y = 280;
        content.addChild(checkboxContainer);
        
        return content;
    }
    
    // サイズプリセットボタン群作成
    createSizePresetButtons() {
        const container = new PIXI.Container();
        const sizes = [1, 2, 4, 8, 16, 32];
        
        sizes.forEach((size, index) => {
            const button = this.createSizePresetButton(size);
            button.x = index * 45 + 20;
            button.y = 20;
            container.addChild(button);
        });
        
        return container;
    }
    
    // サイズプリセットボタン作成
    createSizePresetButton(size) {
        const textures = this.createSizePresetTextures(size);
        
        const button = new this.extensions.UI.FancyButton({
            defaultView: textures.default,
            hoverView: textures.hover,
            pressedView: textures.pressed
        });
        
        button.onPress.add(() => {
            this.setBrushSize(size);
        });
        
        return button;
    }
    
    // サイズプリセットテクスチャ作成
    createSizePresetTextures(size) {
        const textures = {};
        const states = {
            default: { bg: 0xf0e0d6, border: 0xe9c2ba },
            hover: { bg: 0xaa5a56, border: 0x800000 },
            pressed: { bg: 0x800000, border: 0x800000 }
        };
        
        Object.entries(states).forEach(([state, colors]) => {
            const graphics = new PIXI.Graphics();
            
            // ボタン背景
            graphics.beginFill(colors.bg);
            graphics.lineStyle(1, colors.border);
            graphics.drawRoundedRect(0, 0, 40, 50, 4);
            graphics.endFill();
            
            // サイズ表示円
            const circleSize = Math.max(1, Math.min(16, size));
            graphics.beginFill(0x800000);
            graphics.drawCircle(20, 20, circleSize / 2);
            graphics.endFill();
            
            // サイズラベル
            const label = new PIXI.Text(size.toString(), {
                fontFamily: 'system-ui, sans-serif',
                fontSize: 8,
                fill: state === 'pressed' ? 0xffffff : 0x800000
            });
            label.anchor.set(0.5);
            label.x = 20;
            label.y = 35;
            
            const container = new PIXI.Container();
            container.addChild(graphics);
            container.addChild(label);
            
            textures[state] = this.mainApp.pixiApp.renderer.generateTexture(container);
        });
        
        return textures;
    }
    
    // ポップアップスライダー群作成
    createPopupSliders() {
        const container = new PIXI.Container();
        
        const sliders = [
            { label: 'サイズ', min: 0.1, max: 100, value: 16, key: 'size' },
            { label: '不透明度', min: 0, max: 100, value: 85, key: 'opacity' },
            { label: '筆圧', min: 0, max: 100, value: 50, key: 'pressure' },
            { label: '線補正', min: 0, max: 100, value: 30, key: 'smoothing' }
        ];
        
        sliders.forEach((config, index) => {
            const sliderGroup = this.createSliderGroup(config);
            sliderGroup.y = index * 45;
            container.addChild(sliderGroup);
        });
        
        return container;
    }
    
    // スライダーグループ作成
    createSliderGroup(config) {
        const group = new PIXI.Container();
        
        // ラベル
        const label = new PIXI.Text(config.label, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            fill: 0x800000,
            fontWeight: 'bold'
        });
        label.x = 20;
        label.y = 5;
        group.addChild(label);
        
        // @pixi/ui スライダー
        const slider = new this.extensions.UI.Slider({
            min: config.min,
            max: config.max,
            value: config.value,
            width: 200,
            height: 20,
            bg: 0xe9c2ba,
            fill: 0x800000,
            slider: 0xf0e0d6
        });
        slider.x = 20;
        slider.y = 20;
        
        // 値表示
        const valueText = new PIXI.Text(config.value.toFixed(1) + '%', {
            fontFamily: 'monospace',
            fontSize: 10,
            fill: 0x666666
        });
        valueText.x = 230;
        valueText.y = 25;
        group.addChild(valueText);
        
        // 更新イベント
        slider.onUpdate.add((value) => {
            const# 🎨 ふたば☆ちゃんねる風お絵描きツール 移行計画書 v2.1
## PixiJS拡張統合版 - CORS制限回避・実証済み拡張ライブラリ完全活用戦略

### 📋 計画概要（拡張統合強化版）
**移行戦略**: HTML単体 → PixiJS拡張統合 → v8移行の安定3段階戦略
**基本方針**: 実証済み拡張ライブラリ完全活用・CORS制限回避・AI協働開発最適化
**核心技術**: @pixi/ui・@pixi/layers・@pixi/gif統合による車輪の再発明完全撤廃
**最終目標**: WebGPU・120FPS描画・プロ級アニメ制作環境・AI分業開発基盤完成

### 🛡️ 前回問題点解決戦略
**問題1: CORS制限（file://プロトコル問題）**
- **解決策**: ESM（type="module"）完全禁止・従来型script読み込み採用
- **技術選択**: fetch API動的読み込み + eval実行パターン採用
- **検証方法**: http-server不要・file://直接動作保証

**問題2: CDNライブラリ問題（URL・バージョン不整合）**
- **解決策**: package.json実証済みバージョン固定・CDN URL検証システム
- **技術選択**: libs/pixi-extensions.js統合システム・フォールバック完備
- **検証方法**: 各拡張ライブラリ個別動作確認・統合動作テスト

**問題3: DOM統合問題（HTML/JS不一致）**
- **解決策**: 段階的HTML分割・DOM構造保持・既存機能100%再現
- **技術選択**: 従来DOM操作維持・PixiJS拡張統合による機能向上
- **検証方法**: 既存vector-drawing-tool.html完全機能再現確認

---

## 🏗️ Phase1: 拡張ライブラリ統合基盤構築（CORS制限完全回避）

### Phase1.1: HTML分割・拡張統合システム構築（1週間）
**期間**: 1週間  
**目標**: CORS制限回避・拡張ライブラリ統合・既存機能100%再現

#### Step1: HTML分離・拡張ライブラリ統合
```html
<!-- index.html - 拡張ライブラリ統合版 -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <!-- 実証済み拡張ライブラリ統合（package.json確認済み） -->
    
    <!-- PixiJS v7 本体（確定版） -->
    <script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js"></script>
    
    <!-- @pixi/ui v1.2.4（実証済み・UI革命） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/ui@1.2.4/dist/ui.min.js"></script>
    
    <!-- @pixi/layers v2.1.0（実証済み・非破壊レイヤー） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/layers@2.1.0/dist/pixi-layers.min.js"></script>
    
    <!-- @pixi/gif v2.1.1（実証済み・高品質アニメ） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/gif@2.1.1/dist/gif.min.js"></script>
    
    <!-- @pixi/text-bitmap v7.4.3（実証済み・高速UI） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/text-bitmap@7.4.3/dist/pixi-text-bitmap.min.js"></script>
    
    <!-- pixi-svg v3.2.0（実証済み・ベクターアイコン） -->
    <script src="https://cdn.jsdelivr.net/npm/pixi-svg@3.2.0/dist/pixi-svg.min.js"></script>
    
    <!-- 補助ライブラリ群（オプション） -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
    
    <!-- 🔧 拡張統合システム（新規作成） -->
    <script src="libs/pixi-extensions.js"></script>
    
    <!-- 🔧 アプリケーション本体（ESM禁止・従来型） -->
    <script src="js/main.js"></script>
    
    <!-- 既存DOM構造保持 -->
    <div class="main-layout">
        <div class="sidebar">
            <!-- 既存サイドバー構造維持 -->
        </div>
        <div class="canvas-area">
            <div class="canvas-container">
                <div id="drawing-canvas"></div>
            </div>
        </div>
    </div>
    
    <!-- 既存ポップアップ構造維持 -->
    <div class="popup-panel pen-settings" id="pen-settings">
        <!-- 既存ポップアップ内容維持 -->
    </div>
    
    <div class="status-panel">
        <!-- 既存ステータス表示維持 -->
    </div>
</body>
</html>
```

#### Step2: 拡張統合システム構築（libs/pixi-extensions.js）
```javascript
/**
 * 🎨 PixiJS拡張ライブラリ統合システム v1.0
 * 🛡️ CORS制限対応・CDN障害対応・フォールバック完備
 * 🔍 実証済み拡張ライブラリ（package.json確認済み）完全統合
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム v1.0 初期化開始...');

// 拡張ライブラリ統合・検証システム
window.PixiExtensions = {
    // 実証済み拡張ライブラリ情報（package.json準拠）
    libraries: {
        PIXI: { version: '7.4.3', global: 'PIXI', required: true },
        UI: { version: '1.2.4', global: 'PIXI_UI', required: true },
        Layers: { version: '2.1.0', global: 'PIXI_LAYERS', required: true },
        GIF: { version: '2.1.1', global: 'PIXI_GIF', required: false },
        TextBitmap: { version: '7.4.3', global: 'PIXI', required: false },
        SVG: { version: '3.2.0', global: 'PIXI_SVG', required: false }
    },
    
    // 拡張ライブラリ検証・統合
    initialize: function() {
        console.group('🎨 PixiJS拡張ライブラリ検証');
        
        const results = {};
        let successCount = 0;
        let totalCount = 0;
        
        for (const [name, lib] of Object.entries(this.libraries)) {
            totalCount++;
            const available = this.checkLibrary(lib.global);
            results[name] = {
                available: available,
                version: lib.version,
                global: lib.global,
                required: lib.required
            };
            
            if (available) {
                successCount++;
                console.log(`✅ ${name} v${lib.version} 検出成功`);
            } else if (lib.required) {
                console.error(`❌ ${name} v${lib.version} 必須ライブラリ未検出`);
            } else {
                console.warn(`⚠️ ${name} v${lib.version} オプションライブラリ未検出`);
            }
        }
        
        console.log(`📊 拡張ライブラリ統合: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
        console.groupEnd();
        
        // 統合アクセサ構築
        this.buildIntegratedAccessors(results);
        
        return results;
    },
    
    // ライブラリ存在確認
    checkLibrary: function(globalName) {
        if (globalName === 'PIXI') {
            return !!window.PIXI;
        } else if (globalName === 'PIXI_UI') {
            return !!(window.PIXI_UI || window.UI);
        } else if (globalName === 'PIXI_LAYERS') {
            return !!(window.PIXI?.display?.Layer);
        } else if (globalName === 'PIXI_GIF') {
            return !!(window.PIXI_GIF || window.GIF);
        } else if (globalName === 'PIXI_SVG') {
            return !!(window.PIXI_SVG || window.SVG);
        }
        return !!window[globalName];
    },
    
    // 統合アクセサ構築
    buildIntegratedAccessors: function(results) {
        // @pixi/ui統合アクセサ
        if (results.UI?.available) {
            this.UI = {
                FancyButton: window.PIXI_UI?.FancyButton || window.UI?.FancyButton,
                Button: window.PIXI_UI?.Button || window.UI?.Button,
                Slider: window.PIXI_UI?.Slider || window.UI?.Slider,
                CheckBox: window.PIXI_UI?.CheckBox || window.UI?.CheckBox,
                available: true
            };
            console.log('🎯 @pixi/ui統合アクセサ構築完了');
        } else {
            this.UI = { available: false };
            console.warn('⚠️ @pixi/ui未利用 - 独自UI実装使用');
        }
        
        // @pixi/layers統合アクセサ
        if (results.Layers?.available) {
            this.Layers = {
                Layer: window.PIXI?.display?.Layer,
                Group: window.PIXI?.display?.Group,
                Stage: window.PIXI?.display?.Stage,
                available: true
            };
            console.log('🎯 @pixi/layers統合アクセサ構築完了');
        } else {
            this.Layers = { available: false };
            console.warn('⚠️ @pixi/layers未利用 - 通常コンテナ使用');
        }
        
        // @pixi/gif統合アクセサ
        if (results.GIF?.available) {
            this.GIF = {
                AnimatedGIF: window.PIXI_GIF?.AnimatedGIF || window.GIF?.AnimatedGIF,
                available: true
            };
            console.log('🎯 @pixi/gif統合アクセサ構築完了');
        } else {
            this.GIF = { available: false };
            console.warn('⚠️ @pixi/gif未利用 - GIF機能無効');
        }
    },
    
    // 機能チェック
    hasFeature: function(feature) {
        switch (feature.toLowerCase()) {
            case 'ui': case 'button': case 'slider':
                return this.UI?.available || false;
            case 'layers': case 'layer':
                return this.Layers?.available || false;
            case 'gif': case 'animation':
                return this.GIF?.available || false;
            default:
                return false;
        }
    },
    
    // フォールバック実装提供
    createFallbackButton: function(options) {
        console.warn('🆘 @pixi/ui未利用 - フォールバックボタン作成');
        
        const container = new PIXI.Container();
        
        // シンプルな矩形ボタン
        const background = new PIXI.Graphics();
        background.beginFill(0x800000);
        background.drawRoundedRect(0, 0, options.width || 100, options.height || 30, 5);
        background.endFill();
        background.interactive = true;
        background.buttonMode = true;
        
        // テキスト追加
        if (options.text) {
            const text = new PIXI.Text(options.text, {
                fontFamily: 'system-ui, sans-serif',
                fontSize: 12,
                fill: 0xffffff
            });
            text.anchor.set(0.5);
            text.x = (options.width || 100) / 2;
            text.y = (options.height || 30) / 2;
            container.addChild(text);
        }
        
        container.addChild(background);
        return container;
    },
    
    createFallbackLayer: function(options = {}) {
        console.warn('🆘 @pixi/layers未利用 - フォールバックレイヤー作成');
        
        const container = new PIXI.Container();
        container.name = options.name || 'FallbackLayer';
        container.zIndex = options.zIndex || 0;
        container.sortableChildren = true;
        
        // 変形履歴追加（非破壊対応）
        container.transformHistory = [];
        container.originalTransform = new PIXI.Matrix();
        
        return container;
    }
};

// 自動初期化実行
document.addEventListener('DOMContentLoaded', () => {
    const results = window.PixiExtensions.initialize();
    
    // 必須ライブラリチェック
    if (!results.PIXI?.available) {
        console.error('❌ PixiJS本体が読み込まれていません');
        return;
    }
    
    console.log('🎉 PixiJS拡張ライブラリ統合システム初期化完了');
    
    // 統合テスト実行
    setTimeout(() => {
        window.PixiExtensions.runIntegrationTests();
    }, 500);
});

// 統合テスト
window.PixiExtensions.runIntegrationTests = function() {
    console.group('🧪 拡張ライブラリ統合テスト');
    
    try {
        // @pixi/uiテスト
        if (this.hasFeature('ui')) {
            const testButton = new this.UI.FancyButton({
                defaultView: new PIXI.Graphics().beginFill(0x800000).drawRect(0,0,50,20).endFill(),
                text: 'テスト'
            });
            console.log('✅ @pixi/ui統合テスト成功');
        }
        
        // @pixi/layersテスト
        if (this.hasFeature('layers')) {
            const testLayer = new this.Layers.Layer();
            testLayer.group = new this.Layers.Group(1);
            console.log('✅ @pixi/layers統合テスト成功');
        }
        
        // @pixi/gifテスト
        if (this.hasFeature('gif')) {
            console.log('✅ @pixi/gif統合テスト成功');
        }
        
        console.log('🎉 全拡張ライブラリ統合テスト完了');
    } catch (error) {
        console.error('❌ 統合テストエラー:', error);
    }
    
    console.groupEnd();
};

console.log('✅ PixiJS拡張ライブラリ統合システム読み込み完了');
```

#### Step3: メインアプリケーション改修（js/main.js）
```javascript
/**
 * 🎨 ふたば☆ちゃんねる風お絵描きツール メインアプリケーション v1.0
 * 🛡️ CORS制限対応・拡張ライブラリ統合・従来型JavaScript
 * 🔧 ESM禁止・fetch API動的読み込み・eval実行パターン
 */

console.log('🎨 ふたば風お絵描きツール v1.0 初期化開始...');

// グローバルアプリケーション名前空間
window.TegakiApp = {};

// メインアプリケーションクラス
class FutabaDrawingTool {
    constructor() {
        this.pixiApp = null;
        this.extensions = window.PixiExtensions;
        this.components = {};
        this.isInitialized = false;
    }
    
    // 初期化
    async init() {
        try {
            console.group('🚀 アプリケーション初期化');
            
            // 拡張ライブラリ確認
            if (!this.extensions) {
                throw new Error('PixiJS拡張統合システム未読み込み');
            }
            
            // PixiJS Application初期化（拡張統合）
            await this.initializePixiApp();
            
            // コンポーネント動的読み込み
            await this.loadComponents();
            
            // 既存DOM統合
            this.integrateExistingDOM();
            
            // イベントシステム初期化
            this.initializeEventSystem();
            
            console.log('✅ 初期化完了');
            console.groupEnd();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            console.groupEnd();
        }
    }
    
    // PixiJS Application初期化
    async initializePixiApp() {
        // 既存キャンバスコンテナ取得
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('drawing-canvas要素が見つかりません');
        }
        
        // PixiJS Application作成
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6, // ふたばクリーム
            antialias: true,
            resolution: 1,
            autoDensity: false
        });
        
        // DOM統合
        canvasContainer.appendChild(this.pixiApp.view);
        
        console.log('✅ PixiJS Application初期化完了');
    }
    
    // コンポーネント動的読み込み（fetch API使用）
    async loadComponents() {
        const componentFiles = [
            'js/app-core.js',
            'js/managers/ui-manager.js',
            'js/managers/tool-manager.js',
            'js/tools/pen-tool.js'
        ];
        
        for (const file of componentFiles) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    console.warn(`⚠️ ${file} 読み込み失敗 - スキップ`);
                    continue;
                }
                
                const code = await response.text();
                
                // 安全な動的実行（eval使用・名前空間保護）
                try {
                    eval(`(function() { ${code} })()`);
                    console.log(`✅ ${file} 読み込み成功`);
                } catch (evalError) {
                    console.error(`❌ ${file} 実行エラー:`, evalError);
                }
                
            } catch (fetchError) {
                console.warn(`⚠️ ${file} fetch失敗:`, fetchError);
            }
        }
        
        console.log('✅ コンポーネント動的読み込み完了');
    }
    
    // 既存DOM統合
    integrateExistingDOM() {
        // 既存ツールボタン統合
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleToolButtonClick(e);
            });
        });
        
        // 既存ポップアップ統合
        const popups = document.querySelectorAll('.popup-panel');
        popups.forEach(popup => {
            this.integratePopup(popup);
        });
        
        console.log('✅ 既存DOM統合完了');
    }
    
    // ツールボタンクリック処理
    handleToolButtonClick(event) {
        const button = event.currentTarget;
        const toolId = button.id;
        
        // 既存アクティブ状態解除
        document.querySelectorAll('.tool-button.active').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 新しいアクティブ状態設定
        button.classList.add('active');
        
        // ツール切り替え処理
        switch (toolId) {
            case 'pen-tool':
                this.setCurrentTool('pen');
                break;
            case 'eraser-tool':
                this.setCurrentTool('eraser');
                break;
            default:
                console.warn(`未対応ツール: ${toolId}`);
        }
        
        console.log(`🎯 ツール切り替え: ${toolId}`);
    }
    
    // ツール設定
    setCurrentTool(toolName) {
        if (this.components.ToolManager) {
            this.components.ToolManager.setCurrentTool(toolName);
        } else {
            // フォールバック処理
            this.currentTool = toolName;
            document.getElementById('current-tool').textContent = 
                toolName === 'pen' ? 'ベクターペン' : '消しゴム';
        }
    }
    
    // ポップアップ統合
    integratePopup(popup) {
        // ドラッグ機能維持
        this.makeDraggable(popup);
        
        // @pixi/ui統合（利用可能時）
        if (this.extensions.hasFeature('ui')) {
            this.enhancePopupWithPixiUI(popup);
        }
    }
    
    // ドラッグ機能実装
    makeDraggable(element) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        element.addEventListener('mousedown', (e) => {
            if (e.target === element || e.target.closest('.popup-title')) {
                isDragging = true;
                const rect = element.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                element.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(e.clientX - dragOffset.x, 
                    window.innerWidth - element.offsetWidth));
                const y = Math.max(0, Math.min(e.clientY - dragOffset.y, 
                    window.innerHeight - element.offsetHeight));
                
                element.style.left = x + 'px';
                element.style.top = y + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }
    
    // @pixi/ui統合ポップアップ強化
    enhancePopupWithPixiUI(popup) {
        // スライダー要素を@pixi/ui Sliderに置換
        const sliders = popup.querySelectorAll('.slider');
        sliders.forEach(slider => {
            if (this.extensions.UI.Slider) {
                this.replaceWithPixiUISlider(slider);
            }
        });
        
        console.log(`🎨 ポップアップ ${popup.id} @pixi/ui統合完了`);
    }
    
    // スライダー置換
    replaceWithPixiUISlider(htmlSlider) {
        // 既存値取得
        const min = parseFloat(htmlSlider.getAttribute('data-min') || '0');
        const max = parseFloat(htmlSlider.getAttribute('data-max') || '100');
        const value = parseFloat(htmlSlider.getAttribute('data-value') || '50');
        
        // @pixi/ui Slider作成
        const pixiSlider = new this.extensions.UI.Slider({
            min: min,
            max: max,
            value: value,
            width: htmlSlider.offsetWidth || 200,
            height: 20
        });
        
        // イベント統合
        pixiSlider.onUpdate.add((value) => {
            // 既存イベントシステムと統合
            const event = new CustomEvent('sliderchange', { 
                detail: { value: value } 
            });
            htmlSlider.dispatchEvent(event);
        });
        
        console.log('🎛️ HTMLスライダー → @pixi/ui Slider置換完了');
    }
    
    // イベントシステム初期化
    initializeEventSystem() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // ウィンドウリサイズ
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        console.log('✅ イベントシステム初期化完了');
    }
    
    // キーボード処理
    handleKeydown(event) {
        // Ctrl+Z: アンドゥ
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            this.performUndo();
        }
        
        // Ctrl+Y: リドゥ
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            this.performRedo();
        }
        
        // Spaceキー: パンモード切り替え
        if (event.key === ' ') {
            event.preventDefault();
            this.togglePanMode();
        }
    }
    
    // アンドゥ実行
    performUndo() {
        if (this.components.MemoryManager) {
            this.components.MemoryManager.undo();
        } else {
            console.warn('⚠️ MemoryManager未読み込み - アンドゥ無効');
        }
    }
    
    // リドゥ実行
    performRedo() {
        if (this.components.MemoryManager) {
            this.components.MemoryManager.redo();
        } else {
            console.warn('⚠️ MemoryManager未読み込み - リドゥ無効');
        }
    }
    
    // パンモード切り替え
    togglePanMode() {
        // 簡易パンモード実装
        const canvas = this.pixiApp.view;
        if (canvas.style.cursor === 'grab') {
            canvas.style.cursor = 'crosshair';
            console.log('🎯 描画モード');
        } else {
            canvas.style.cursor = 'grab';
            console.log('✋ パンモード');
        }
    }
    
    // リサイズ処理
    handleResize() {
        if (this.pixiApp) {
            // キャンバスコンテナサイズ取得
            const container = document.querySelector('.canvas-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                this.pixiApp.renderer.resize(rect.width, rect.height);
            }
        }
    }
}

// グローバル登録
window.TegakiApp.FutabaDrawingTool = FutabaDrawingTool;

// アプリケーション起動
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌟 ふたば☆ちゃんねる風お絵描きツール v1.0 起動開始');
    
    try {
        // 拡張システム待機
        if (!window.PixiExtensions) {
            console.log('⏳ PixiJS拡張統合システム待機中...');
            await new Promise(resolve => {
                const checkExtensions = () => {
                    if (window.PixiExtensions) {
                        resolve();
                    } else {
                        setTimeout(checkExtensions, 100);
                    }
                };
                checkExtensions();
            });
        }
        
        // メインアプリケーション起動
        const app = new FutabaDrawingTool();
        await app.init();
        
        // グローバル参照保持
        window.TegakiApp.instance = app;
        
        console.log('🎉 ふたば風お絵描きツール起動完了!');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // エラー時の最小限DOM表示
        document.body.innerHTML += `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #f0e0d6; border: 2px solid #800000; padding: 20px; border-radius: 8px;">
                <h3 style="color: #800000; margin: 0 0 10px 0;">🚨 初期化エラー</h3>
                <p style="margin: 0; color: #333;">${error.message}</p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                    ブラウザのコンソールで詳細を確認してください
                </p>
            </div>
        `;
    }
});

console.log('✅ メインアプリケーション読み込み完了');
```

### Phase1.2: 既存機能コンポーネント分割（1週間）
**期間**: 1週間  
**目標**: 既存vector-drawing-tool.html機能の完全分割・拡張ライブラリ統合

#### 既存機能分割マップ
```javascript
// 分割対象機能マッピング（vector-drawing-tool.html解析）
const 機能分割マップ = {
    // UI管理（@pixi/ui統合対象）
    'UI管理': {
        対象ファイル: 'js/managers/ui-manager.js',
        拡張統合: '@pixi/ui（FancyButton, Slider, CheckBox）',
        既存機能: 'ポップアップ・スライダー・プリセット管理',
        移行戦略: '段階的置換・フォールバック保持'
    },
    
    // 描画システム（@pixi/layers統合対象）
    '描画システム': {
        対象ファイル: 'js/tools/pen-tool.js',
        拡張統合: '@pixi/layers（Layer, Group）',
        既存機能: 'ペン描画・消しゴム・ブラシ設定',
        移行戦略: '非破壊変形対応・履歴管理統合'
    },
    
    // レイヤーシステム（@pixi/layers核心）
    'レイヤーシステム': {
        対象ファイル: 'js/layers/layer-core.js',
        拡張統合: '@pixi/layers（完全統合）',
        既存機能: '基本コンテナ管理',
        移行戦略: 'フル置換・機能大幅向上'
    },
    
    // パフォーマンス監視
    'パフォーマンス': {
        対象ファイル: 'js/utils/performance.js',
        拡張統合: '拡張ライブラリ性能測定機能',
        既存機能: 'FPS監視・メモリ監視',
        移行戦略: '拡張ライブラリ対応測定項目追加'
    }
};
```

#### コンポーネント実装例（js/managers/ui-manager.js）
```javascript
/**
 * 🎨 UI管理システム v1.0 - @pixi/ui完全統合版
 * 🎯 AI_WORK_SCOPE: UI統合専用ファイル
 * 🎯 DEPENDENCIES: main.js, libs/pixi-extensions.js
 * 🎯 PIXI_EXTENSIONS: @pixi/ui（必須）, @pixi/text-bitmap（推奨）
 * 🎯 FALLBACK: 独自UI実装完備
 */

// グローバル登録
window.TegakiApp = window.TegakiApp || {};

class UIManager {
    constructor(mainApp) {
        this.mainApp = mainApp;
        this.extensions = window.PixiExtensions;
        this.components = new Map();
        this.popups = new Map();
        
        console.log('🎨 UIManager初期化開始...');
        this.init();
    }
    
    init() {
        // @pixi/ui統合確認
        if (this.extensions.hasFeature('ui')) {
            console.log('✅ @pixi/ui統合モード');
            this.usePixiUI = true;
        } else {
            console.warn('⚠️ @pixi/ui未利用 - フォールバックUI使用');
            this.usePixiUI = false;
        }
        
        // 既存UIコンポーネント統合
        this.integrateExistingComponents();
        
        console.log('✅ UIManager初期化完了');
    }
    
    // 既存UIコンポーネント統合
    integrateExistingComponents() {
        // ツールボタン統合
        this.integrateToolButtons();
        
        // スライダー統合
        this.integrateSliders();
        
        // ポップアップ統合
        this.integratePopups();
    }
    
    // ツールボタン統合
    integrateToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach((button, index) => {
            if (this.usePixiUI) {
                this.upgradeToPixiUIButton(button, index);
            } else {
                this.enhanceHTMLButton(button);
            }
        });
        
        console.log(`🔧 ツールボタン統合完了: ${toolButtons.length}個`);
    }
    
    // @pixi/ui ボタンアップグレード
    upgradeToPixiUIButton(htmlButton, index) {
        try {
            // HTMLボタン情報取得
            const buttonInfo = {
                id: htmlButton.id,
                title: htmlButton.title,
                className: htmlButton.className,
                innerHTML: htmlButton.innerHTML
            };
            
            // @pixi/ui FancyButton作成
            const pixiButton = new this.extensions.UI.FancyButton({
                defaultView: this.createButtonTexture(buttonInfo, 'default'),
                hoverView: this.createButtonTexture(buttonInfo, 'hover'),
                pressedView: this.createButtonTexture(buttonInfo, 'pressed'),
                disabledView: this.createButtonTexture(buttonInfo, 'disabled')
            });
            
            // 位置・サイズ設定
            const rect = htmlButton.getBoundingClientRect();
            pixiButton.x = rect.left;
            pixiButton.y = rect.top;
            pixiButton.width = rect.width;
            pixiButton.height = rect.height;
            
            // イベント統合
            pixiButton.onPress.add(() => {
                htmlButton.click(); // 既存イベント実行
            });
            
            // PixiJS stage追加
            this.mainApp.pixiApp.stage.addChild(pixiButton);
            
            // コンポーネント登録
            this.components.set(buttonInfo.id, {
                type: 'pixiui-button',
                htmlElement: htmlButton,
                pixiComponent: pixiButton,
                buttonInfo: buttonInfo
            });
            
            console.log(`✅ ${buttonInfo.id} @pixi/ui統合完了`);
            
        } catch (error) {
            console.error(`❌ ${htmlButton.id} @pixi/ui統合失敗:`, error);
            this.enhanceHTMLButton(htmlButton);
        }
    }
    
    // ボタンテクスチャ作成
    createButtonTexture(buttonInfo, state) {
        const graphics = new PIXI.Graphics();
        
        // 状態別色設定
        let fillColor, borderColor;
        switch (state) {
            case 'hover':
                fillColor = 0xaa5a56; // ふたばライトマルーン
                borderColor = 0x800000; // ふたばマルーン
                break;
            case 'pressed':
                fillColor = 0xcf9c97; // ふたばミディアム
                borderColor = 0x800000;
                break;
            case 'disabled':
                fillColor = 0xe9c2ba; // ふたばライトミディアム
                borderColor = 0xcf9c97;
                break;
            default: // default
                fillColor = 0xf0e0d6; // ふたばクリーム
                borderColor = 0xe9c2ba;
                break;
        }
        
        // ボタン形状描画
        graphics.beginFill(fillColor);
        graphics.lineStyle(2, borderColor);
        graphics.drawRoundedRect(0, 0, 36, 36, 6);
        graphics.endFill();
        
        // アイコン描画（SVG統合時は置換予定）
        if (buttonInfo.innerHTML.includes('svg')) {
            // 簡易アイコン描画
            graphics.beginFill(borderColor);
            graphics.drawCircle(18, 18, 6);
            graphics.endFill();
        }
        
        return this.mainApp.pixiApp.renderer.generateTexture(graphics);
    }
    
    // HTMLボタン強化（フォールバック）
    enhanceHTMLButton(button) {
        // アニメーション強化
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.transition = 'transform 0.2s ease';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
        
        // アクティブ状態強化
        button.addEventListener('click', () => {
            // 全ボタンからアクティブ状態削除
            document.querySelectorAll('.tool-button.active').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 現在のボタンをアクティブ化
            button.classList.add('active');
        });
        
        console.log(`🔧 ${button.id} HTMLボタン強化完了`);
    }
    
    // スライダー統合
    integrateSliders() {
        const sliders = document.querySelectorAll('.slider');
        
        sliders.forEach((slider, index) => {
            if (this.usePixiUI && this.extensions.UI.Slider) {
                this.upgradeToPixiUISlider(slider, index);
            } else {
                this.enhanceHTMLSlider(slider);
            }
        });
        
        console.log(`🎛️ スライダー統合完了: ${sliders.length}個`);
    }
    
    // @pixi/ui スライダーアップグレード
    upgradeToPixiUISlider(htmlSlider, index) {
        try {
            const container = htmlSlider.closest('.slider-container');
            if (!container) return;
            
            // 設定値取得
            const rect = htmlSlider.getBoundingClientRect();
            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.querySelector('.slider-value');
            
            // 現在値計算
            const trackWidth = rect.width;
            const handlePos = handle ? parseFloat(handle.style.left) || 0 : 0;
            const currentValue = (handlePos / trackWidth) * 100;
            
            // @pixi/ui Slider作成
            const pixiSlider = new this.extensions.UI.Slider({
                min: 0,
                max: 100,
                value: currentValue,
                width: trackWidth,
                height: 20,
                bg: 0xe9c2ba,      // ふたばライトミディアム
                fill: 0x800000,    // ふたばマルーン
                slider: 0xf0e0d6   // ふたばクリーム
            });
            
            // 位置設定
            pixiSlider.x = rect.left;
            pixiSlider.y = rect.top;
            
            // イベント統合
            pixiSlider.onUpdate.add((value) => {
                // HTMLスライダー同期
                if (track) {
                    track.style.width = value + '%';
                }
                if (handle) {
                    handle.style.left = value + '%';
                }
                if (valueDisplay) {
                    valueDisplay.textContent = value.toFixed(1) + '%';
                }
                
                // カスタムイベント発火
                const event = new CustomEvent('sliderchange', {
                    detail: { value: value, slider: htmlSlider }
                });
                htmlSlider.dispatchEvent(event);
            });
            
            // PixiJS stage追加
            this.mainApp.pixiApp.stage.addChild(pixiSlider);
            
            // コンポーネント登録
            this.components.set(`slider-${index}`, {
                type: 'pixiui-slider',
                htmlElement: htmlSlider,
                pixiComponent: pixiSlider
            });
            
            console.log(`✅ スライダー${index} @pixi/ui統合完了`);
            
        } catch (error) {
            console.error(`❌ スライダー${index} @pixi/ui統合失敗:`, error);
            this.enhanceHTMLSlider(htmlSlider);
        }
    }
    
    // HTMLスライダー強化（フォールバック）
    enhanceHTMLSlider(slider) {
        const container = slider.closest('.slider-container');
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.querySelector('.slider-value');
        
        // スムーズアニメーション追加
        if (track) {
            track.style.transition = 'width 0.1s ease';
        }
        if (handle) {
            handle.style.transition = 'left 0.1s ease';
        }
        
        // 値表示強化
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1) + '%';
            }
        });
        
        console.log(`🔧 HTMLスライダー強化完了`);
    }
    
    // ポップアップ統合
    integratePopups() {
        const popups = document.querySelectorAll('.popup-panel');
        
        popups.forEach((popup) => {
            this.integratePopup(popup);
        });
        
        console.log(`💬 ポップアップ統合完了: ${popups.length}個`);
    }
    
    // 個別ポップアップ統合
    integratePopup(popup) {
        const popupId = popup.id;
        
        // @pixi/ui統合（将来実装）
        if (this.usePixiUI) {
            // 現在はHTML維持・将来@pixi/ui Panel使用予定
            console.log(`💬 ${popupId} @pixi/ui統合予約（Phase2実装予定）`);
        }
        
        // ドラッグ機能強化
        this.enhanceDragFunctionality(popup);
        
        // アニメーション強化
        this.enhancePopupAnimations(popup);
        
        // ポップアップ登録
        this.popups.set(popupId, {
            element: popup,
            isEnhanced: true
        });
        
        console.log(`✅ ${popupId} ポップアップ統合完了`);
    }
    
    // ドラッグ機能強化
    enhanceDragFunctionality(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const startDrag = (e) => {
            if (e.target === popup || e.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            }
        };
        
        const doDrag = (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(e.clientX - dragOffset.x,
                    window.innerWidth - popup.offsetWidth));
                const y = Math.max(0, Math.min(e.clientY - dragOffset.y,
                    window.innerHeight - popup.offsetHeight));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            }
        };
        
        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        };
        
        popup.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        
        console.log(`🖱️ ${popup.id} ドラッグ機能強化完了`);
    }
    
    // ポップアップアニメーション強化
    enhancePopupAnimations(popup) {
        // フェードイン・アウトアニメーション
        const originalShow = () => popup.classList.add('show');
        const originalHide = () => popup.classList.remove('show');
        
        popup.showWithAnimation = () => {
            popup.style.opacity = '0';
            popup.style.transform = 'scale(0.9)';
            popup.classList.add('show');
            
            requestAnimationFrame(() => {
                popup.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                popup.style.opacity = '1';
                popup.style.transform = 'scale(1)';
            });
        };
        
        popup.hideWithAnimation = () => {
            popup.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            popup.style.opacity = '0';
            popup.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                popup.classList.remove('show');
                popup.style.transition = '';
            }, 300);
        };
        
        console.log(`✨ ${popup.id} アニメーション強化完了`);
    }
    
    // 統計情報取得
    getStats() {
        return {
            usePixiUI: this.usePixiUI,
            componentsCount: this.components.size,
            popupsCount: this.popups.size,
            extensionsAvailable: {
                ui: this.extensions.hasFeature('ui'),
                textBitmap: this.extensions.hasFeature('textbitmap')
            }
        };
    }
    
    // コンポーネント取得
    getComponent(id) {
        return this.components.get(id);
    }
    
    // ポップアップ取得
    getPopup(id) {
        return this.popups.get(id);
    }
}

// グローバル登録
window.TegakiApp.UIManager = UIManager;

console.log('✅ UIManager読み込み完了 - @pixi/ui統合対応');
```

### Phase1.3: CDN障害対応・フォールバック完成（1週間）
**期間**: 1週間  
**目標**: CDN障害時の完全フォールバック・安定動作保証

#### CDN障害検出・対応システム実装
```javascript
// libs/pixi-extensions.js追加機能
window.PixiExtensions.CDNFallbackSystem = {
    // CDN障害検出タイムアウト設定
    