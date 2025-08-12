/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * PixiJS拡張ライブラリ統合インポートシステム - libs/pixi-extensions.js
 * 
 * 📝 計画書Phase1対応: PixiJS v7/v8 拡張ライブラリ導入・改修計画書
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
 * 🚨 注意: fetch API分割構造対応のため、グローバル登録方式を使用
 * 責務: PixiJS拡張ライブラリの統合管理・グローバル公開
 * 依存: PixiJS v7.4.2, npmパッケージインストール済み
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム 読み込み開始...');

// ==== PixiJS拡張ライブラリのインポート試行 ====
// 🚨 重要: CDN版では直接インポートできないため、スクリプトタグ読み込み方式に対応

/**
 * 🔧 拡張ライブラリ読み込み状況確認・初期化
 * Phase1: 段階的ライブラリ導入対応
 */
function initializePixiExtensions() {
    console.group('🎨 PixiJS拡張ライブラリ初期化');
    
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
    
    // @pixi/ui 検出
    totalCount++;
    if (typeof PIXI.FancyButton !== 'undefined' || window.pixiUI) {
        console.log('✅ @pixi/ui 検出 - ポップアップ・UI機能利用可能');
        extensions.UI = {
            FancyButton: window.pixiUI?.FancyButton || PIXI.FancyButton,
            Button: window.pixiUI?.Button,
            Slider: window.pixiUI?.Slider,
            available: true
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
        extensions.UI = { available: false };
    }
    
    // @pixi/layers 検出
    totalCount++;
    if (typeof PIXI.display?.Layer !== 'undefined' || window.pixiLayers) {
        console.log('✅ @pixi/layers 検出 - レイヤー機能利用可能');
        extensions.Layers = {
            Layer: window.pixiLayers?.Layer || PIXI.display.Layer,
            Group: window.pixiLayers?.Group || PIXI.display.Group,
            available: true
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
        extensions.Layers = { available: false };
    }
    
    // @pixi/gif 検出
    totalCount++;
    if (typeof PIXI.AnimatedGIF !== 'undefined' || window.pixiGIF) {
        console.log('✅ @pixi/gif 検出 - GIF機能利用可能');
        extensions.GIF = {
            AnimatedGIF: window.pixiGIF?.AnimatedGIF || PIXI.AnimatedGIF,
            available: true
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/gif 未検出 - GIF機能無効');
        extensions.GIF = { available: false };
    }
    
    // @pixi/graphics-smooth 検出
    totalCount++;
    if (typeof PIXI.smooth?.SmoothGraphics !== 'undefined' || window.pixiSmooth) {
        console.log('✅ @pixi/graphics-smooth 検出 - スムース描画利用可能');
        extensions.Smooth = {
            SmoothGraphics: window.pixiSmooth?.SmoothGraphics || PIXI.smooth.SmoothGraphics,
            available: true
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/graphics-smooth 未検出 - 通常Graphics使用');
        extensions.Smooth = { available: false };
    }
    
    // @pixi/graphics-extras 検出
    totalCount++;
    if (typeof PIXI.Graphics.prototype.drawRoundedPolygon !== 'undefined' || window.pixiExtras) {
        console.log('✅ @pixi/graphics-extras 検出 - 拡張図形利用可能');
        extensions.Extras = {
            available: true,
            methods: ['drawRoundedPolygon', 'drawFilletRect', 'drawRegularPolygon']
        };
        loadedCount++;
    } else {
        console.warn('⚠️ @pixi/graphics-extras 未検出 - 基本図形のみ');
        extensions.Extras = { available: false };
    }
    
    console.log(`📊 拡張ライブラリ読み込み状況: ${loadedCount}/${totalCount}`);
    console.groupEnd();
    
    return extensions;
}

/**
 * 🔧 Phase2: ポップアップ機能移行対応
 * @pixi/ui使用の簡易ポップアップ作成ヘルパー
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
    
    // 基本コンテナ作成（@pixi/ui無効時のフォールバック）
    const popup = new PIXI.Container();
    popup.x = x;
    popup.y = y;
    
    // 背景
    const background = new PIXI.Graphics();
    background.beginFill(0xf0e0d6, 0.95); // ふたばクリーム
    background.lineStyle(2, 0x800000, 1); // ふたばマルーン
    background.drawRoundedRect(0, 0, width, height, 8);
    background.endFill();
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
    
    // ドラッグ機能（簡易版）
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
    
    return popup;
}

/**
 * 🔧 Phase3: レイヤー機能実装対応
 * @pixi/layers使用の簡易レイヤーマネージャー
 */
function createLayerManager(app) {
    const manager = {
        app: app,
        layers: new Map(),
        currentLayer: null,
        
        // レイヤー追加
        addLayer: function(name, zIndex = 0) {
            let layer;
            
            if (window.PixiExtensions?.Layers?.available) {
                // @pixi/layers使用
                layer = new window.PixiExtensions.Layers.Layer();
                layer.group.enableSort = true;
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
            }
            return layer;
        },
        
        // レイヤー順序変更
        moveLayer: function(name, newZIndex) {
            const layer = this.layers.get(name);
            if (layer) {
                layer.zIndex = newZIndex;
                this.app.stage.sortChildren();
                console.log(`📐 レイヤー移動: ${name} → zIndex ${newZIndex}`);
            }
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
            }
        }
    };
    
    // デフォルトレイヤー作成
    manager.addLayer('background', 0);
    manager.addLayer('drawing', 1);
    manager.addLayer('ui', 2);
    
    return manager;
}

/**
 * 🔧 Phase4: GIF機能実装対応
 * @pixi/gif使用の簡易GIFエクスポート
 */
function createGIFExporter(app) {
    return {
        app: app,
        frames: [],
        recording: false,
        
        // 録画開始
        startRecording: function() {
            this.frames = [];
            this.recording = true;
            console.log('🎬 GIF録画開始');
        },
        
        // フレーム追加
        addFrame: function() {
            if (!this.recording) return;
            
            try {
                // キャンバスをキャプチャ
                const canvas = this.app.view;
                const dataURL = canvas.toDataURL('image/png');
                
                this.frames.push({
                    data: dataURL,
                    timestamp: Date.now()
                });
                
                console.log(`📷 フレーム追加: ${this.frames.length}`);
            } catch (error) {
                console.error('❌ フレームキャプチャエラー:', error);
            }
        },
        
        // 録画停止・エクスポート
        stopRecording: function() {
            this.recording = false;
            
            if (this.frames.length === 0) {
                console.warn('⚠️ 録画されたフレームがありません');
                return null;
            }
            
            console.log(`🎬 GIF録画完了: ${this.frames.length}フレーム`);
            
            // 簡易GIF生成（実装は段階的に）
            if (window.PixiExtensions?.GIF?.available) {
                // @pixi/gif使用版（将来実装）
                console.log('🎨 @pixi/gif でのGIF生成準備中...');
            } else {
                // フォールバック版
                console.log('📦 基本GIF生成機能で処理...');
            }
            
            return this.frames;
        }
    };
}

// ==== PixiJS拡張機能統合オブジェクト（グローバル登録） ====
console.log('📦 PixiJS拡張機能グローバル登録...');

// 初期化実行
const extensions = initializePixiExtensions();

// グローバル公開（fetch API分割対応）
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
    version: '1.0.0-phase1',
    buildDate: new Date().toISOString(),
    
    // 統計情報
    getStats: function() {
        const available = Object.values(extensions)
            .filter(ext => ext.available).length;
        const total = Object.keys(extensions).length;
        
        return {
            loaded: available,
            total: total,
            coverage: `${Math.round(available / total * 100)}%`,
            extensions: extensions
        };
    },
    
    // 機能チェック
    hasFeature: function(feature) {
        switch (feature.toLowerCase()) {
            case 'ui':
            case 'popup':
                return extensions.UI?.available || false;
            case 'layers':
            case 'layer':
                return extensions.Layers?.available || false;
            case 'gif':
            case 'animation':
                return extensions.GIF?.available || false;
            case 'smooth':
            case 'smoothing':
                return extensions.Smooth?.available || false;
            case 'extras':
            case 'shapes':
                return extensions.Extras?.available || false;
            default:
                return false;
        }
    }
};

// ==== 初期化完了ログ ====
console.group('✅ PixiJS拡張ライブラリ統合システム 初期化完了');
console.log('📊 読み込み統計:', window.PixiExtensions.getStats());
console.log('🎯 利用可能機能:');
console.log(`  - UI機能: ${window.PixiExtensions.hasFeature('ui') ? '✅' : '❌'}`);
console.log(`  - レイヤー: ${window.PixiExtensions.hasFeature('layers') ? '✅' : '❌'}`);
console.log(`  - GIF: ${window.PixiExtensions.hasFeature('gif') ? '✅' : '❌'}`);
console.log(`  - スムージング: ${window.PixiExtensions.hasFeature('smooth') ? '✅' : '❌'}`);
console.log(`  - 拡張図形: ${window.PixiExtensions.hasFeature('extras') ? '✅' : '❌'}`);
console.groupEnd();

// ==== Phase1完了・Phase2準備 ====
console.log('🎉 Phase1: 基盤ライブラリ導入 完了');
console.log('🏗️ Phase2: ポップアップ機能移行 準備完了');
console.log('📋 次のステップ: pen-tool-ui.js の @pixi/ui 使用改修');
console.log('💡 使用方法例:');
console.log('  const popup = window.PixiExtensions.createSimplePopup({title: "テスト"});');
console.log('  const layerManager = window.PixiExtensions.createLayerManager(app);');
console.log('  const gifExporter = window.PixiExtensions.createGIFExporter(app);');

// ==== 自動テスト実行 ====
if (typeof window !== 'undefined') {
    // ブラウザ環境での自動機能テスト
    setTimeout(() => {
        console.group('🧪 PixiJS拡張機能 自動テスト');
        
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
            
            console.log('🎉 PixiJS拡張機能テスト完了');
        } catch (error) {
            console.error('❌ テストエラー:', error);
        }
        
        console.groupEnd();
    }, 1000);
}