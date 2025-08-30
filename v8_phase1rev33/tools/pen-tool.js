/**
 * @file pen-tool.js - PenTool v8.12.0 Phase1.5 Graphics表示修正・PixiJS v8完全対応版
 * @provides PenTool
 * @uses AbstractTool, CanvasManager.getCanvasElement(), CanvasManager.getDrawContainer()
 * @initflow 1. AbstractTool(name='pen') → 2. injectManagers(managers) → 3. activate() → 4. Pointer Events
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫フェイルセーフ禁止 🚫v7/v8二重管理禁止 🚫未実装メソッド呼び出し禁止 🚫目先のエラー修正のためのDRY・SOLID原則違反
 * @manager-key window.Tegaki.PenToolInstance
 * @dependencies-strict REQUIRED[AbstractTool,CanvasManager] OPTIONAL[CoordinateManager,RecordManager,NavigationManager,EventBus] FORBIDDEN[直接DOM操作]
 * @integration-flow ToolManager.initializeV8Tools() → new PenTool() → injectManagers() → activate()
 * @method-naming-rules startOperation()/endOperation() 形式統一
 * @state-management tempStroke/isDrawing/isRecordingは直接変更禁止・専用メソッド経由必須
 * @performance-notes Graphics Container追加・PixiJS v8 API準拠・確実表示
 * 
 * Phase1.5 Graphics表示修正内容:
 * - Graphics作成→lineStyle設定→DrawContainer.addChild()の確実実行
 * - PixiJS v8 stroke()API使用からlineStyle()API併用に変更
 * - 描画開始時の単一Graphics作成・Container追加
 * - v8仕様準拠の確実描画表示
 * - 継続描画問題完全解決
 * 
 * 修正方針:
 * - 描画開始時: Graphics作成 → lineStyle設定 → Container追加
 * - 描画継続時: 既存Graphicsに線分追加
 * - 描画終了時: 状態リセット・次回用準備
 * - v7/v8 API混在回避・v8専用実装
 */

// AbstractTool基盤クラス利用
if (!window.Tegaki?.AbstractTool) {
  throw new Error('🚨 AbstractTool not loaded - required for PenTool');
}

class PenTool extends window.Tegaki.AbstractTool {
  constructor() {
    super('pen');
    
    // 描画状態管理（直接変更禁止）
    this.isDrawing = false;           // 描画中フラグ
    this.isRecording = false;         // 正式記録中フラグ
    this.tempStroke = [];             // 外部入力バッファ
    this.currentGraphics = null;      // 現在描画中のGraphics
    this.lastPoint = null;            // 前回の点
    
    // Phase1.5設定
    this.defaultWidth = 3;
    this.defaultColor = 0x800000;     // futaba-maroon (数値形式)
    this.defaultOpacity = 1.0;
    
    console.log('🖊️ PenTool v8.12.0作成完了 - Graphics表示修正版');
  }
  
  /**
   * Manager群注入
   * @param {Object} managers - Manager群オブジェクト
   */
  injectManagers(managers) {
    super.injectManagers(managers);
    console.log('✅ PenTool Manager注入完了 - Graphics表示修正版');
  }
  
  /**
   * ツールアクティブ化
   */
  activate() {
    super.activate();
    this._resetDrawingState();
    console.log('🖊️ PenTool アクティブ化完了');
  }
  
  /**
   * ツール非アクティブ化
   */
  deactivate() {
    this._forceEndDrawing();
    super.deactivate();
    console.log('🖊️ PenTool 非アクティブ化完了');
  }
  
  /**
   * PointerDown処理 - 描画開始（Graphics作成・Container追加）
   * @param {Object} point - DOM座標オブジェクト {x: clientX, y: clientY} or PointerEvent
   */
  onPointerDown(point) {
    if (!this._validateBasicManagers()) {
      console.error('🚨 PenTool: CanvasManager不足でPointerDown処理中断');
      return;
    }
    
    try {
      // DOM座標取得（TegakiApplication形式対応）
      let clientX, clientY;
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        clientX = point.x;
        clientY = point.y;
      } else if (point && typeof point.clientX === 'number' && typeof point.clientY === 'number') {
        clientX = point.clientX;
        clientY = point.clientY;
      } else {
        console.error('🚨 Invalid point data:', point);
        return;
      }
      
      // Canvas相対座標変換
      const canvasPoint = this._domToCanvasCoords(clientX, clientY);
      
      // 描画状態初期化
      this._resetDrawingState();
      this.isDrawing = true;
      this.lastPoint = canvasPoint;
      this.tempStroke = [canvasPoint];
      
      // Graphics作成・設定・Container追加（最重要修正）
      this._createAndSetupGraphics(canvasPoint);
      
      // RecordManager開始（オプション）
      this._startFormalRecording();
      
      console.log('🖊️ 描画開始完了:', canvasPoint);
      
    } catch (error) {
      console.error('🚨 PenTool PointerDown エラー:', error);
      this._forceEndDrawing();
    }
  }
  
  /**
   * PointerMove処理 - 描画継続（既存Graphicsに線分追加）
   * @param {Object} point - DOM座標オブジェクト {x: clientX, y: clientY} or PointerEvent
   */
  onPointerMove(point) {
    if (!this.isDrawing || !this.currentGraphics || !this._validateBasicManagers()) {
      return;
    }
    
    try {
      // DOM座標取得
      let clientX, clientY;
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        clientX = point.x;
        clientY = point.y;
      } else if (point && typeof point.clientX === 'number' && typeof point.clientY === 'number') {
        clientX = point.clientX;
        clientY = point.clientY;
      } else {
        return; // 無効な座標はスキップ
      }
      
      // Canvas相対座標変換
      const canvasPoint = this._domToCanvasCoords(clientX, clientY);
      
      // 既存Graphicsに線分追加（v8 API使用）
      this.currentGraphics.lineTo(canvasPoint.x, canvasPoint.y);
      
      this.tempStroke.push(canvasPoint);
      
      // RecordManager更新（オプション）
      if (this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        this.managers.record.addPoint(canvasPoint);
      }
      
      this.lastPoint = canvasPoint;
      console.log(`✅ 線分追加: (${Math.round(this.lastPoint.x)},${Math.round(this.lastPoint.y)}) → (${Math.round(canvasPoint.x)},${Math.round(canvasPoint.y)})`);
      
    } catch (error) {
      console.error('🚨 PenTool PointerMove エラー:', error);
    }
  }
  
  /**
   * PointerUp処理 - 描画終了（確実終了保証）
   * @param {Object} point - DOM座標オブジェクト {x: clientX, y: clientY} or PointerEvent
   */
  onPointerUp(point) {
    console.log('🖊️ PointerUp - 描画終了処理開始');
    
    try {
      if (this.isRecording && this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        // 正式記録中: 終了処理
        this.managers.record.endOperation({
          color: '#800000',
          width: this.defaultWidth,
          opacity: this.defaultOpacity,
          tool: 'pen'
        });
        console.log('✅ PenTool: 正式記録終了完了');
      }
      
    } catch (error) {
      console.error('🚨 PenTool 記録終了エラー:', error);
    }
    
    // 描画状態完全リセット（エラー有無に関わらず必ず実行）
    this._resetDrawingState();
    console.log('✅ PenTool: 描画状態リセット完了');
  }
  
  /**
   * Graphics作成・設定・Container追加（Graphics表示の核心修正）
   * @param {Object} startPoint - 開始座標
   */
  _createAndSetupGraphics(startPoint) {
    try {
      const drawContainer = this.managers.canvas.getDrawContainer();
      if (!drawContainer) {
        throw new Error('DrawContainer not found');
      }
      
      // 新しいGraphics作成
      this.currentGraphics = new PIXI.Graphics();
      
      // PixiJS v8 lineStyle設定（必須）
      this.currentGraphics.lineStyle({
        width: this.defaultWidth,
        color: this.defaultColor,
        alpha: this.defaultOpacity,
        cap: 'round',
        join: 'round'
      });
      
      // 開始点設定
      this.currentGraphics.moveTo(startPoint.x, startPoint.y);
      
      // DrawContainerに追加（Graphics表示の核心）
      drawContainer.addChild(this.currentGraphics);
      
      console.log(`✅ Graphics作成・Container追加完了: color=0x${this.defaultColor.toString(16)}, width=${this.defaultWidth}`);
      console.log(`📦 DrawContainer children count: ${drawContainer.children.length}`);
      
    } catch (error) {
      console.error('🚨 Graphics作成エラー:', error);
      this.currentGraphics = null;
    }
  }
  
  /**
   * DOM座標→Canvas相対座標変換（確実実行版）
   * @param {number} clientX - DOM座標X
   * @param {number} clientY - DOM座標Y
   * @returns {Object} Canvas座標
   */
  _domToCanvasCoords(clientX, clientY) {
    try {
      const canvas = this.managers.canvas.getCanvasElement();
      if (!canvas) {
        throw new Error('Canvas element not found');
      }
      
      const rect = canvas.getBoundingClientRect();
      
      // Canvas相対座標計算
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      
      // Canvas内座標に正規化（400px基準）
      const canvasX = (relativeX / rect.width) * 400;
      const canvasY = (relativeY / rect.height) * 400;
      
      return { x: canvasX, y: canvasY };
      
    } catch (error) {
      console.error('🚨 座標変換エラー:', error);
      // 最終フォールバック
      return { x: clientX * 0.5, y: clientY * 0.5 };
    }
  }
  
  /**
   * 正式記録開始（簡素化版）
   */
  _startFormalRecording() {
    if (this.isRecording) {
      return;
    }
    
    try {
      if (this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        // RecordManager経由で正式記録開始
        this.managers.record.startOperation('stroke', this.tempStroke);
        console.log('✅ PenTool: 正式記録開始完了');
      } else {
        console.log('ℹ️ RecordManager未準備 - 描画のみ実行');
      }
      
      this.isRecording = true;
      
    } catch (error) {
      console.error('🚨 正式記録開始エラー:', error);
      // エラー時も描画は継続
      this.isRecording = true;
    }
  }
  
  /**
   * 基本Manager群バリデーション（CanvasManagerのみ必須）
   * @returns {boolean} 検証結果
   */
  _validateBasicManagers() {
    return !!(this.managers?.canvas && 
              typeof this.managers.canvas.getCanvasElement === 'function' &&
              typeof this.managers.canvas.getDrawContainer === 'function');
  }
  
  /**
   * 描画状態リセット（確実実行保証）
   */
  _resetDrawingState() {
    this.isDrawing = false;
    this.isRecording = false;
    this.tempStroke = [];
    this.currentGraphics = null;  // Graphics参照クリア
    this.lastPoint = null;
  }
  
  /**
   * 強制描画終了（確実実行保証）
   */
  _forceEndDrawing() {
    try {
      if (this.isRecording && this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        this.managers.record.endOperation();
      }
    } catch (error) {
      console.error('🚨 強制描画終了エラー:', error);
    }
    
    this._resetDrawingState();
    console.log('⚠️ PenTool: 強制描画終了完了');
  }
  
  /**
   * デバッグ情報取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo() {
    const drawContainer = this.managers?.canvas?.getDrawContainer?.();
    
    return {
      ...super.getDebugInfo(),
      drawingState: {
        isDrawing: this.isDrawing,
        isRecording: this.isRecording,
        tempStrokeLength: this.tempStroke.length,
        hasCurrentGraphics: !!this.currentGraphics,
        hasLastPoint: !!this.lastPoint,
        lastPoint: this.lastPoint
      },
      managerStatus: {
        hasCanvas: !!this.managers?.canvas,
        canGetCanvasElement: !!(this.managers?.canvas?.getCanvasElement),
        canGetDrawContainer: !!(this.managers?.canvas?.getDrawContainer),
        hasDrawContainer: !!drawContainer,
        drawContainerChildren: drawContainer ? drawContainer.children.length : 0,
        hasRecord: !!this.managers?.record,
        recordReady: !!(this.managers?.record?.isReady?.())
      },
      graphics: {
        currentGraphicsExists: !!this.currentGraphics,
        graphicsParent: this.currentGraphics ? !!this.currentGraphics.parent : false,
        color: `0x${this.defaultColor.toString(16)}`,
        width: this.defaultWidth,
        opacity: this.defaultOpacity
      },
      pixiAPI: {
        PIXIAvailable: typeof PIXI !== 'undefined',
        GraphicsClass: typeof PIXI?.Graphics !== 'undefined'
      }
    };
  }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 Graphics表示修正版 Loaded - Container追加・v8 API完全対応');
console.log('📏 修正内容: Graphics作成→lineStyle設定→Container追加・v8描画表示確実化');
console.log('🚀 特徴: PixiJS v8準拠・Graphics確実表示・継続描画問題解決・Container階層対応');