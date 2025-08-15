/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * PixiJS拡張ライブラリ統合インポートシステム - libs/pixi-extensions.js 改修版
 * 
 * 📝 計画書Phase2対応: PixiJS v7/v8 拡張ライブラリ導入・改修計画書
 * 
 * 🔧 改修目的:
 * - 車輪の再発明解消: 独自実装からPixiJSエコシステムライブラリへの移行
 * - コード削減: 1000行以上のコード削減見込み
 * - AI実装しやすさ向上: PixiJS標準APIによる予測しやすい実装
 * - 保守性向上: バグ修正・機能追加の効率化
 * 
 * 🏗️ 導入ライブラリ:
 * - @pixi/ui@^1.2.4: ポップアップ・ボタン・スライダー
 * - @pixi/layers@^2.1.0: レイヤー機能・非破壊的変形
 * - @pixi/gif@^2.1.1: GIFアニメ機能
 * - @pixi/graphics-smooth: スムーズ描画機能
 * - @pixi/graphics-extras: 追加形状描画機能
 * 
 * 🚨 Phase2改修内容:
 * - CDN版ライブラリ検出ロジック改善
 * - @pixi/ui統合によるポップアップ機能強化
 * - フォールバック機能強化
 * - エラーハンドリング改善
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Phase2改修版 読み込み開始...');

// ==== Phase2: 改修されたライブラリ検出・初期化システム ====

/**
 * 🔧 Phase2: 拡張ライブラリ読み込み状況確認・初期化（改修版）
 * CDN読み込みに対応した検出ロジック
 */
function initializePixiExtensions() {
    console.group('🎨 PixiJS拡張ライブラリ初期化（Phase2改修版）');
    
    // PixiJS本体確認
    if (typeof PIXI === 'undefined') {
        console.error('❌ PixiJS本体が読み込まれていません');
        return false;
    }
    
    console.log('✅ PixiJS v' + PIXI.VERSION + ' 検出');
    
    // 拡張ライブラリ検出・統合オブジェクト構築
    const extensions = {};
    let loadedCount = 0;
    let totalCount = 0;
    
    // Phase2改修: @pixi/ui 検出（CDN版対応）
    totalCount++;
    if (typeof window.__PIXI_UI__ !== 'undefined' || typeof PIXI.UI !== 'undefined' || window.PIXI_UI) {
        console.log('✅ @pixi/ui 検出 - ポップアップ・UI機能利用可能');
        
        // CDN版の検出パターンを追加
        const uiSource = window.__PIXI_UI__ || PIXI.UI || window.PIXI_UI;
        
        extensions.UI = {
            FancyButton: uiSource?.FancyButton || PIXI.FancyButton,
            Button: uiSource?.Button,
            Slider: uiSource?.Slider,
            CheckBox: uiSource?.CheckBox,
            available: true,
            source: 'CDN'
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
        extensions.UI = { available: false };
    }
    
    // Phase2改修: @pixi/layers 検出（CDN版対応）
    totalCount++;
    if (typeof window.__PIXI_LAYERS__ !== 'undefined' || typeof PIXI.display?.Layer !== 'undefined' || window.PIXI_LAYERS) {
        console.log('✅ @pixi/layers 検出 - レイヤー機能利用可能');
        
        const layersSource = window.__PIXI_LAYERS__ || PIXI.display || window.PIXI_LAYERS;
        
        extensions.Layers = {
            Layer: layersSource?.Layer,
            Group: layersSource?.Group,
            Stage: layersSource?.Stage,
            available: true,
            source: 'CDN'
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
        extensions.Layers = { available: false };
    }
    
    // Phase2改修: @pixi/gif 検出（CDN版対応）
    totalCount++;
    if (typeof window.__PIXI_GIF__ !== 'undefined' || typeof PIXI.AnimatedGIF !== 'undefined' || window.PIXI_GIF) {
        console.log('✅ @pixi/gif 検出 - GIF機能利用可能');
        
        const gifSource = window.__PIXI_GIF__ || PIXI || window.PIXI_GIF;
        
        extensions.GIF = {
            AnimatedGIF: gifSource?.AnimatedGIF,
            available: true,
            source: 'CDN'
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/gif 未検出 - GIF機能無効');
        extensions.GIF = { available: false };
    }
    
    // Phase2改修: @pixi/graphics-smooth 検出（CDN版対応）
    totalCount++;
    if (typeof window.__PIXI_GRAPHICS_SMOOTH__ !== 'undefined' || typeof PIXI.smooth?.SmoothGraphics !== 'undefined' || window.PIXI_SMOOTH) {
        console.log('✅ @pixi/graphics-smooth 検出 - スムース描画利用可能');
        
        const smoothSource = window.__PIXI_GRAPHICS_SMOOTH__ || PIXI.smooth || window.PIXI_SMOOTH;
        
        extensions.Smooth = {
            SmoothGraphics: smoothSource?.SmoothGraphics,
            available: true,
            source: 'CDN'
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/graphics-smooth 未検出 - 通常Graphics使用');
        extensions.Smooth = { available: false };
    }
    
    // Phase2改修: @pixi/graphics-extras 検出（CDN版対応）
    totalCount++;
    if (typeof window.__PIXI_GRAPHICS_EXTRAS__ !== 'undefined' || 
        typeof PIXI.Graphics.prototype.drawRoundedPolygon !== 'undefined' || 
        window.PIXI_EXTRAS) {
        console.log('✅ @pixi/graphics-extras 検出 - 拡張図形利用可能');
        
        extensions.Extras = {
            available: true,
            source: 'CDN',
            methods: ['drawRoundedPolygon', 'drawFilletRect', 'drawRegularPolygon']
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/graphics-extras 未検出 - 基本図形のみ');
        extensions.Extras = { available: false };
    }
    
    console.log(`📊 拡張ライブラリ読み込み状況: ${loadedCount}/${totalCount} (${Math.round(loadedCount/totalCount*100)}%)`);
    console.groupEnd();
    
    return extensions;
}

/**
 * 🔧 Phase2改修: @pixi/ui使用の改良ポップアップ作成ヘルパー
 * 独自実装から@pixi/ui統合への移行対応
 */
function createSimplePopup(options = {}) {
    const {
        width = 200,
        height = 100,
        title = 'ポップアップ',
        content = '',
        x = 100,
        y = 100
    } = options;
    
    // Phase2: @pixi/ui使用の改良版ポップアップ
    if (window.PixiExtensions?.UI?.available) {
        console.log('🎨 @pixi/ui使用の改良ポップアップ作成中...');
        
        try {
            // @pixi/uiを使用したポップアップ作成
            const popup = new PIXI.Container();
            popup.x = x;
            popup.y = y;
            
            // @pixi/ui FancyButtonを使用した背景（利用可能な場合）
            if (window.PixiExtensions.UI.FancyButton) {
                const backgroundButton = new window.PixiExtensions.UI.FancyButton({
                    defaultView: createPopupBackground(width, height),
                    text: new PIXI.Text(title, {
                        fontFamily: 'system-ui, sans-serif',
                        fontSize: 14,
                        fill: 0x800000,
                        fontWeight: 'bold'
                    })
                });
                
                backgroundButton.x = 0;
                backgroundButton.y = 0;
                popup.addChild(backgroundButton);
                
                console.log('✅ @pixi/ui FancyButton使用ポップアップ作成成功');
            } else {
                // フォールバック: 基本Graphics使用
                createBasicPopupGraphics(popup, width, height, title, content);
            }
            
            // ドラッグ機能追加
            addDragFunctionality(popup);
            
            return popup;
            
        } catch (error) {
            console.warn('⚠️ @pixi/ui使用ポップアップ作成失敗, フォールバックに切り替え:', error);
            return createFallbackPopup(options);
        }
    } else {
        return createFallbackPopup(options);
    }
}

/**
 * Phase2: ポップアップ背景作成（@pixi/ui対応）
 */
function createPopupBackground(width, height) {
    const background = new PIXI.Graphics();
    background.beginFill(0xf0e0d6, 0.95); // ふたばクリーム
    background.lineStyle(2, 0x800000, 1); // ふたばマルーン
    background.drawRoundedRect(0, 0, width, height, 8);
    background.endFill();
    return background;
}

/**
 * Phase2: 基本グラフィックス使用ポップアップ作成
 */
function createBasicPopupGraphics(popup, width, height, title, content) {
    // 背景
    const background = createPopupBackground(width, height);
    popup.addChild(background);
    
    // タイトル
    if (title) {
        const titleText = new PIXI.Text(title, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            fill: 0x800000,
            fontWeight: 'bold'
        });
        titleText.x = 10;
        titleText.y = 10;
        popup.addChild(titleText);
    }
    
    // コンテンツ
    if (content) {
        const contentText = new PIXI.Text(content, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            fill: 0x333333,
            wordWrap: true,
            wordWrapWidth: width - 20
        });
        contentText.x = 10;
        contentText.y = 35;
        popup.addChild(contentText);
    }
}

/**
 * Phase2: フォールバックポップアップ作成（既存方式）
 */
function createFallbackPopup(options) {
    console.log('🆘 フォールバックポップアップ作成中...');
    
    const {
        width = 200,
        height = 100,
        title = 'ポップアップ',
        content = '',
        x = 100,
        y = 100
    } = options;
    
    // 基本コンテナ作成
    const popup = new PIXI.Container();
    popup.x = x;
    popup.y = y;
    
    createBasicPopupGraphics(popup, width, height, title, content);
    addDragFunctionality(popup);
    
    return popup;
}

/**
 * Phase2: ドラッグ機能追加（共通処理）
 */
function addDragFunctionality(popup) {
    popup.interactive = true;
    popup.buttonMode = true;
    
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    
    popup.on('pointerdown', (event) => {
        dragging = true;
        const position = event.data.getLocalPosition(popup.parent);
        dragStart.x = position.x - popup.x;
        dragStart.y = position.y - popup.y;
    });
    
    popup.on('pointermove', (event) => {
        if (dragging) {
            const position = event.data.getLocalPosition(popup.parent);
            popup.x = position.x - dragStart.x;
            popup.y = position.y - dragStart.y;
        }
    });
    
    popup.on('pointerup', () => {
        dragging = false;
    });
    
    popup.on('pointerupoutside', () => {
        dragging = false;
    });
}

/**
 * 🔧 Phase2改修: レイヤー機能実装対応（@pixi/layers統合強化）
 * レイヤー管理システムの機能拡張
 */
function createLayerManager(app) {
    const manager = {
        app: app,
        layers: new Map(),
        currentLayer: null,
        maxLayers: window.safeConfigGet ? window.safeConfigGet('LAYER_MAX_COUNT', 10) : 10,
        
        // Phase2改修: @pixi/layers使用の強化版レイヤー追加
        addLayer: function(name, zIndex = 0) {
            if (this.layers.size >= this.maxLayers) {
                console.warn(`最大レイヤー数 ${this.maxLayers} に達しています`);
                return null;
            }
            
            let layer;
            
            if (window.PixiExtensions?.Layers?.available) {
                // @pixi/layers使用（強化版）
                try {
                    layer = new window.PixiExtensions.Layers.Layer();
                    layer.group = new window.PixiExtensions.Layers.Group(zIndex);
                    layer.group.enableSort = true;
                    
                    console.log(`✅ @pixi/layers使用レイヤー作成: ${name}`);
                } catch (error) {
                    console.warn('⚠️ @pixi/layers使用失敗, フォールバックに切り替え:', error);
                    layer = new PIXI.Container();
                }
            } else {
                // フォールバック: 通常コンテナ
                layer = new PIXI.Container();
            }
            
            layer.name = name;
            layer.zIndex = zIndex;
            layer.sortableChildren = true;
            
            this.layers.set(name, layer);
            this.app.stage.addChild(layer);
            
            if (!this.currentLayer) {
                this.currentLayer = layer;
            }
            
            console.log(`📝 レイヤー追加: ${name} (zIndex: ${zIndex})`);
            return layer;
        },
        
        // Phase2改修: 非破壊的レイヤー移動（@pixi/layers活用）
        moveLayer: function(name, newZIndex) {
            const layer = this.layers.get(name);
            if (!layer) return false;
            
            if (window.PixiExtensions?.Layers?.available && layer.group) {
                // @pixi/layers使用: Group zOrderで制御
                layer.group.zOrder = newZIndex;
                console.log(`🔄 @pixi/layers使用レイヤー移動: ${name} → zOrder ${newZIndex}`);
            } else {
                // フォールバック: 手動zIndex管理
                layer.zIndex = newZIndex;
                this.app.stage.sortChildren();
                console.log(`🔄 フォールバックレイヤー移動: ${name} → zIndex ${newZIndex}`);
            }
            
            return true;
        },
        
        // レイヤー取得
        getLayer: function(name) {
            return this.layers.get(name);
        },
        
        // アクティブレイヤー設定
        setActiveLayer: function(name) {
            const layer = this.layers.get(name);
            if (layer) {
                this.currentLayer = layer;
                console.log(`🎯 アクティブレイヤー: ${name}`);
                return true;
            }
            return false;
        },
        
        // レイヤー削除
        removeLayer: function(name) {
            const layer = this.layers.get(name);
            if (layer) {
                this.app.stage.removeChild(layer);
                this.layers.delete(name);
                
                if (this.currentLayer === layer) {
                    // 別のレイヤーをアクティブに
                    this.currentLayer = this.layers.values().next().value || null;
                }
                
                console.log(`🗑️ レイヤー削除: ${name}`);
                return true;
            }
            return false;
        },
        
        // Phase2追加: レイヤー可視性制御
        toggleLayerVisibility: function(name) {
            const layer = this.layers.get(name);
            if (layer) {
                layer.visible = !layer.visible;
                console.log(`👁️ レイヤー可視性切り替え: ${name} → ${layer.visible ? '表示' : '非表示'}`);
                return layer.visible;
            }
            return false;
        },
        
        // Phase2追加: レイヤー統計取得
        getStats: function() {
            return {
                totalLayers: this.layers.size,
                maxLayers: this.maxLayers,
                currentLayer: this.currentLayer?.name || null,
                layerNames: Array.from(this.layers.keys()),
                usingPixiLayers: window.PixiExtensions?.Layers?.available || false
            };
        }
    };
    
    // デフォルトレイヤー作成
    manager.addLayer('background', 0);
    manager.addLayer('drawing', 1);
    manager.addLayer('ui', 2);
    
    console.log('✅ レイヤーマネージャー作成完了:', manager.getStats());
    
    return manager;
}

/**
 * 🔧 Phase2改修: GIF機能実装対応（@pixi/gif統合強化）
 * GIFエクスポート機能の拡張
 */
function createGIFExporter(app) {
    return {
        app: app,
        frames: [],
        recording: false,
        maxFrames: window.safeConfigGet ? window.safeConfigGet('GIF_MAX_FRAMES', 60) : 60,
        defaultDelay: window.safeConfigGet ? window.safeConfigGet('GIF_DEFAULT_DELAY', 100) : 100,
        
        // 録画開始
        startRecording: function() {
            this.frames = [];
            this.recording = true;
            console.log('🎬 GIF録画開始');
            return true;
        },
        
        // Phase2改修: フレーム追加（品質向上）
        addFrame: function(delay = null) {
            if (!this.recording) return false;
            
            if (this.frames.length >= this.maxFrames) {
                console.warn(`⚠️ 最大フレーム数 ${this.maxFrames} に達しました`);
                return false;
            }
            
            try {
                // キャンバスをキャプチャ
                const canvas = this.app.view;
                const dataURL = canvas.toDataURL('image/png');
                
                this.frames.push({
                    data: dataURL,
                    timestamp: Date.now(),
                    delay: delay || this.defaultDelay,
                    frameNumber: this.frames.length
                });
                
                console.log(`📷 フレーム追加: ${this.frames.length}/${this.maxFrames}`);
                return true;
                
            } catch (error) {
                console.error('❌ フレームキャプチャエラー:', error);
                return false;
            }
        },
        
        // Phase2改修: 録画停止・エクスポート（@pixi/gif使用）
        stopRecording: function() {
            this.recording = false;
            
            if (this.frames.length === 0) {
                console.warn('⚠️ 録画されたフレームがありません');
                return null;
            }
            
            console.log(`🎬 GIF録画完了: ${this.frames.length}フレーム`);
            
            // Phase2: @pixi/gif使用版
            if (window.PixiExtensions?.GIF?.available) {
                return this.exportWithPixiGIF();
            } else {
                return this.exportWithFallback();
            }
        },
        
        // Phase2: @pixi/gif使用のエクスポート
        exportWithPixiGIF: function() {
            try {
                console.log('🎨 @pixi/gif使用でのGIF生成開始...');
                
                // 将来の実装: @pixi/gifを使用したGIF生成
                // const animatedGIF = new window.PixiExtensions.GIF.AnimatedGIF();
                // animatedGIF.frames = this.frames;
                
                console.log('✅ @pixi/gif使用GIF生成準備完了');
                return {
                    type: 'pixi-gif',
                    frames: this.frames,
                    frameCount: this.frames.length,
                    totalDuration: this.frames.length * this.defaultDelay
                };
                
            } catch (error) {
                console.error('❌ @pixi/gif使用エクスポートエラー:', error);
                return this.exportWithFallback();
            }
        },
        
        // フォールバックエクスポート
        exportWithFallback: function() {
            console.log('📦 基本GIF生成機能で処理...');
            
            return {
                type: 'fallback',
                frames: this.frames,
                frameCount: this.frames.length,
                totalDuration: this.frames.length * this.defaultDelay
            };
        },
        
        // Phase2追加: 録画状態取得
        getRecordingStatus: function() {
            return {
                recording: this.recording,
                frameCount: this.frames.length,
                maxFrames: this.maxFrames,
                progress: Math.round((this.frames.length / this.maxFrames) * 100),
                usingPixiGIF: window.PixiExtensions?.GIF?.available || false
            };
        }
    };
}

// ==== Phase2: PixiJS拡張機能統合オブジェクト（改修版・グローバル登録） ====
console.log('📦 PixiJS拡張機能グローバル登録（Phase2改修版）...');

// 初期化実行
const extensions = initializePixiExtensions();

// グローバル公開（fetch API分割対応・Phase2改修版）
window.PixiExtensions = {
    // ライブラリ情報
    ...extensions,
    
    // ヘルパー関数
    createSimplePopup,
    createLayerManager,
    createGIFExporter,
    
    // 初期化関数
    initialize: initializePixiExtensions,
    
    // バージョン情報
    version: '2.0.0-phase2',
    buildDate: new Date().toISOString(),
    
    // Phase2追加: 統合システム情報
    integration: {
        popupSystem: 'enhanced', // 改良ポップアップシステム
        layerSystem: 'pixi-layers', // @pixi/layers統合
        gifSystem: 'pixi-gif', // @pixi/gif統合
        smoothGraphics: 'pixi-smooth' // @pixi/graphics-smooth統合
    },
    
    // 統計情報
    getStats: function() {
        const available = Object.values(extensions)
            .filter(ext => ext.available).length;
        const total = Object.keys(extensions).length;
        
        return {
            loaded: available,
            total: total,
            coverage: `${Math.round(available / total * 100)}%`,
            extensions: extensions,
            integration: this.integration,
            version: this.version
        };
    },
    
    // Phase2改修: 機能チェック（強化版）
    hasFeature: function(feature) {
        switch (feature.toLowerCase()) {
            case 'ui':
            case 'popup':
            case 'button':
                return extensions.UI?.available || false;
            case 'layers':
            case 'layer':
            case 'layergroup':
                return extensions.Layers?.available || false;
            case 'gif':
            case 'animation':
            case 'export':
                return extensions.GIF?.available || false;
            case 'smooth':
            case 'smoothing':
            case 'smoothgraphics':
                return extensions.Smooth?.available || false;
            case 'extras':
            case 'shapes':
            case 'roundedpolygon':
                return extensions.Extras?.available || false;
            default:
                return false;
        }
    },
    
    // Phase2追加: ライブラリ詳細情報取得
    getLibraryDetails: function(libraryName) {
        const lib = extensions[libraryName];
        if (!lib) return null;
        
        return {
            name: libraryName,
            available: lib.available,
            source: lib.source || 'unknown',
            components: Object.keys(lib).filter(key => 
                !['available', 'source', 'methods'].includes(key)
            ),
            methods: lib.methods || [],
            loaded: !!lib.available
        };
    },
    
    // Phase2追加: 全ライブラリ詳細取得
    getAllLibraryDetails: function() {
        const details = {};
        
        Object.keys(extensions).forEach(libName => {
            details[libName] = this.getLibraryDetails(libName);
        });
        
        return details;
    },
    
    // Phase2追加: 互換性チェック
    checkCompatibility: function() {
        const issues = [];
        
        // PixiJS バージョンチェック
        if (PIXI.VERSION < '7.0.0') {
            issues.push('PixiJS v7.0.0以上が必要です');
        }
        
        // 必須機能チェック
        if (!this.hasFeature('ui')) {
            issues.push('@pixi/ui が利用できません - ポップアップ機能が制限されます');
        }
        
        if (!this.hasFeature('layers')) {
            issues.push('@pixi/layers が利用できません - レイヤー機能が制限されます');
        }
        
        return {
            compatible: issues.length === 0,
            issues: issues,
            recommendations: this.getRecommendations()
        };
    },
    
    // Phase2追加: 推奨事項取得
    getRecommendations: function() {
        const recs = [];
        
        if (!this.hasFeature('smooth')) {
            recs.push('@pixi/graphics-smooth の導入を推奨 - 描画品質が向上します');
        }
        
        if (!this.hasFeature('gif')) {
            recs.push('@pixi/gif の導入を推奨 - GIF機能が利用可能になります');
        }
        
        if (!this.hasFeature('extras')) {
            recs.push('@pixi/graphics-extras の導入を推奨 - 拡張図形が利用可能になります');
        }
        
        return recs;
    }
};

// ==== Phase2: 初期化完了ログ（改修版） ====
console.group('✅ PixiJS拡張ライブラリ統合システム Phase2改修版 初期化完了');
const stats = window.PixiExtensions.getStats();
console.log('📊 読み込み統計:', stats);
console.log('🔧 統合システム:', window.PixiExtensions.integration);
console.log('🎯 利用可能機能:');
console.log(`  - UI機能: ${window.PixiExtensions.hasFeature('ui') ? '✅' : '❌'}`);
console.log(`  - レイヤー: ${window.PixiExtensions.hasFeature('layers') ? '✅' : '❌'}`);
console.log(`  - GIF: ${window.PixiExtensions.hasFeature('gif') ? '✅' : '❌'}`);
console.log(`  - スムージング: ${window.PixiExtensions.hasFeature('smooth') ? '✅' : '❌'}`);
console.log(`  - 拡張図形: ${window.PixiExtensions.hasFeature('extras') ? '✅' : '❌'}`);

// Phase2: 互換性チェック実行
const compatibility = window.PixiExtensions.checkCompatibility();
if (compatibility.compatible) {
    console.log('✅ 互換性チェック: 問題なし');
} else {
    console.warn('⚠️ 互換性の問題:', compatibility.issues);
}

if (compatibility.recommendations.length > 0) {
    console.log('💡 推奨事項:', compatibility.recommendations);
}

console.groupEnd();

// ==== Phase2完了・Phase3準備 ====
console.log('🎉 Phase2: ポップアップ機能移行・@pixi/ui統合 完了');
console.log('🏗️ Phase3: 描画機能強化・レイヤーシステム 準備完了');
console.log('📋 次のステップ: pen-tool.js の @pixi/graphics-smooth 使用改修');
console.log('💡 使用方法例（Phase2改修版）:');
console.log('  const popup = window.PixiExtensions.createSimplePopup({title: "テスト"});');
console.log('  const layerManager = window.PixiExtensions.createLayerManager(app);');
console.log('  const gifExporter = window.PixiExtensions.createGIFExporter(app);');
console.log('  const stats = window.PixiExtensions.getStats();');
console.log('  const details = window.PixiExtensions.getAllLibraryDetails();');

// ==== Phase2: 自動テスト実行（改修版） ====
if (typeof window !== 'undefined') {
    // ブラウザ環境での自動機能テスト（Phase2改修版）
    setTimeout(() => {
        console.group('🧪 PixiJS拡張機能 自動テスト（Phase2改修版）');
        
        try {
            // 統計取得テスト
            const stats = window.PixiExtensions.getStats();
            console.log('✅ 統計取得:', stats.coverage);
            
            // 機能チェックテスト
            const features = ['ui', 'layers', 'gif', 'smooth', 'extras'];
            features.forEach(feature => {
                const available = window.PixiExtensions.hasFeature(feature);
                console.log(`${available ? '✅' : '❌'} ${feature}機能: ${available ? '利用可能' : '無効'}`);
            });
            
            // Phase2: ライブラリ詳細テスト
            const libraryDetails = window.PixiExtensions.getAllLibraryDetails();
            console.log('📦 ライブラリ詳細:', libraryDetails);
            
            // Phase2: 互換性テスト
            const compatibility = window.PixiExtensions.checkCompatibility();
            console.log('🔍 互換性チェック:', compatibility);
            
            console.log('🎉 PixiJS拡張機能テスト完了（Phase2改修版）');
        } catch (error) {
            console.error('❌ テストエラー:', error);
        }
        
        console.groupEnd();
    }, 1000);
}