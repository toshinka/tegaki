// ShortcutManager.ts - Phase2 キーボード・ペンサイドボタン管理
// ショートカット統合・カスタマイズ・ペンボタン対応・アクセシビリティ

import { EventBus, IEventData } from '../core/EventBus.js';

export interface IShortcutAction {
  id: string;
  name: string;
  description: string;
  category: 'tool' | 'drawing' | 'ui' | 'system';
  defaultKeys: string[];
  callback: () => void;
  enabled: boolean;
  repeatable?: boolean;
}

export interface IShortcutEventData extends IEventData {
  'shortcut:triggered': { actionId: string; keys: string[]; source: string };
  'shortcut:registered': { actionId: string; keys: string[] };
  'shortcut:conflict': { actionId: string; conflictingAction: string; keys: string[] };
  'shortcut:settings-changed': { customMappings: Record<string, string[]> };
}

/**
 * ショートカット・ホットキー管理システム
 * - キーボードショートカット・カスタマイズ対応
 * - ペンサイドボタン・タブレットボタン統合
 * - アクセシビリティ・キーボード完全操作
 * - 設定永続化・競合検出・優先度管理
 */
export class ShortcutManager {
  private eventBus: EventBus;
  
  // ショートカット管理
  private shortcuts = new Map<string, IShortcutAction>();
  private keyMappings = new Map<string, string>(); // key combination -> action id
  private customMappings = new Map<string, string[]>(); // action id -> custom keys
  
  // キー状態管理
  private pressedKeys = new Set<string>();
  private lastKeyTime = new Map<string, number>();
  private repeatIntervals = new Map<string, number>();
  
  // ペンボタン管理
  private penButtonMappings = new Map<number, string>(); // button index -> action id
  private penButtonStates = new Map<number, boolean>();
  
  // 設定・制御
  private enabled = true;
  private preventDefault = true;
  private keyRepeatDelay = 500; // ms
  private keyRepeatInterval = 50; // ms

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
    this.loadSettings();
    this.registerDefaultShortcuts();
    console.log('⌨️ ShortcutManager初期化完了');
  }

  /**
   * ショートカット登録
   * @param action ショートカットアクション
   */
  public registerShortcut(action: IShortcutAction): void {
    // 既存確認・重複警告
    if (this.shortcuts.has(action.id)) {
      console.warn(`⚠️ ショートカット重複: ${action.id}`);
      return;
    }

    // ショートカット登録
    this.shortcuts.set(action.id, action);

    // キーマッピング登録・競合チェック
    const keys = this.getActionKeys(action.id);
    for (const keyCombo of keys) {
      this.registerKeyMapping(keyCombo, action.id);
    }

    // イベント発火
    this.eventBus.emit('shortcut:registered', {
      actionId: action.id,
      keys
    });

    console.log(`⌨️ ショートカット登録: ${action.id} (${keys.join(', ')})`);
  }

  /**
   * ショートカット削除
   * @param actionId アクションID
   */
  public unregisterShortcut(actionId: string): void {
    const action = this.shortcuts.get(actionId);
    if (!action) return;

    // キーマッピング削除
    const keys = this.getActionKeys(actionId);
    for (const keyCombo of keys) {
      this.keyMappings.delete(keyCombo);
    }

    // ショートカット削除
    this.shortcuts.delete(actionId);
    this.customMappings.delete(actionId);

    console.log(`🗑️ ショートカット削除: ${actionId}`);
  }

  /**
   * カスタムキーマッピング設定
   * @param actionId アクションID
   * @param keys 新しいキー組み合わせ
   */
  public setCustomKeys(actionId: string, keys: string[]): void {
    const action = this.shortcuts.get(actionId);
    if (!action) {
      console.warn(`⚠️ 不明なアクション: ${actionId}`);
      return;
    }

    // 既存マッピング削除
    const oldKeys = this.getActionKeys(actionId);
    for (const keyCombo of oldKeys) {
      this.keyMappings.delete(keyCombo);
    }

    // 新しいマッピング設定
    this.customMappings.set(actionId, keys);

    // キーマッピング再登録
    for (const keyCombo of keys) {
      this.registerKeyMapping(keyCombo, actionId);
    }

    // 設定保存
    this.saveSettings();

    // イベント発火
    this.eventBus.emit('shortcut:settings-changed', {
      customMappings: Object.fromEntries(this.customMappings)
    });

    console.log(`🎛️ カスタムキー設定: ${actionId} → ${keys.join(', ')}`);
  }

  /**
   * ペンボタンマッピング設定
   * @param buttonIndex ボタン番号
   * @param actionId アクションID
   */
  public setPenButtonMapping(buttonIndex: number, actionId: string): void {
    if (!this.shortcuts.has(actionId)) {
      console.warn(`⚠️ 不明なアクション: ${actionId}`);
      return;
    }

    this.penButtonMappings.set(buttonIndex, actionId);
    this.saveSettings();

    console.log(`🖊️ ペンボタン設定: Button${buttonIndex} → ${actionId}`);
  }

  /**
   * キーボードイベント処理
   * @param event キーボードイベント
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.enabled) return;

    const keyCombo = this.getKeyCombo(event);
    const isKeyDown = event.type === 'keydown';
    const isKeyUp = event.type === 'keyup';

    // キー状態更新
    if (isKeyDown) {
      this.pressedKeys.add(keyCombo);
      this.lastKeyTime.set(keyCombo, Date.now());
    } else if (isKeyUp) {
      this.pressedKeys.delete(keyCombo);
      this.clearKeyRepeat(keyCombo);
    }

    // ショートカット検索・実行
    const actionId = this.keyMappings.get(keyCombo);
    if (actionId && isKeyDown) {
      const action = this.shortcuts.get(actionId);
      if (action?.enabled) {
        this.executeAction(action, keyCombo, 'keyboard');
        
        // リピート設定
        if (action.repeatable) {
          this.setupKeyRepeat(keyCombo, action);
        }
        
        // デフォルト動作防止
        if (this.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
  }

  /**
   * ペンボタンイベント処理
   * @param event ポインターイベント
   */
  public handlePenButtonEvent(event: PointerEvent): void {
    if (!this.enabled || event.pointerType !== 'pen') return;

    // ボタン状態変化検出
    const buttonStates = this.getPenButtonStates(event);
    
    for (const [buttonIndex, isPressed] of buttonStates.entries()) {
      const wasPressed = this.penButtonStates.get(buttonIndex) || false;
      
      // ボタン押下検出
      if (isPressed && !wasPressed) {
        const actionId = this.penButtonMappings.get(buttonIndex);
        if (actionId) {
          const action = this.shortcuts.get(actionId);
          if (action?.enabled) {
            this.executeAction(action, `PenButton${buttonIndex}`, 'pen');
          }
        }
      }
      
      this.penButtonStates.set(buttonIndex, isPressed);
    }
  }

  /**
   * アクション実行
   * @param action ショートカットアクション
   * @param keys 発火したキー
   * @param source 入力源
   */
  private executeAction(action: IShortcutAction, keys: string, source: string): void {
    try {
      action.callback();
      
      // イベント発火
      this.eventBus.emit('shortcut:triggered', {
        actionId: action.id,
        keys: [keys],
        source
      });
      
      console.log(`⌨️ ショートカット実行: ${action.id} (${keys})`);
      
    } catch (error) {
      console.error(`❌ ショートカット実行エラー (${action.id}):`, error);
    }
  }

  /**
   * キーコンビネーション取得
   * @param event キーボードイベント
   * @returns キー組み合わせ文字列
   */
  private getKeyCombo(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    // 修飾キー
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    if (event.metaKey) parts.push('Meta');
    
    // メインキー
    let key = event.key;
    
    //