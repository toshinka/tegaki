/**
 * Drawing Clipboard System - 非破壊コピー&ペースト・canonical座標管理
 * 責務: 非破壊コピー&ペースト・canonical座標管理
 */

(function() {
    'use strict';
    
    class ClipboardSystem {
        constructor(coreEngine) {
            this.coreEngine = coreEngine;
            this.app = coreEngine.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // クリップボード状態
            this.clipboardData = null;
            this.hasData = false;
            
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            if (this.CONFIG?.debug) {
                console.log('✅ ClipboardSystem initialized');
            }
        }
        
        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            // 必要に応じてEventBusイベントを購読
        }
        
        /**
         * キーボードショートカット設定
         */
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C / Cmd+C
                if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    this.copy();
                }
                
                // Ctrl+V / Cmd+V
                if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    this.paste();
                }
                
                // Ctrl+X / Cmd+X
                if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    this.cut();
                }
            });
        }
        
        // ========================================
        // 非破壊コピー機能（最重要実装）
        // ========================================
        
        /**
         * 非破壊コピー実行
         */
        copy() {
            const layerSystem = this.getLayerSystem();
            if (!layerSystem) return;
            
            const activeLayer = layerSystem.getActiveLayer();
            if (!activeLayer) {
                if (this.CONFIG?.debug) {
                    console.log('⚠️ No active layer to copy');
                }
                return;
            }
            
            // canonical座標でパス取得（変形適用済み座標）
            const canonicalPaths = layerSystem.getLayerCanonicalPaths(activeLayer.id);
            
            if (canonicalPaths.length === 0) {
                if (this.CONFIG?.debug) {
                    console.log('⚠️ No paths to copy');
                }
                return;
            }
            
            // canonical座標で保存（変形状態は保存しない）
            this.clipboardData = {
                paths: this.deepCopyPaths(canonicalPaths),
                metadata: {
                    isCanonical: true,
                    copiedAt: Date.now(),
                    originalLayerId: activeLayer.id,
                    originalLayerName: activeLayer.name,
                    pathCount: canonicalPaths.length
                }
            };
            
            this.hasData = true;
            
            // EventBus発行
            window.Tegaki.EventBus.emit('clipboard:copied', {
                layerId: activeLayer.id,
                pathCount: canonicalPaths.length,
                isCanonical: true
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Non-destructive copy completed: ${canonicalPaths.length} paths`);
            }
        }
        
        /**
         * canonical復元ペースト実行
         */
        paste() {
            if (!this.hasData || !this.clipboardData?.paths) {
                if (this.CONFIG?.debug) {
                    console.log('⚠️ No clipboard data to paste');
                }
                return;
            }
            
            const layerSystem = this.getLayerSystem();
            if (!layerSystem) return;
            
            // 新しいレイヤー作成
            const newLayerName = `コピー_${this.clipboardData.metadata.originalLayerName}_${Date.now()}`;
            const newLayer = layerSystem.createLayer(newLayerName, 'drawing');
            
            if (!newLayer) {
                if (this.CONFIG?.debug) {
                    console.log('❌ Failed to create paste layer');
                }
                return;
            }
            
            // canonical座標をそのまま復元
            this.clipboardData.paths.forEach(originalPath => {
                const restoredPath = this.deepCopyPath(originalPath);
                layerSystem.addPathToLayer(newLayer, restoredPath);
            });
            
            // レイヤーtransform初期化（重要）
            layerSystem.layerTransforms.set(newLayer.id, layerSystem.identityTransform());
            
            // アクティブレイヤーに設定
            layerSystem.setActiveLayer(newLayer.id);
            
            // EventBus発行
            window.Tegaki.EventBus.emit('clipboard:pasted', {
                newLayerId: newLayer.id,
                pathCount: this.clipboardData.paths.length,
                isCanonical: true
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Canonical paste completed: ${this.clipboardData.paths.length} paths`);
            }
        }
        
        /**
         * カット実行（コピー + 元レイヤー削除）
         */
        cut() {
            const layerSystem = this.getLayerSystem();
            if (!layerSystem) return;
            
            const activeLayer = layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            // コピー実行
            this.copy();
            
            // 元レイヤーのパスをクリア
            if (this.hasData) {
                activeLayer.layerData.paths = [];
                layerSystem.rebuildLayerGraphics(activeLayer);
                
                // EventBus発行
                window.Tegaki.EventBus.emit('clipboard:cut', {
                    layerId: activeLayer.id
                });
                
                if (this.CONFIG?.debug) {
                    console.log(`✅ Cut completed: ${activeLayer.id}`);
                }
            }
        }
        
        // ========================================
        // ディープコピーユーティリティ
        // ========================================
        
        /**
         * パス配列のディープコピー
         * @param {Array} paths - パス配列
         * @returns {Array} コピーされたパス配列
         */
        deepCopyPaths(paths) {
            if (!Array.isArray(paths)) return [];
            
            return paths.map(path => this.deepCopyPath(path));
        }
        
        /**
         * 単一パスのディープコピー
         * @param {Object} path - パス
         * @returns {Object} コピーされたパス
         */
        deepCopyPath(path) {
            if (!path) return null;
            
            const copiedPath = {
                points: [],
                color: path.color || 0x000000,
                size: path.size || 2,
                opacity: path.opacity || 1.0,
                timestamp: path.timestamp || Date.now(),
                // graphics は除外（再構築される）
            };
            
            // 点座標のディープコピー
            if (path.points && Array.isArray(path.points)) {
                copiedPath.points = path.points.map(pt => ({
                    x: pt.x,
                    y: pt.y
                }));
            }
            
            // その他のプロパティがあればコピー
            if (path.blendMode) copiedPath.blendMode = path.blendMode;
            if (path.metadata) copiedPath.metadata = {...path.metadata};
            
            return copiedPath;
        }
        
        // ========================================
        // システム参照取得
        // ========================================
        
        /**
         * LayerSystem取得
         * @returns {LayerSystem|null} レイヤーシステム
         */
        getLayerSystem() {
            return this.layerSystem || this.coreEngine?.systems?.layer || null;
        }
        
        /**
         * CameraSystem取得
         * @returns {CameraSystem|null} カメラシステム
         */
        getCameraSystem() {
            return this.cameraSystem || this.coreEngine?.systems?.camera || null;
        }
        
        // ========================================
        // クリップボード状態管理
        // ========================================
        
        /**
         * クリップボードデータ有無確認
         * @returns {boolean} データがあるか
         */
        hasClipboardData() {
            return this.hasData && !!this.clipboardData?.paths;
        }
        
        /**
         * クリップボードデータクリア
         */
        clearClipboard() {
            this.clipboardData = null;
            this.hasData = false;
            
            if (this.CONFIG?.debug) {
                console.log('✅ Clipboard cleared');
            }
        }
        
        /**
         * クリップボード情報取得
         * @returns {Object|null} クリップボード情報
         */
        getClipboardInfo() {
            if (!this.hasData || !this.clipboardData) return null;
            
            return {
                hasData: this.hasData,
                pathCount: this.clipboardData.paths?.length || 0,
                copiedAt: this.clipboardData.metadata?.copiedAt,
                isCanonical: this.clipboardData.metadata?.isCanonical || false,
                originalLayerName: this.clipboardData.metadata?.originalLayerName
            };
        }
        
        // ========================================
        // 高度なクリップボード操作
        // ========================================
        
        /**
         * オフセット付きペースト
         * @param {number} offsetX - X方向オフセット
         * @param {number} offsetY - Y方向オフセット
         */
        pasteWithOffset(offsetX = 10, offsetY = 10) {
            if (!this.hasData || !this.clipboardData?.paths) return;
            
            // 一時的にパス座標をオフセット
            const originalPaths = this.clipboardData.paths;
            const offsetPaths = originalPaths.map(path => ({
                ...this.deepCopyPath(path),
                points: path.points.map(pt => ({
                    x: pt.x + offsetX,
                    y: pt.y + offsetY
                }))
            }));
            
            // 一時的にクリップボードを置き換え
            const originalClipboard = this.clipboardData;
            this.clipboardData = {
                ...originalClipboard,
                paths: offsetPaths
            };
            
            // ペースト実行
            this.paste();
            
            // 元のクリップボードを復元
            this.clipboardData = originalClipboard;
        }
        
        /**
         * 複数回ペースト
         * @param {number} count - ペースト回数
         * @param {number} offsetX - X方向オフセット
         * @param {number} offsetY - Y方向オフセット
         */
        pasteMultiple(count = 2, offsetX = 20, offsetY = 20) {
            if (!this.hasData || !this.clipboardData?.paths) return;
            
            for (let i = 0; i < count; i++) {
                this.pasteWithOffset(offsetX * i, offsetY * i);
            }
        }
        
        // ========================================
        // 外部データ変換
        // ========================================
        
        /**
         * レイヤーからクリップボードに直接設定
         * @param {string} layerId - レイヤーID
         */
        copyLayerById(layerId) {
            const layerSystem = this.getLayerSystem();
            if (!layerSystem) return;
            
            const layer = layerSystem.getLayerById(layerId);
            if (!layer) return;
            
            // 一時的にアクティブレイヤーを変更してコピー
            const originalActiveId = layerSystem.activeLayerId;
            layerSystem.setActiveLayer(layerId);
            this.copy();
            layerSystem.setActiveLayer(originalActiveId);
        }
        
        /**
         * SVG形式でエクスポート（将来拡張用）
         * @returns {string|null} SVG文字列
         */
        exportAsSVG() {
            if (!this.hasData || !this.clipboardData?.paths) return null;
            
            // TODO: SVG形式でのエクスポート実装
            // 現在はプレースホルダー
            if (this.CONFIG?.debug) {
                console.log('📄 SVG export requested (not implemented)');
            }
            return null;
        }
        
        /**
         * JSON形式でエクスポート
         * @returns {string|null} JSON文字列
         */
        exportAsJSON() {
            if (!this.hasData || !this.clipboardData) return null;
            
            try {
                return JSON.stringify({
                    version: '1.0',
                    type: 'tegaki-clipboard',
                    data: this.clipboardData,
                    exportedAt: Date.now()
                }, null, 2);
            } catch (error) {
                if (this.CONFIG?.debug) {
                    console.error('❌ JSON export failed:', error);
                }
                return null;
            }
        }
        
        /**
         * JSON形式でインポート
         * @param {string} jsonString - JSON文字列
         * @returns {boolean} インポート成功可否
         */
        importFromJSON(jsonString) {
            try {
                const importData = JSON.parse(jsonString);
                
                if (importData.type !== 'tegaki-clipboard' || !importData.data) {
                    if (this.CONFIG?.debug) {
                        console.error('❌ Invalid clipboard JSON format');
                    }
                    return false;
                }
                
                this.clipboardData = importData.data;
                this.hasData = true;
                
                if (this.CONFIG?.debug) {
                    console.log('✅ Clipboard imported from JSON');
                }
                return true;
                
            } catch (error) {
                if (this.CONFIG?.debug) {
                    console.error('❌ JSON import failed:', error);
                }
                return false;
            }
        }
        
        // ========================================
        // 状態取得・診断
        // ========================================
        
        /**
         * システム状態取得（デバッグ用）
         */
        getState() {
            if (!this.CONFIG?.debug) return null;
            
            return {
                hasData: this.hasData,
                clipboardInfo: this.getClipboardInfo(),
                systemReferences: {
                    layerSystem: !!this.getLayerSystem(),
                    cameraSystem: !!this.getCameraSystem(),
                    coreEngine: !!this.coreEngine
                }
            };
        }
        
        /**
         * 診断情報出力
         */
        runDiagnostics() {
            if (!this.CONFIG?.debug) return;
            
            console.log('🔍 Clipboard System Diagnostics:');
            console.log('- Has Data:', this.hasData);
            console.log('- Clipboard Info:', this.getClipboardInfo());
            console.log('- Layer System Available:', !!this.getLayerSystem());
            console.log('- Camera System Available:', !!this.getCameraSystem());
            
            if (this.hasData && this.clipboardData) {
                console.log('- Paths Count:', this.clipboardData.paths?.length || 0);
                console.log('- Is Canonical:', this.clipboardData.metadata?.isCanonical);
                console.log('- Copied At:', new Date(this.clipboardData.metadata?.copiedAt));
            }
        }
    }

    // システム登録
    window.TegakiSystems.Register('ClipboardSystem', ClipboardSystem);
    
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('✅ drawing-clipboard.js loaded');
    }

})();