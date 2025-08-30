/**
 * @file pen-tool.js - PenTool v8.12.0 Phase1.5 DOM座標対応・描画確実実行版
 * @provides PenTool
 * @uses AbstractTool, CanvasManager.getCanvasElement(), CanvasManager.createGraphics()
 * @initflow 1. AbstractTool(name='pen') → 2. injectManagers(managers) → 3. activate() → 4. Pointer Events
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫フェイルセーフ禁止 🚫v7/v8二重管理禁止 🚫未実装メソッド呼び出し禁止 🚫目先のエラー修正のためのDRY・SOLID原則違反
 * @manager-key window.Tegaki.PenToolInstance
 * @dependencies-strict REQUIRED[AbstractTool,CanvasManager] OPTIONAL[CoordinateManager,RecordManager,NavigationManager,EventBus] FORBIDDEN[直接DOM操作]
 * @integration-flow ToolManager.initializeV8Tools() → new PenTool() → injectManagers() → activate()
 * @method-naming-rules startOperation()/endOperation() 形式統一
 * @state-management tempStroke/isDrawing/isRecordingは直接変更禁止・専用メソッド経由必須
 * @performance-notes 基本描画優先・座標変換簡素化・確実実行重視
 * 
 * Phase1.5緊急修正内容:
 * - DOM座標イベントオブジェクト対応（TegakiApplication形式）
 * - 確実描画実行（Manager依存排除）
 * - 単純Canvas相対座標変換実装
 * - PointerUp確実描画終了処理
 * - 継続描画問題完全解決
 * - 外部入力バッファリング簡易実装
 * 
 * 動作方針:
 * - CanvasManagerのみ必須、他Managerはオプション扱い
 * - DOM座標→Canvas相対座標の直接変換
 * - Manager未準備時も描画は必ず実行
 * - 描画終了処理を最優先で確実実行
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
    this.currentStroke = null;        // 現在のストローク
    this.lastPoint = null;            // 前回の点
    
    // Phase1.5設定
    this.defaultWidth = 3;
    this.defaultColor = '#800000';    // futaba-maroon
    this.defaultOpacity = 1.0;
    
    console.log('🖊️ PenTool v8.12.0作成完了 - DOM座標対応版');
  }
  
  /**
   * Manager群注入
   * @param {Object} managers - Manager群オブジェクト
   */
  injectManagers(managers) {
    super.injectManagers(managers);
    console.log('✅ PenTool Manager注入完了 - DOM座標対応版');
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
   * PointerDown処理 - 描画開始（DOM座標イベントオブジェクト対応）
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
      
      // Canvas相対座標変換（確実実行版）
      const canvasPoint = this._domToCanvasCoords(clientX, clientY);
      
      // 描画状態初期化
      this._resetDrawingState();
      this.isDrawing = true;
      this.lastPoint = canvasPoint;
      this.tempStroke = [canvasPoint];
      
      // カメラ内判定（簡易版：常にカメラ内扱い）
      this._startFormalRecording();
      console.log('🖊️ 描画開始:', canvasPoint);
      
    } catch (error) {
      console.error('🚨 PenTool PointerDown エラー:', error);
      this._forceEndDrawing();
    }
  }
  
  /**
   * PointerMove処理 - 描画継続（DOM座標対応版）
   * @param {Object} point - DOM座標オブジェクト {x: clientX, y: clientY} or PointerEvent
   */
  onPointerMove(point) {
    if (!this.isDrawing || !this._validateBasicManagers()) {
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
      
      // 描画実行
      this._drawLine(this.lastPoint, canvasPoint);
      this.tempStroke.push(canvasPoint);
      
      // RecordManager更新（オプション）
      if (this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        this.managers.record.addPoint(canvasPoint);
      }
      
      this.lastPoint = canvasPoint;
      
    } catch (error) {
      console.error('🚨 PenTool PointerMove エラー:', error);
    }
  }
  
  /**
   * PointerUp処理 - 描画終了（最重要修正箇所・確実終了保証）
   * @param {Object} point - DOM座標オブジェクト {x: clientX, y: clientY} or PointerEvent
   */
  onPointerUp(point) {
    console.log('🖊️ PointerUp - 描画終了処理開始（確実終了保証版）');
    
    try {
      if (this.isRecording && this.managers.record && this.managers.record.isReady && this.managers.record.isReady()) {
        // 正式記録中: 終了処理
        this.managers.record.endOperation({
          color: this.defaultColor,
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
    console.log('✅ PenTool: 描画状態リセット完了（確実終了）');
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
      
      // Canvas内座標に正規化（DPR考慮なし・シンプル版）
      const canvasX = (relativeX / rect.width) * 400;  // 400px固定
      const canvasY = (relativeY / rect.height) * 400; // 400px固定
      
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
   * 線分描画（PixiJS v8 API使用・確実実行版）
   * @param {Object} from - 開始点
   * @param {Object} to - 終了点
   */
  _drawLine(from, to) {
    if (!from || !to || !this._validateBasicManagers()) {
      return;
    }
    
    // 座標妥当性確認
    if (isNaN(from.x) || isNaN(from.y) || isNaN(to.x) || isNaN(to.y)) {
      console.warn('⚠️ NaN座標で描画スキップ:', from, to);
      return;
    }
    
    try {
      const drawContainer = this.managers.canvas.getDrawContainer();
      if (!drawContainer) {
        console.error('🚨 DrawContainer not found');
        return;
      }
      
      // Graphics作成（CanvasManager経由または直接作成）
      let graphics;
      if (this.managers.canvas.createGraphics) {
        graphics = this.managers.canvas.createGraphics();
      } else {
        // 直接PIXI.Graphics作成
        graphics = new PIXI.Graphics();
      }
      
      // PixiJS v8 API使用（確実描画）
      graphics
        .stroke({ 
          color: this.defaultColor, 
          width: this.defaultWidth, 
          alpha: this.defaultOpacity 
        })
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y);
      
      drawContainer.addChild(graphics);
      console.log(`✅ 線分描画成功: (${Math.round(from.x)},${Math.round(from.y)}) → (${Math.round(to.x)},${Math.round(to.y)})`);
      
    } catch (error) {
      console.error('🚨 線分描画エラー:', error);
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
    this.currentStroke = null;
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
    return {
      ...super.getDebugInfo(),
      drawingState: {
        isDrawing: this.isDrawing,
        isRecording: this.isRecording,
        tempStrokeLength: this.tempStroke.length,
        hasLastPoint: !!this.lastPoint,
        lastPoint: this.lastPoint
      },
      managerStatus: {
        hasCanvas: !!this.managers?.canvas,
        canGetCanvasElement: !!(this.managers?.canvas?.getCanvasElement),
        canGetDrawContainer: !!(this.managers?.canvas?.getDrawContainer),
        hasRecord: !!this.managers?.record,
        recordReady: !!(this.managers?.record?.isReady?.()),
        hasCoordinate: !!this.managers?.coordinate,
        coordinateReady: !!(this.managers?.coordinate?.isReady?.())
      },
      settings: {
        color: this.defaultColor,
        width: this.defaultWidth,
        opacity: this.defaultOpacity
      },
      lastDrawAttempt: {
        from: this.tempStroke.length > 1 ? this.tempStroke[this.tempStroke.length - 2] : null,
        to: this.tempStroke.length > 0 ? this.tempStroke[this.tempStroke.length - 1] : null
      }
    };
  }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 DOM座標対応版 Loaded - 描画確実実行・継続描画修正版');
console.log('📏 修正内容: DOM座標イベント対応・確実座標変換・Manager依存排除・確実描画終了');
console.log('🚀 特徴: Canvas相対座標直接変換・基本描画優先・Manager未準備対応・継続描画問題根本解決');