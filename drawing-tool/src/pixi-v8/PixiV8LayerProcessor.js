/**
 * PixiJS v8非破壊レイヤー・Container階層管理
 * モダンお絵かきツール v3.3 - Phase2レイヤー管理システム
 * 
 * 機能:
 * - PixiJS v8 Container階層管理・非破壊ベクター保持
 * - レイヤー・フォルダ階層・サムネイル生成・可視性制御
 * - ブレンドモード・不透明度・変形・順序変更
 * - ドラッグ&ドロップ階層移動・同期システム対応
 * - RenderTexture活用・高速サムネイル・メモリ効率
 */

import { Container, Graphics, RenderTexture, Text } from 'pixi.js';

/**
 * PixiJS v8レイヤー管理
 * Container階層・非破壊性・高速処理
 */
class PixiV8LayerProcessor {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.renderer = pixiApp.renderer;
        
        // レイヤー管理Container
        this.layerContainer = new Container();
        this.app.stage.addChild(this.layerContainer);
        
        // レイヤー・フォルダデータ管理
        this.layers = new Map();
        this.folders = new Map();
        this.layerOrder = [];
        
        // アクティブレイヤー
        this.activeLayerId = null;
        this.activeLayer = null;
        
        // レイヤーカウンター
        this.layerCounter = 0;
        this.folderCounter = 0;
        
        // サムネイル管理
        this.thumbnails = new Map();
        this.thumbnailSize = 64;
        this.thumbnailUpdateQueue = [];
        
        // ブレンドモード定義
        this.blendModes = {
            'normal': 'normal',
            'multiply': 'multiply',
            'screen': 'screen',
            'overlay': 'overlay',
            'darken': 'darken',
            'lighten': 'lighten',
            'colorDodge': 'color-dodge',
            'colorBurn': 'color-burn',
            'hardLight': 'hard-light',
            'softLight': 'soft-light',
            'difference': 'difference',
            'exclusion': 'exclusion'
        };
        
        // 同期システム対応
        this.syncMode = false;
        this.syncTargets = {
            layerCreate: true,
            layerDelete: true,
            folderCreate: true,
            folderDelete: true,
            hierarchy: true,
            naming: true
        };
        
        // パフォーマンス設定
        this.batchUpdates = true;
        this.updateQueue = [];
        this.updateTimer = null;
        
        this.initializeDefaultLayers();
        this.setupEventStoreIntegration();
        
        console.log('✅ PixiV8LayerProcessor初期化完了 - Container階層管理');
    }
    
    /**
     * デフォルトレイヤー初期化
     * 背景レイヤー・初期描画レイヤー作成
     */
    initializeDefaultLayers() {
        // 背景レイヤー
        const backgroundLayer = this.createLayer('背景', {
            isBackground: true,
            locked: true
        });
        
        // 初期描画レイヤー
        const drawingLayer = this.createLayer('レイヤー1', {
            makeActive: true
        });
        
        console.log('📄 デフォルトレイヤー作成完了');
    }
    
    /**
     * EventStore統合設定
     * レイヤー操作・UI連携・同期システム
     */
    setupEventStoreIntegration() {
        // レイヤー作成・削除イベント
        this.eventStore.on('layer-created', (data) => {
            this.createLayer(data.name, data.options);
        });
        
        this.eventStore.on('layer-deleted', (data) => {
            this.deleteLayer(data.layerId);
        });
        
        // フォルダ作成・削除イベント
        this.eventStore.on('folder-created', (data) => {
            this.createFolder(data.name, data.options);
        });
        
        this.eventStore.on('folder-deleted', (data) => {
            this.deleteFolder(data.folderId);
        });
        
        // レイヤー操作イベント
        this.eventStore.on('layer-clear', (data) => {
            this.clearLayer(data.target === 'active' ? this.activeLayerId : data.layerId);
        });
        
        this.eventStore.on('layer-navigation', (data) => {
            this.navigateLayer(data.direction);
        });
        
        this.eventStore.on('folder-navigation', (data) => {
            this.navigateFolder(data.direction);
        });
        
        // 描画要素追加イベント
        this.eventStore.on('add-to-active-layer', (data) => {
            this.addGraphicsToActiveLayer(data.graphics);
        });
        
        this.eventStore.on('add-to-overlay-layer', (data) => {
            this.addGraphicsToOverlay(data.graphics);
        });
        
        // 同期システムイベント
        this.eventStore.on('animation-sync-toggle', () => {
            this.toggleSyncMode();
        });
        
        console.log('🔗 EventStore統合完了');
    }
    
    /**
     * レイヤー作成
     * Container・メタデータ・UI統合
     */
    createLayer(name, options = {}) {
        const layerId = this.generateLayerId();
        const layerName = name || `レイヤー${this.layerCounter + 1}`;
        
        // PixiJS Container作成
        const container = new Container();
        container.name = layerName;
        
        // レイヤーメタデータ
        const layerData = {
            id: layerId,
            name: layerName,
            container: container,
            visible: options.visible !== false,
            opacity: options.opacity || 1.0,
            blendMode: options.blendMode || 'normal',
            locked: options.locked || false,
            isBackground: options.isBackground || false,
            parentFolder: options.parentFolder || null,
            created: Date.now(),
            modified: Date.now(),
            vectorStrokes: [],
            thumbnailDirty: true
        };
        
        // Container設定適用
        container.visible = layerData.visible;
        container.alpha = layerData.opacity;
        container.blendMode = this.blendModes[layerData.blendMode];
        
        // レイヤー登録
        this.layers.set(layerId, layerData);
        this.layerOrder.push(layerId);
        this.layerCounter++;
        
        // Container階層追加
        if (layerData.parentFolder) {
            const folder = this.folders.get(layerData.parentFolder);
            if (folder) {
                folder.container.addChild(container);
            } else {
                this.layerContainer.addChild(container);
            }
        } else {
            this.layerContainer.addChild(container);
        }
        
        // 背景レイヤーの場合は最背面に移動
        if (layerData.isBackground) {
            this.layerContainer.setChildIndex(container, 0);
        }
        
        // アクティブレイヤー設定
        if (options.makeActive || this.activeLayerId === null) {
            this.setActiveLayer(layerId);
        }
        
        // サムネイル更新予約
        this.scheduleThunbnailUpdate(layerId);
        
        // UI更新通知
        this.eventStore.emit('layer-list-updated', {
            type: 'layer-created',
            layerId: layerId,
            layerData: this.getLayerPublicData(layerData),
            timestamp: Date.now()
        });
        
        console.log(`📄 レイヤー作成: ${layerName} [${layerId}]`);
        return layerId;
    }
    
    /**
     * フォルダ作成
     * 階層管理・Container入れ子構造
     */
    createFolder(name, options = {}) {
        const folderId = this.generateFolderId();
        const folderName = name || `フォルダ${this.folderCounter + 1}`;
        
        // フォルダContainer作成
        const container = new Container();
        container.name = folderName;
        
        // フォルダメタデータ
        const folderData = {
            id: folderId,
            name: folderName,
            container: container,
            visible: options.visible !== false,
            opacity: options.opacity || 1.0,
            blendMode: options.blendMode || 'normal',
            expanded: options.expanded !== false,
            parentFolder: options.parentFolder || null,
            childLayers: [],
            childFolders: [],
            created: Date.now(),
            modified: Date.now()
        };
        
        // Container設定適用
        container.visible = folderData.visible;
        container.alpha = folderData.opacity;
        container.blendMode = this.blendModes[folderData.blendMode];
        
        // フォルダ登録
        this.folders.set(folderId, folderData);
        this.folderCounter++;
        
        // Container階層追加
        if (folderData.parentFolder) {
            const parentFolder = this.folders.get(folderData.parentFolder);
            if (parentFolder) {
                parentFolder.container.addChild(container);
                parentFolder.childFolders.push(folderId);
            } else {
                this.layerContainer.addChild(container);
            }
        } else {
            this.layerContainer.addChild(container);
        }
        
        // UI更新通知
        this.eventStore.emit('layer-list-updated', {
            type: 'folder-created',
            folderId: folderId,
            folderData: this.getFolderPublicData(folderData),
            timestamp: Date.now()
        });
        
        console.log(`📁 フォルダ作成: ${folderName} [${folderId}]`);
        return folderId;
    }
    
    /**
     * レイヤー削除
     * Container削除・参照クリア・UI更新
     */
    deleteLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`⚠️ 存在しないレイヤー削除要求: ${layerId}`);
            return false;
        }
        
        // 背景レイヤー削除禁止
        if (layer.isBackground) {
            console.warn('⚠️ 背景レイヤーは削除できません');
            return false;
        }
        
        // アクティブレイヤーの場合は別のレイヤーをアクティブに
        if (this.activeLayerId === layerId) {
            const remainingLayers = this.layerOrder.filter(id => id !== layerId);
            if (remainingLayers.length > 0) {
                this.setActiveLayer(remainingLayers[remainingLayers.length - 1]);
            } else {
                this.activeLayerId = null;
                this.activeLayer = null;
            }
        }
        
        // Container削除（子要素も自動削除）
        if (layer.container.parent) {
            layer.container.parent.removeChild(layer.container);
        }
        layer.container.destroy({ children: true });
        
        // 親フォルダから削除
        if (layer.parentFolder) {
            const folder = this.folders.get(layer.parentFolder);
            if (folder) {
                folder.childLayers = folder.childLayers.filter(id => id !== layerId);
            }
        }
        
        // データ削除
        this.layers.delete(layerId);
        this.layerOrder = this.layerOrder.filter(id => id !== layerId);
        this.thumbnails.delete(layerId);
        
        // UI更新通知
        this.eventStore.emit('layer-list-updated', {
            type: 'layer-deleted',
            layerId: layerId,
            timestamp: Date.now()
        });
        
        console.log(`🗑️ レイヤー削除: ${layer.name} [${layerId}]`);
        return true;
    }
    
    /**
     * フォルダ削除
     * 子要素も含めた再帰削除
     */
    deleteFolder(folderId) {
        const folder = this.folders.get(folderId);
        if (!folder) {
            console.warn(`⚠️ 存在しないフォルダ削除要求: ${folderId}`);
            return false;
        }
        
        // 子レイヤーを削除
        [...folder.childLayers].forEach(layerId => {
            this.deleteLayer(layerId);
        });
        
        // 子フォルダを削除（再帰）
        [...folder.childFolders].forEach(childFolderId => {
            this.deleteFolder(childFolderId);
        });
        
        // Container削除
        if (folder.container.parent) {
            folder.container.parent.removeChild(folder.container);
        }
        folder.container.destroy({ children: true });
        
        // 親フォルダから削除
        if (folder.parentFolder) {
            const parentFolder = this.folders.get(folder.parentFolder);
            if (parentFolder) {
                parentFolder.childFolders = parentFolder.childFolders.filter(id => id !== folderId);
            }
        }
        
        // データ削除
        this.folders.delete(folderId);
        
        // UI更新通知
        this.eventStore.emit('layer-list-updated', {
            type: 'folder-deleted',
            folderId: folderId,
            timestamp: Date.now()
        });
        
        console.log(`🗑️ フォルダ削除: ${folder.name} [${folderId}]`);
        return true;
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`⚠️ 存在しないレイヤーをアクティブ化: ${layerId}`);
            return false;
        }
        
        this.activeLayerId = layerId;
        this.activeLayer = layer;
        
        // UI更新通知
        this.eventStore.emit('active-layer-changed', {
            layerId: layerId,
            layerName: layer.name,
            timestamp: Date.now()
        });
        
        console.log(`🎯 アクティブレイヤー: ${layer.name} [${layerId}]`);
        return true;
    }
    
    /**
     * レイヤークリア
     */
    clearLayer(layerId = null) {
        const targetLayerId = layerId || this.activeLayerId;
        const layer = this.layers.get(targetLayerId);
        
        if (!layer) {
            console.warn(`⚠️ クリア対象レイヤーが存在しません: ${targetLayerId}`);
            return false;
        }
        
        // Container子要素削除
        layer.container.removeChildren();
        
        // ベクターデータクリア
        layer.vectorStrokes = [];
        layer.modified = Date.now();
        layer.thumbnailDirty = true;
        
        // サムネイル更新予約
        this.scheduleThunbnailUpdate(targetLayerId);
        
        console.log(`🗑️ レイヤークリア: ${layer.name} [${targetLayerId}]`);
        return true;
    }
    
    /**
     * アクティブレイヤーにGraphics追加
     */
    addGraphicsToActiveLayer(graphics) {
        if (!this.activeLayer) {
            console.warn('⚠️ アクティブレイヤーが設定されていません');
            return false;
        }
        
        this.activeLayer.container.addChild(graphics);
        
        // ベクターデータ保存（非破壊性保証）
        if (graphics.vectorData) {
            this.activeLayer.vectorStrokes.push({
                ...graphics.vectorData,
                id: this.generateStrokeId(),
                timestamp: Date.now()
            });
        }
        
        this.activeLayer.modified = Date.now();
        this.activeLayer.thumbnailDirty = true;
        
        // サムネイル更新予約
        this.scheduleThunbnailUpdate(this.activeLayerId);
        
        return true;
    }
    
    /**
     * オーバーレイレイヤーにGraphics追加
     */
    addGraphicsToOverlay(graphics) {
        // オーバーレイ用の特別レイヤー（UI要素用）
        if (!this.overlayLayer) {
            this.overlayLayer = new Container();
            this.overlayLayer.name = 'overlay';
            this.app.stage.addChild(this.overlayLayer);
        }
        
        this.overlayLayer.addChild(graphics);
        return true;
    }
    
    /**
     * レイヤー可視性切り替え
     */
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        layer.visible = !layer.visible;
        layer.container.visible = layer.visible;
        layer.modified = Date.now();
        
        // UI更新通知
        this.eventStore.emit('layer-visibility-changed', {
            layerId: layerId,
            visible: layer.visible,
            timestamp: Date.now()
        });
        
        console.log(`👁️ レイヤー可視性: ${layer.name} - ${layer.visible ? '表示' : '非表示'}`);
        return true;
    }
    
    /**
     * レイヤー不透明度設定
     */
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        layer.opacity = Math.max(0, Math.min(1, opacity));
        layer.container.alpha = layer.opacity;
        layer.modified = Date.now();
        
        // UI更新通知
        this.eventStore.emit('layer-opacity-changed', {
            layerId: layerId,
            opacity: layer.opacity,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    /**
     * レイヤーブレンドモード設定
     */
    setLayerBlendMode(layerId, blendMode) {
        const layer = this.layers.get(layerId);
        if (!layer || !this.blendModes[blendMode]) return false;
        
        layer.blendMode = blendMode;
        layer.container.blendMode = this.blendModes[blendMode];
        layer.modified = Date.now();
        
        console.log(`🎨 ブレンドモード: ${layer.name} - ${blendMode}`);
        return true;
    }
    
    /**
     * レイヤー順序変更
     */
    moveLayer(layerId, direction) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        const currentIndex = this.layerOrder.indexOf(layerId);
        if (currentIndex === -1) return false;
        
        let newIndex;
        switch (direction) {
            case 'up':
                newIndex = Math.min(this.layerOrder.length - 1, currentIndex + 1);
                break;
            case 'down':
                newIndex = Math.max(0, currentIndex - 1);
                break;
            case 'top':
                newIndex = this.layerOrder.length - 1;
                break;
            case 'bottom':
                newIndex = 0;
                break;
            default:
                return false;
        }
        
        if (newIndex === currentIndex) return false;
        
        // 配列順序変更
        this.layerOrder.splice(currentIndex, 1);
        this.layerOrder.splice(newIndex, 0, layerId);
        
        // Container順序変更
        const parentContainer = layer.container.parent;
        if (parentContainer) {
            parentContainer.setChildIndex(layer.container, newIndex);
        }
        
        // UI更新通知
        this.eventStore.emit('layer-order-changed', {
            layerId: layerId,
            oldIndex: currentIndex,
            newIndex: newIndex,
            timestamp: Date.now()
        });
        
        console.log(`📐 レイヤー移動: ${layer.name} - ${direction}`);
        return true;
    }
    
    /**
     * レイヤーナビゲーション（キーボード操作用）
     */
    navigateLayer(direction) {
        if (!this.activeLayerId) return false;
        
        const currentIndex = this.layerOrder.indexOf(this.activeLayerId);
        if (currentIndex === -1) return false;
        
        let targetIndex;
        switch (direction) {
            case 'up':
                targetIndex = Math.min(this.layerOrder.length - 1, currentIndex + 1);
                break;
            case 'down':
                targetIndex = Math.max(0, currentIndex - 1);
                break;
            default:
                return false;
        }
        
        const targetLayerId = this.layerOrder[targetIndex];
        return this.setActiveLayer(targetLayerId);
    }
    
    /**
     * フォルダナビゲーション
     */
    navigateFolder(direction) {
        // フォルダ間移動ロジック
        console.log(`📁 フォルダナビゲーション: ${direction}`);
        // Phase3で詳細実装
        return false;
    }
    
    /**
     * サムネイル生成
     * PixiJS v8 RenderTexture活用・高速処理
     */
    generateThumbnail(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return null;
        
        try {
            // レイヤーに描画内容がない場合
            if (layer.container.children.length === 0) {
                return this.createEmptyThumbnail();
            }
            
            // レイヤーの境界取得
            const bounds = layer.container.getBounds();
            if (bounds.width <= 0 || bounds.height <= 0) {
                return this.createEmptyThumbnail();
            }
            
            // RenderTexture作成
            const renderTexture = RenderTexture.create({
                width: this.thumbnailSize,
                height: this.thumbnailSize
            });
            
            // スケール計算（アスペクト比保持）
            const scale = Math.min(
                this.thumbnailSize / bounds.width,
                this.thumbnailSize / bounds.height
            );
            
            // 一時的な変形適用
            const originalTransform = {
                x: layer.container.x,
                y: layer.container.y,
                scaleX: layer.container.scale.x,
                scaleY: layer.container.scale.y
            };
            
            layer.container.x = -bounds.x * scale + (this.thumbnailSize - bounds.width * scale) / 2;
            layer.container.y = -bounds.y * scale + (this.thumbnailSize - bounds.height * scale) / 2;
            layer.container.scale.set(scale);
            
            // レンダリング実行
            this.renderer.render(layer.container, { renderTexture });
            
            // 変形復元
            layer.container.x = originalTransform.x;
            layer.container.y = originalTransform.y;
            layer.container.scale.set(originalTransform.scaleX, originalTransform.scaleY);
            
            // DataURL変換
            const canvas = this.renderer.extract.canvas(renderTexture);
            const dataURL = canvas.toDataURL('image/png');
            
            // リソース解放
            renderTexture.destroy();
            
            // キャッシュに保存
            this.thumbnails.set(layerId, {
                dataURL: dataURL,
                timestamp: Date.now(),
                size: this.thumbnailSize
            });
            
            layer.thumbnailDirty = false;
            
            return dataURL;
            
        } catch (error) {
            console.error(`❌ サムネイル生成エラー [${layerId}]:`, error);
            return this.createEmptyThumbnail();
        }
    }
    
    /**
     * 空サムネイル作成
     */
    createEmptyThumbnail() {
        const canvas = document.createElement('canvas');
        canvas.width = this.thumbnailSize;
        canvas.height = this.thumbnailSize;
        const ctx = canvas.getContext('2d');
        
        // 透明背景 + 枠線
        ctx.fillStyle = 'rgba(240,224,214,0.1)';
        ctx.fillRect(0, 0, this.thumbnailSize, this.thumbnailSize);
        
        ctx.strokeStyle = 'rgba(128,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, this.thumbnailSize, this.thumbnailSize);
        
        return canvas.toDataURL('image/png');
    }
    
    /**
     * サムネイル更新予約
     * バッチ処理でパフォーマンス最適化
     */
    scheduleThunbnailUpdate(layerId) {
        if (!this.thumbnailUpdateQueue.includes(layerId)) {
            this.thumbnailUpdateQueue.push(layerId);
        }
        
        if (this.batchUpdates && !this.updateTimer) {
            this.updateTimer = setTimeout(() => {
                this.processThumbnailUpdates();
            }, 100); // 100ms後にバッチ処理
        }
    }
    
    /**
     * サムネイル更新バッチ処理
     */
    processThumbnailUpdates() {
        const layersToUpdate = [...this.thumbnailUpdateQueue];
        this.thumbnailUpdateQueue = [];
        this.updateTimer = null;
        
        layersToUpdate.forEach(layerId => {
            if (this.layers.has(layerId)) {
                this.generateThumbnail(layerId);
            }
        });
        
        // UI更新通知
        if (layersToUpdate.length > 0) {
            this.eventStore.emit('thumbnails-updated', {
                layerIds: layersToUpdate,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 同期モード切り替え（アニメーション用）
     */
    toggleSyncMode() {
        this.syncMode = !this.syncMode;
        
        this.eventStore.emit('layer-sync-mode-changed', {
            enabled: this.syncMode,
            targets: this.syncTargets,
            timestamp: Date.now()
        });
        
        console.log(`🔄 レイヤー同期モード: ${this.syncMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * レイヤー公開データ取得（UI用）
     */
    getLayerPublicData(layer) {
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            locked: layer.locked,
            isBackground: layer.isBackground,
            parentFolder: layer.parentFolder,
            thumbnailURL: this.thumbnails.get(layer.id)?.dataURL || null,
            strokeCount: layer.vectorStrokes.length,
            created: layer.created,
            modified: layer.modified
        };
    }
    
    /**
     * フォルダ公開データ取得（UI用）
     */
    getFolderPublicData(folder) {
        return {
            id: folder.id,
            name: folder.name,
            visible: folder.visible,
            opacity: folder.opacity,
            blendMode: folder.blendMode,
            expanded: folder.expanded,
            parentFolder: folder.parentFolder,
            childLayers: [...folder.childLayers],
            childFolders: [...folder.childFolders],
            created: folder.created,
            modified: folder.modified
        };
    }
    
    /**
     * 全レイヤー一覧取得
     */
    getAllLayers() {
        const layers = [];
        this.layerOrder.forEach(layerId => {
            const layer = this.layers.get(layerId);
            if (layer) {
                layers.push(this.getLayerPublicData(layer));
            }
        });
        return layers;
    }
    
    /**
     * 全フォルダ一覧取得
     */
    getAllFolders() {
        const folders = [];
        this.folders.forEach(folder => {
            folders.push(this.getFolderPublicData(folder));
        });
        return folders;
    }
    
    /**
     * アクティブレイヤー情報取得
     */
    getActiveLayerInfo() {
        if (!this.activeLayer) return null;
        return this.getLayerPublicData(this.activeLayer);
    }
    
    /**
     * レイヤー階層構造取得
     */
    getLayerHierarchy() {
        // 階層構造をツリー形式で返す
        const hierarchy = {
            layers: [],
            folders: []
        };
        
        // ルート要素（親フォルダなし）を取得
        this.layerOrder.forEach(layerId => {
            const layer = this.layers.get(layerId);
            if (layer && !layer.parentFolder) {
                hierarchy.layers.push(this.getLayerPublicData(layer));
            }
        });
        
        this.folders.forEach(folder => {
            if (!folder.parentFolder) {
                hierarchy.folders.push(this.getFolderPublicData(folder));
            }
        });
        
        return hierarchy;
    }
    
    /**
     * ユーティリティ: ID生成
     */
    generateLayerId() {
        return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateFolderId() {
        return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateStrokeId() {
        return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            layerCount: this.layers.size,
            folderCount: this.folders.size,
            activeLayerId: this.activeLayerId,
            syncMode: this.syncMode,
            thumbnailCacheSize: this.thumbnails.size,
            updateQueueSize: this.thumbnailUpdateQueue.length,
            layerOrder: [...this.layerOrder],
            layerCounters: {
                layer: this.layerCounter,
                folder: this.folderCounter
            }
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 更新タイマークリア
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        // 全レイヤー削除
        this.layers.forEach((layer, layerId) => {
            this.deleteLayer(layerId);
        });
        
        // 全フォルダ削除
        this.folders.forEach((folder, folderId) => {
            this.deleteFolder(folderId);
        });
        
        // コンテナ削除
        if (this.layerContainer.parent) {
            this.layerContainer.parent.removeChild(this.layerContainer);
        }
        this.layerContainer.destroy({ children: true });
        
        if (this.overlayLayer) {
            if (this.overlayLayer.parent) {
                this.overlayLayer.parent.removeChild(this.overlayLayer);
            }
            this.overlayLayer.destroy({ children: true });
        }
        
        // マップクリア
        this.layers.clear();
        this.folders.clear();
        this.thumbnails.clear();
        
        // 配列クリア
        this.layerOrder = [];
        this.thumbnailUpdateQueue = [];
        
        // 参照クリア
        this.activeLayer = null;
        this.activeLayerId = null;
        
        console.log('🗑️ PixiV8LayerProcessor リソース解放完了');
    }
}

export default PixiV8LayerProcessor;