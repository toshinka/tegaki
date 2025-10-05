// ================================================================================
// animation-system.js - createNewBlankCut()メソッド修正版
// Phase 3完全版: Command経由でCUT作成
// ================================================================================

// 既存のcreateNewBlankCut()メソッドを以下に置き換えてください

createNewBlankCut() {
    // CUTデータを準備
    const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const cutData = {
        id: cutId,
        name: `CUT${this.animationData.cuts.length + 1}`,
        duration: 0.5,
        layers: [
            // 背景レイヤー
            {
                id: `${cutId}_layer_bg_${Date.now()}`,
                name: '背景',
                visible: true,
                opacity: 1.0,
                isBackground: true,
                transform: {
                    x: 0, y: 0,
                    rotation: 0,
                    scaleX: 1, scaleY: 1,
                    pivotX: 0, pivotY: 0
                },
                paths: []
            },
            // レイヤー1
            {
                id: `${cutId}_layer_1_${Date.now() + 1}`,
                name: 'レイヤー1',
                visible: true,
                opacity: 1.0,
                isBackground: false,
                transform: {
                    x: 0, y: 0,
                    rotation: 0,
                    scaleX: 1, scaleY: 1,
                    pivotX: 0, pivotY: 0
                },
                paths: []
            }
        ]
    };

    // 🔥 Phase 3: Command経由で実行（Undo/Redo対応）
    if (window.CreateCutCommand && window.History) {
        const stateManager = window.TegakiStateManager ? 
            new window.TegakiStateManager(this.config, this.eventBus) : null;
        
        if (!stateManager) {
            console.error('❌ StateManager not available');
            return null;
        }

        const command = new window.CreateCutCommand(
            stateManager,
            this.eventBus,
            cutData
        );

        window.History.executeCommand(command);
        
        // AnimationSystem内部のデータも更新（同期）
        this._syncFromStateManager(stateManager);
        
        return this.animationData.cuts[this.animationData.cuts.length - 1];
    } else {
        // フォールバック: Commandが使えない場合は従来の方法
        console.warn('⚠️ CreateCutCommand not available, using legacy method');
        return this._createNewBlankCutLegacy(cutData);
    }
}

createNewEmptyCut() {
    return this.createNewBlankCut();
}

// StateManagerから AnimationSystem内部データを同期
_syncFromStateManager(stateManager) {
    const state = stateManager.getState();
    
    // 既存のCUTを全削除
    this.animationData.cuts.forEach(cut => {
        if (this.layerSystem?.destroyCutRenderTexture) {
            this.layerSystem.destroyCutRenderTexture(cut.id);
        }
        if (this.canvasContainer && cut.container.parent) {
            this.canvasContainer.removeChild(cut.container);
        }
        cut.container.destroy({ children: true });
    });
    
    this.animationData.cuts = [];
    
    // Stateから再構築
    state.cuts.forEach((cutData, index) => {
        const cut = new Cut(cutData.id, cutData.name, this.config);
        cut.duration = cutData.duration;
        
        // レイヤーを再構築
        cutData.layers.forEach(layerData => {
            const layer = this._rebuildLayerFromData(layerData);
            if (layer) {
                cut.addLayer(layer);
            }
        });
        
        this.animationData.cuts.push(cut);
        
        if (this.canvasContainer) {
            this.canvasContainer.addChild(cut.container);
            cut.container.visible = false;
        }
        
        if (this.layerSystem?.createCutRenderTexture) {
            this.layerSystem.createCutRenderTexture(cut.id);
        }
    });
    
    // アクティブCUTを切り替え
    const targetCutIndex = state.currentCutIndex;
    this.switchToActiveCut(targetCutIndex);
}

// レイヤーデータからPixi.Containerを再構築
_rebuildLayerFromData(layerData) {
    const layer = new PIXI.Container();
    layer.label = layerData.id;
    
    layer.layerData = {
        id: layerData.id,
        name: layerData.name,
        visible: layerData.visible !== false,
        opacity: layerData.opacity || 1.0,
        isBackground: layerData.isBackground || false,
        paths: []
    };
    
    if (layerData.transform) {
        layer.position.set(layerData.transform.x || 0, layerData.transform.y || 0);
        layer.rotation = layerData.transform.rotation || 0;
        layer.scale.set(layerData.transform.scaleX || 1, layerData.transform.scaleY || 1);
        layer.pivot.set(layerData.transform.pivotX || 0, layerData.transform.pivotY || 0);
    }
    
    layer.visible = layerData.visible !== false;
    layer.alpha = layerData.opacity || 1.0;
    
    // 背景レイヤー
    if (layerData.isBackground) {
        const canvasSize = this.getCurrentCanvasSize();
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, canvasSize.width, canvasSize.height);
        bg.fill(this.config.background.color);
        layer.addChild(bg);
        layer.layerData.backgroundGraphics = bg;
    }
    
    // Pathsを再構築
    if (layerData.paths && Array.isArray(layerData.paths)) {
        layerData.paths.forEach(pathData => {
            const path = this._rebuildPath(pathData);
            if (path) {
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
            }
        });
    }
    
    return layer;
}

// 従来の方法（フォールバック用）
_createNewBlankCutLegacy(cutData) {
    const cut = new Cut(cutData.id, cutData.name, this.config);
    cut.duration = cutData.duration;
    
    // レイヤーを作成
    cutData.layers.forEach(layerData => {
        const layer = this._rebuildLayerFromData(layerData);
        if (layer) {
            cut.addLayer(layer);
        }
    });
    
    this.animationData.cuts.push(cut);
    const newIndex = this.animationData.cuts.length - 1;
    
    if (this.canvasContainer) {
        this.canvasContainer.addChild(cut.container);
        cut.container.visible = false;
    }
    
    if (this.layerSystem?.createCutRenderTexture) {
        this.layerSystem.createCutRenderTexture(cutData.id);
    }
    
    this.switchToActiveCut(newIndex);
    
    if (this.eventBus) {
        this.eventBus.emit('animation:cut-created', { 
            cutId: cut.id, 
            cutIndex: newIndex 
        });
    }
    
    return cut;
}

// ================================================================================
// 使用方法:
// ================================================================================
// 1. 既存のanimation-system.jsを開く
// 2. createNewBlankCut()メソッドを見つける（約420行目付近）
// 3. 上記のコードで置き換える
// 4. createNewEmptyCut()も上記のように修正
// 5. _syncFromStateManager()と_rebuildLayerFromData()を追加
// 6. _createNewBlankCutLegacy()も追加（フォールバック用）
//
// ⚠️ 注意: _rebuildPath()メソッドは既にanimation-system.jsに存在するはずです
//          存在しない場合は、上記のCutクラス内の_rebuildPath()をコピーしてください
// ================================================================================