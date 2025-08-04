// PointerProcessor.ts - Phase2 高精度筆圧・傾き処理
// 筆圧曲線補正・デバイス差異調整・自然な描画体験

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';

export interface IPointerData {
  point: PIXI.Point;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  pointerType: string;
  deviceId: string;
  timestamp: number;
}

export interface IProcessedPointerData {
  point: PIXI.Point;
  pressure: number;
  tilt: { angle: number; intensity: number };
  velocity: number;
  acceleration: number;
  smoothedPoint: PIXI.Point;
  normalizedPressure: number;
}

export interface IPointerEventData extends IEventData {
  'pointer:calibrated': { deviceType: string; settings: any };
  'pointer:processed': { data: IProcessedPointerData };
  'pointer:device-changed': { oldDevice: string; newDevice: string };
}

/**
 * 高精度ポインター処理・筆圧最適化
 * - 筆圧曲線補正・デバイス差異・調整機能
 * - 傾き検出・ペン表現・自然な描画
 * - スムージング・手ブレ軽減・高精度座標
 * - デバイス自動認識・設定永続化
 */
export class PointerProcessor {
  private eventBus: EventBus;
  
  // ポインターデータ履歴・スムージング用
  private pointerHistory: IPointerData[] = [];
  private readonly HISTORY_SIZE = 10;
  
  // 筆圧処理
  private pressureCurve: Float32Array = new Float32Array([0, 0.2, 0.8, 1.0]);
  private pressureRange = { min: 0.1, max: 1.0 };
  private pressureSmoothing = 0.3;
  private lastPressure = 0;
  
  // デバイス認識・設定
  private currentDevice = 'unknown';
  private deviceSettings = new Map<string, any>();
  private calibrationData = new Map<string, any>();
  
  // 座標処理・スムージング
  private smoothingFactor = 0.7;
  private velocityHistory: number[] = [];
  private readonly VELOCITY_HISTORY_SIZE = 5;
  
  // 傾き処理
  private tiltSensitivity = 1.0;
  private tiltDeadzone = 0.1;
  
  // パフォーマンス
  private lastProcessTime = 0;
  private processingQueue: IPointerData[] = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.loadDeviceSettings();
    console.log('🖱️ PointerProcessor初期化完了');
  }

  /**
   * ポインターデータ処理・メイン処理
   * @param rawData 生ポインターデータ
   * @returns 処理済みデータ
   */
  public processPointerData(rawData: IPointerData): IProcessedPointerData {
    const startTime = performance.now();
    
    // デバイス自動認識・設定適用
    this.detectAndConfigureDevice(rawData);
    
    // 履歴追加・管理
    this.addToHistory(rawData);
    
    // 筆圧処理・曲線補正
    const normalizedPressure = this.processPressure(rawData.pressure);
    
    // 座標スムージング・手ブレ軽減
    const smoothedPoint = this.smoothCoordinates(rawData.point);
    
    // 傾き処理・ペン表現
    const tilt = this.processTiltData(rawData.tiltX, rawData.tiltY);
    
    // 速度・加速度計算
    const velocity = this.calculateVelocity();
    const acceleration = this.calculateAcceleration();
    
    // 処理結果作成
    const processedData: IProcessedPointerData = {
      point: rawData.point,
      pressure: rawData.pressure,
      tilt,
      velocity,
      acceleration,
      smoothedPoint,
      normalizedPressure
    };
    
    // イベント発火
    this.eventBus.emit('pointer:processed', { data: processedData });
    
    // パフォーマンス監視
    const processingTime = performance.now() - startTime;
    if (processingTime > 2) { // 2ms超過警告
      console.warn(`⚠️ ポインター処理時間超過: ${processingTime.toFixed(2)}ms`);
    }
    
    return processedData;
  }

  /**
   * 筆圧曲線補正・デバイス最適化
   * @param rawPressure 生筆圧値
   * @returns 補正済み筆圧
   */
  private processPressure(rawPressure: number): number {
    // デバイス別補正適用
    const deviceConfig = this.deviceSettings.get(this.currentDevice);
    let pressure = rawPressure;
    
    if (deviceConfig?.pressureOffset) {
      pressure += deviceConfig.pressureOffset;
    }
    
    if (deviceConfig?.pressureScale) {
      pressure *= deviceConfig.pressureScale;
    }
    
    // 範囲正規化
    pressure = Math.max(0, Math.min(1, pressure));
    
    // 曲線補正適用・ベジエ曲線
    pressure = this.applyPressureCurve(pressure);
    
    // スムージング適用・急激な変化抑制
    if (this.lastPressure > 0) {
      const smoothing = this.pressureSmoothing;
      pressure = this.lastPressure * smoothing + pressure * (1 - smoothing);
    }
    
    this.lastPressure = pressure;
    
    // 最終範囲調整
    return Math.max(this.pressureRange.min, Math.min(this.pressureRange.max, pressure));
  }

  /**
   * 筆圧曲線適用・ベジエ曲線補間
   * @param pressure 入力筆圧
   * @returns 曲線補正済み筆圧
   */
  private applyPressureCurve(pressure: number): number {
    if (this.pressureCurve.length < 4) return pressure;
    
    // 4点ベジエ曲線補間
    const t = pressure;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    return (
      this.pressureCurve[0] * mt3 +
      this.pressureCurve[1] * 3 * mt2 * t +
      this.pressureCurve[2] * 3 * mt * t2 +
      this.pressureCurve[3] * t3
    );
  }

  /**
   * 座標スムージング・手ブレ軽減
   * @param rawPoint 生座標
   * @returns スムージング済み座標
   */
  private smoothCoordinates(rawPoint: PIXI.Point): PIXI.Point {
    if (this.pointerHistory.length < 2) {
      return new PIXI.Point(rawPoint.x, rawPoint.y);
    }
    
    // 移動平均スムージング
    let sumX = 0;
    let sumY = 0;
    let totalWeight = 0;
    
    const historySize = Math.min(this.pointerHistory.length, 5);
    
    for (let i = 0; i < historySize; i++) {
      const weight = (i + 1) / historySize; // 新しいデータほど重み大
      const point = this.pointerHistory[this.pointerHistory.length - 1 - i].point;
      
      sumX += point.x * weight;
      sumY += point.y * weight;
      totalWeight += weight;
    }
    
    return new PIXI.Point(
      sumX / totalWeight,
      sumY / totalWeight
    );
  }

  /**
   * 傾きデータ処理・ペン表現
   * @param tiltX X軸傾き
   * @param tiltY Y軸傾き
   * @returns 傾き情報
   */
  public processTiltData(tiltX: number, tiltY: number): { angle: number; intensity: number } {
    // デッドゾーン適用
    const adjustedTiltX = Math.abs(tiltX) < this.tiltDeadzone ? 0 : tiltX;
    const adjustedTiltY = Math.abs(tiltY) < this.tiltDeadzone ? 0 : tiltY;
    
    // 傾き角度計算・ラジアン
    const angle = Math.atan2(adjustedTiltY, adjustedTiltX);
    
    // 傾き強度計算・0-1範囲
    const intensity = Math.min(1, Math.sqrt(adjustedTiltX * adjustedTiltX + adjustedTiltY * adjustedTiltY) * this.tiltSensitivity);
    
    return { angle, intensity };
  }

  /**
   * 速度計算・ピクセル/秒
   * @returns 速度値
   */
  private calculateVelocity(): number {
    if (this.pointerHistory.length < 2) return 0;
    
    const current = this.pointerHistory[this.pointerHistory.length - 1];
    const previous = this.pointerHistory[this.pointerHistory.length - 2];
    
    const distance = Math.sqrt(
      Math.pow(current.point.x - previous.point.x, 2) +
      Math.pow(current.point.y - previous.point.y, 2)
    );
    
    const timeDelta = current.timestamp - previous.timestamp;
    if (timeDelta === 0) return 0;
    
    const velocity = (distance / timeDelta) * 1000; // ピクセル/秒
    
    // 速度履歴追加・平滑化
    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > this.VELOCITY_HISTORY_SIZE) {
      this.velocityHistory.shift();
    }
    
    // 移動平均計算
    return this.velocityHistory.reduce((sum, v) => sum + v, 0) / this.velocityHistory.length;
  }

  /**
   * 加速度計算・ピクセル/秒^2
   * @returns 加速度値
   */
  private calculateAcceleration(): number {
    if (this.velocityHistory.length < 2) return 0;
    
    const currentVelocity = this.velocityHistory[this.velocityHistory.length - 1];
    const previousVelocity = this.velocityHistory[this.velocityHistory.length - 2];
    
    // 簡易加速度計算（時間差を16ms固定と仮定）
    return (currentVelocity - previousVelocity) / 0.016;
  }

  /**
   * デバイス自動認識・設定適用
   * @param pointerData ポインターデータ
   */
  private detectAndConfigureDevice(pointerData: IPointerData): void {
    const detectedDevice = this.detectDeviceType(pointerData);
    
    if (detectedDevice !== this.currentDevice) {
      const oldDevice = this.currentDevice;
      this.currentDevice = detectedDevice;
      
      // デバイス設定適用
      this.applyDeviceSettings(detectedDevice);
      
      // イベント発火
      this.eventBus.emit('pointer:device-changed', {
        oldDevice,
        newDevice: detectedDevice
      });
      
      console.log(`🖱️ デバイス変更検出: ${oldDevice} → ${detectedDevice}`);
    }
  }

  /**
   * デバイス種別検出
   * @param pointerData ポインターデータ
   * @returns デバイス種別
   */
  private detectDeviceType(pointerData: IPointerData): string {
    // PointerType基本判定
    if (pointerData.pointerType === 'pen') {
      // Wacom・XP-Pen等の判定
      if (pointerData.deviceId.includes('wacom')) return 'wacom';
      if (pointerData.deviceId.includes('xppen')) return 'xppen';
      if (pointerData.deviceId.includes('huion')) return 'huion';
      return 'pen-generic';
    }
    
    if (pointerData.pointerType === 'mouse') {
      return 'mouse';
    }
    
    // 筆圧対応チェック
    if (pointerData.pressure > 0 && pointerData.pressure < 1) {
      return 'pressure-device';
    }
    
    return 'unknown';
  }

  /**
   * デバイス設定適用
   * @param deviceType デバイス種別
   */
  private applyDeviceSettings(deviceType: string): void {
    const settings = this.getDevicePreset(deviceType);
    this.deviceSettings.set(deviceType, settings);
    
    // 設定適用
    if (settings.pressureCurve) {
      this.pressureCurve = new Float32Array(settings.pressureCurve);
    }
    
    if (settings.smoothingFactor !== undefined) {
      this.smoothingFactor = settings.smoothingFactor;
    }
    
    if (settings.tiltSensitivity !== undefined) {
      this.tiltSensitivity = settings.tiltSensitivity;
    }
    
    console.log(`🎛️ デバイス設定適用: ${deviceType}`, settings);
  }

  /**
   * デバイスプリセット取得
   * @param deviceType デバイス種別
   * @returns 設定オブジェクト
   */
  private getDevicePreset(deviceType: string): any {
    const presets: Record<string, any> = {
      'wacom': {
        pressureCurve: [0, 0.15, 0.85, 1.0],
        pressureOffset: 0.05,
        pressureScale: 1.1,
        smoothingFactor: 0.8,
        tiltSensitivity: 1.2,
        description: 'Wacom最適化'
      },
      'xppen': {
        pressureCurve: [0, 0.25, 0.75, 1.0],
        pressureOffset: 0.1,
        pressureScale: 1.0,
        smoothingFactor: 0.7,
        tiltSensitivity: 1.0,
        description: 'XP-Pen最適化'
      },
      'huion': {
        pressureCurve: [0, 0.2, 0.8, 1.0],
        pressureOffset: 0.08,
        pressureScale: 1.05,
        smoothingFactor: 0.75,
        tiltSensitivity: 0.9,
        description: 'Huion最適化'
      },
      'pen-generic': {
        pressureCurve: [0, 0.3, 0.7, 1.0],
        pressureOffset: 0,
        pressureScale: 1.0,
        smoothingFactor: 0.6,
        tiltSensitivity: 1.0,
        description: '汎用ペン設定'
      },
      'mouse': {
        pressureCurve: [0, 0, 1, 1], // 線形
        pressureOffset: 0,
        pressureScale: 1.0,
        smoothingFactor: 0.3,
        tiltSensitivity: 0,
        description: 'マウス設定'
      }
    };
    
    return presets[deviceType] || presets['pen-generic'];
  }

  /**
   * 筆圧曲線キャリブレーション
   * @param deviceType デバイス種別
   * @param calibrationPoints キャリブレーションポイント
   */
  public calibratePressureCurve(deviceType: string, calibrationPoints?: number[]): void {
    if (!calibrationPoints) {
      // デフォルトキャリブレーション
      calibrationPoints = [0, 0.2, 0.8, 1.0];
    }
    
    if (calibrationPoints.length >= 4) {
      this.pressureCurve = new Float32Array(calibrationPoints);
      
      // 設定保存
      const settings = this.deviceSettings.get(deviceType) || {};
      settings.pressureCurve = Array.from(calibrationPoints);
      this.deviceSettings.set(deviceType, settings);
      
      // 永続化
      this.saveDeviceSettings();
      
      // イベント発火
      this.eventBus.emit('pointer:calibrated', {
        deviceType,
        settings: { pressureCurve: calibrationPoints }
      });
      
      console.log(`🎛️ 筆圧曲線キャリブレーション完了: ${deviceType}`, calibrationPoints);
    }
  }

  /**
   * ポインター履歴追加・管理
   * @param data ポインターデータ
   */
  private addToHistory(data: IPointerData): void {
    this.pointerHistory.push(data);
    
    if (this.pointerHistory.length > this.HISTORY_SIZE) {
      this.pointerHistory.shift();
    }
  }

  /**
   * デバイス設定読み込み
   */
  private loadDeviceSettings(): void {
    try {
      const saved = localStorage.getItem('tegaki-pointer-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        for (const [device, config] of Object.entries(settings)) {
          this.deviceSettings.set(device, config);
        }
        console.log('🔧 デバイス設定読み込み完了');
      }
    } catch (error) {
      console.warn('⚠️ デバイス設定読み込みエラー:', error);
    }
  }

  /**
   * デバイス設定保存
   */
  private saveDeviceSettings(): void {
    try {
      const settings: Record<string, any> = {};
      for (const [device, config] of this.deviceSettings.entries()) {
        settings[device] = config;
      }
      localStorage.setItem('tegaki-pointer-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('⚠️ デバイス設定保存エラー:', error);
    }
  }

  /**
   * 設定取得・外部アクセス
   */
  public getSettings(): {
    currentDevice: string;
    pressureCurve: number[];
    smoothingFactor: number;
    tiltSensitivity: number;
    deviceSettings: Record<string, any>;
  } {
    return {
      currentDevice: this.currentDevice,
      pressureCurve: Array.from(this.pressureCurve),
      smoothingFactor: this.smoothingFactor,
      tiltSensitivity: this.tiltSensitivity,
      deviceSettings: Object.fromEntries(this.deviceSettings)
    };
  }

  /**
   * 設定更新・外部制御
   * @param settings 更新設定
   */
  public updateSettings(settings: {
    smoothingFactor?: number;
    tiltSensitivity?: number;
    pressureCurve?: number[];
  }): void {
    if (settings.smoothingFactor !== undefined) {
      this.smoothingFactor = Math.max(0, Math.min(1, settings.smoothingFactor));
    }
    
    if (settings.tiltSensitivity !== undefined) {
      this.tiltSensitivity = Math.max(0, Math.min(2, settings.tiltSensitivity));
    }
    
    if (settings.pressureCurve && settings.pressureCurve.length >= 4) {
      this.pressureCurve = new Float32Array(settings.pressureCurve);
    }
    
    // 現在デバイス設定更新
    const deviceConfig = this.deviceSettings.get(this.currentDevice) || {};
    Object.assign(deviceConfig, settings);
    this.deviceSettings.set(this.currentDevice, deviceConfig);
    
    // 永続化
    this.saveDeviceSettings();
    
    console.log('🎛️ ポインター設定更新完了', settings);
  }

  /**
   * リセット・初期化
   */
  public reset(): void {
    this.pointerHistory.length = 0;
    this.velocityHistory.length = 0;
    this.lastPressure = 0;
    console.log('🔄 PointerProcessor リセット完了');
  }

  /**
   * 終了処理
   */
  public destroy(): void {
    this.reset();
    this.saveDeviceSettings();
    console.log('🖱️ PointerProcessor終了処理完了');
  }
}