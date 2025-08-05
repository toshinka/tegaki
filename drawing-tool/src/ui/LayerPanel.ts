// LayerPanel.ts - レイヤーパネルUI・400px幅・64px項目・ドラッグ&ドロップ
// Phase1 UIManager継承・ふたば色・EventBus連携

import type { EventBus } from '../core/EventBus.js';
import type { ILayerData } from '../rendering/LayerManager.js';

/**
 * UI要素参照・DOM管理
 */
interface ILayerPanelElements {
  container: HTMLElement;
  header: HTMLElement;
  layerList: HTMLElement;
  addButton: HTMLElement;
  scrollContainer: HTMLElement;
}

/**
 * レイヤー項目データ・UI状態
 */
interface ILayerItemData {
  id: string;
  name: string;
  visible: boolean;
  active: boolean;
  opacity: number;
  element: HTMLElement;
  nameInput: HTMLInputElement;
  visibilityButton: HTMLElement;
  opacitySlider: HTMLInputElement;
}

/**
 * ドラッグ&ドロップ状態
 */
interface IDragState {
  isDragging: boolean;
  dragElement: HTMLElement | null;
  dragLayerId: string | null;
  startY: number;
  placeholder: HTMLElement | null;
}

/**
 * レイヤーパネルUI・Layer管理・ドラッグ対応
 * Phase1 ふたば色継承・400px幅・アクセシビリティ対応
 */
export class LayerPanel {
  private eventBus: EventBus;
  private container: HTMLElement;
  private elements: ILayerPanelElements;
  private layerItems = new Map<string, ILayerItemData>();
  
  // ドラッグ&ドロップ
  private dragState: IDragState = {
    isDragging: false,
    dragElement: null,
    dragLayerId: null,
    startY: 0,
    placeholder: null
  };
  
  // 設定
  private readonly panelWidth = 400;
  private readonly itemHeight = 64;
  private readonly headerHeight = 48;

  constructor(eventBus: EventBus, container: HTMLElement) {
    this.eventBus = eventBus;
    this.container = container;
    
    this.createLayerPanelHTML();
    this.setupLayerPanelCSS();
    this.setupEventListeners();
    this.setupDragAndDrop();
    
    console.log('📑 LayerPanel初期化完了');
  }

  /**
   * レイヤーパネルHTML構造作成
   */
  private createLayerPanelHTML(): void {
    this.container.innerHTML = `
      <div class="layer-panel" role="region" aria-label="レイヤーパネル">
        <!-- ヘッダー -->
        <div class="layer-panel-header">
          <h3>レイヤー</h3>
          <button class="layer-add-btn" 
                  type="button" 
                  aria-label="新しいレイヤーを追加"
                  title="新しいレイヤーを追加 (Ctrl+Shift+N)">
            <span class="icon">+</span>
          </button>
        </div>
        
        <!-- レイヤーリスト -->
        <div class="layer-scroll-container">
          <ul class="layer-list" role="list" aria-label="レイヤー一覧">
            <!-- レイヤー項目は動的生成 -->
          </ul>
        </div>
      </div>
    `;

    // 要素参照取得
    this.elements = {
      container: this.container.querySelector('.layer-panel')!,
      header: this.container.querySelector('.layer-panel-header')!,
      layerList: this.container.querySelector('.layer-list')!,
      addButton: this.container.querySelector('.layer-add-btn')!,
      scrollContainer: this.container.querySelector('.layer-scroll-container')!
    };
  }

  /**
   * CSS設定・ふたば色・400px幅
   */
  private setupLayerPanelCSS(): void {
    const styles = `
      /* レイヤーパネル基本 */
      .layer-panel {
        width: ${this.panelWidth}px;
        height: 100%;
        background: #ffffee;
        border: 2px solid #800000;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        font-family: 'MS PGothic', 'MS Gothic', monospace;
      }

      /* ヘッダー */
      .layer-panel-header {
        height: ${this.headerHeight}px;
        padding: 8px 16px;
        background: #800000;
        color: #ffffee;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #800000;
      }

      .layer-panel-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: bold;
      }

      .layer-add-btn {
        width: 32px;
        height: 32px;
        background: #ffffee;
        border: 2px solid #800000;
        border-radius: 4px;
        color: #800000;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .layer-add-btn:hover {
        background: #f0e68c;
        transform: translateY(-1px);
      }

      .layer-add-btn:active {
        transform: translateY(0);
      }

      /* スクロールコンテナ */
      .layer-scroll-container {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #800000 #ffffee;
      }

      .layer-scroll-container::-webkit-scrollbar {
        width: 8px;
      }

      .layer-scroll-container::-webkit-scrollbar-track {
        background: #ffffee;
      }

      .layer-scroll-container::-webkit-scrollbar-thumb {
        background: #800000;
        border-radius: 4px;
      }

      /* レイヤーリスト */
      .layer-list {
        list-style: none;
        margin: 0;
        padding: 8px;
        min-height: 100%;
      }

      /* レイヤー項目 */
      .layer-item {
        height: ${this.itemHeight}px;
        margin-bottom: 4px;
        background: #ffffee;
        border: 2px solid #ccc;
        border-radius: 6px;
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;
        user-select: none;
      }

      .layer-item:hover {
        border-color: #800000;
        box-shadow: 0 2px 4px rgba(128, 0, 0, 0.2);
      }

      .layer-item.active {
        background: #f0e68c;
        border-color: #800000;
        box-shadow: 0 0 0 2px rgba(128, 0, 0, 0.3);
      }

      .layer-item.dragging {
        opacity: 0.7;
        transform: rotate(2deg);
        z-index: 1000;
        pointer-events: none;
      }

      /* サムネイル */
      .layer-thumbnail {
        width: 48px;
        height: 48px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #666;
        flex-shrink: 0;
      }

      /* レイヤー情報 */
      .layer-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      /* レイヤー名 */
      .layer-name {
        font-size: 14px;
        font-weight: bold;
        color: #333;
        background: transparent;
        border: none;
        padding: 2px 4px;
        border-radius: 3px;
        width: 100%;
        transition: background 0.2s ease;
      }

      .layer-name:focus {
        background: #fff;
        outline: 2px solid #800000;
      }

      /* 不透明度スライダー */
      .layer-opacity {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .opacity-label {
        font-size: 11px;
        color: #666;
        min-width: 40px;
      }

      .opacity-slider {
        flex: 1;
        height: 4px;
        background: #ddd;
        border-radius: 2px;
        outline: none;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
      }

      .opacity-slider::-webkit-slider-thumb {
        width: 16px;
        height: 16px;
        background: #800000;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
      }

      .opacity-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: #800000;
        border-radius: 50%;
        border: none;
        cursor: pointer;
      }

      /* コントロールボタン */
      .layer-controls {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }

      .layer-control-btn {
        width: 24px;
        height: 24px;
        background: transparent;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .layer-control-btn:hover {
        border-color: #800000;
        background: #f5f5f5;
      }

      .layer-control-btn.active {
        background: #800000;
        color: #ffffee;
        border-color: #800000;
      }

      /* ドラッグプレースホルダー */
      .drag-placeholder {
        height: ${this.itemHeight}px;
        margin-bottom: 4px;
        background: repeating-linear-gradient(
          45deg,
          #800000,
          #800000 10px,
          #ffffee 10px,
          #ffffee 20px
        );
        border: 2px dashed #800000;
        border-radius: 6px;
        opacity: 0.5;
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.8; }
      }

      /* 空状態 */
      .layer-list-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 120px;
        color: #666;
        font-size: 14px;
        text-align: center;
      }

      /* レスポンシブ・小さな画面対応 */
      @media (max-width: 500px) {
        .layer-panel {
          width: 100%;
          max-width: ${this.panelWidth}px;
        }
        
        .layer-item {
          height: 56px;
          padding: 6px 10px;
        }
        
        .layer-thumbnail {
          width: 40px;
          height: 40px;
        }
      }

      /* アクセシビリティ・高コントラストモード */
      @media (prefers-contrast: high) {
        .layer-panel {
          border-width: 3px;
        }
        
        .layer-item {
          border-width: 3px;
        }
        
        .layer-control-btn {
          border-width: 2px;
        }
      }

      /* 動きを減らす設定対応 */
      @media (prefers-reduced-motion: reduce) {
        .layer-item,
        .layer-add-btn,
        .layer-control-btn,
        .opacity-slider {
          transition: none;
        }
        
        .drag-placeholder {
          animation: none;
        }
      }
    `;

    // スタイル適用
    const existingStyles = document.getElementById('layer-panel-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    const styleSheet = document.createElement('style');
    styleSheet.id = 'layer-panel-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * イベントリスナー設定・UI操作
   */
  private setupEventListeners(): void {
    // 新規レイヤー追加
    this.elements.addButton.addEventListener('click', () => {
      this.eventBus.emit('ui:layer-create', { timestamp: Date.now() });
    });

    // LayerManager連携・レイヤー状態更新
    this.eventBus.on('layer:create', (data) => {
      this.addLayerItem(data);
    });

    this.eventBus.on('layer:delete', (data) => {
      this.removeLayerItem(data.id);
    });

    this.eventBus.on('layer:reorder', (data) => {
      this.reorderLayerItem(data.id, data.newIndex);
    });

    this.eventBus.on('layer:visibility-change', (data) => {
      this.updateLayerVisibility(data.id, data.visible);
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.elements.addButton.click();
      }
    });
  }

  /**
   * ドラッグ&ドロップ設定・並び替え機能
   */
  private setupDragAndDrop(): void {
    this.elements.layerList.addEventListener('mousedown', (e) => {
      const layerItem = (e.target as HTMLElement).closest('.layer-item') as HTMLElement;
      if (!layerItem) return;

      const layerId = layerItem.dataset.layerId;
      if (!layerId) return;

      // ドラッグ開始
      this.startDrag(layerItem, layerId, e.clientY);
      e.preventDefault();
    });

    // グローバルマウスイベント
    document.addEventListener('mousemove', (e) => {
      if (this.dragState.isDragging) {
        this.handleDragMove(e);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.dragState.isDragging) {
        this.endDrag();
      }
    });

    // タッチイベント対応・将来拡張
    this.elements.layerList.addEventListener('touchstart', (e) => {
      // Phase3でタッチ対応実装予定
    }, { passive: true });
  }

  /**
   * レイヤー項目追加・UI更新
   */
  private addLayerItem(data: { id: string; name: string; index: number }): void {
    const layerItem = this.createLayerItemElement(data.id, data.name);
    this.layerItems.set(data.id, layerItem);

    // 挿入位置計算・順序保持
    const children = Array.from(this.elements.layerList.children);
    if (data.index >= children.length) {
      this.elements.layerList.appendChild(layerItem.element);
    } else {
      this.elements.layerList.insertBefore(layerItem.element, children[data.index]);
    }

    // アニメーション・新規項目強調
    layerItem.element.style.transform = 'translateX(-20px)';
    layerItem.element.style.opacity = '0';
    
    requestAnimationFrame(() => {
      layerItem.element.style.transition = 'all 0.3s ease';
      layerItem.element.style.transform = 'translateX(0)';
      layerItem.element.style.opacity = '1';
    });
  }

  /**
   * レイヤー項目要素作成・DOM構築
   */
  private createLayerItemElement(layerId: string, layerName: string): ILayerItemData {
    const element = document.createElement('li');
    element.className = 'layer-item';
    element.dataset.layerId = layerId;
    element.setAttribute('role', 'listitem');
    element.setAttribute('aria-label', `レイヤー: ${layerName}`);
    element.draggable = true;

    element.innerHTML = `
      <div class="layer-thumbnail" aria-hidden="true">
        <span>🎨</span>
      </div>
      <div class="layer-info">
        <input type="text" 
               class="layer-name" 
               value="${layerName}"
               aria-label="レイヤー名"
               maxlength="50">
        <div class="layer-opacity">
          <span class="opacity-label" aria-hidden="true">100%</span>
          <input type="range" 
                 class="opacity-slider"
                 min="0" 
                 max="100" 
                 value="100"
                 aria-label="不透明度">
        </div>
      </div>
      <div class="layer-controls">
        <button class="layer-control-btn active" 
                type="button"
                aria-label="表示/非表示切り替え"
                data-action="visibility">
          👁
        </button>
      </div>
    `;

    // 要素参照取得
    const nameInput = element.querySelector('.layer-name') as HTMLInputElement;
    const visibilityButton = element.querySelector('[data-action="visibility"]') as HTMLElement;
    const opacitySlider = element.querySelector('.opacity-slider') as HTMLInputElement;
    const opacityLabel = element.querySelector('.opacity-label') as HTMLElement;

    // イベントリスナー設定
    this.setupLayerItemEvents(element, layerId, nameInput, visibilityButton, opacitySlider, opacityLabel);

    const itemData: ILayerItemData = {
      id: layerId,
      name: layerName,
      visible: true,
      active: false,
      opacity: 1.0,
      element,
      nameInput,
      visibilityButton,
      opacitySlider
    };

    return itemData;
  }

  /**
   * レイヤー項目イベント設定
   */
  private setupLayerItemEvents(
    element: HTMLElement,
    layerId: string,
    nameInput: HTMLInputElement,
    visibilityButton: HTMLElement,
    opacitySlider: HTMLInputElement,
    opacityLabel: HTMLElement
  ): void {
    // レイヤー選択
    element.addEventListener('click', (e) => {
      if (e.target === nameInput || e.target === opacitySlider || e.target === visibilityButton) {
        return; // コントロール操作時は選択しない
      }
      
      this.selectLayer(layerId);
    });

    // 名前変更
    nameInput.addEventListener('blur', () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== this.layerItems.get(layerId)?.name) {
        this.eventBus.emit('ui:layer-rename', {
          layerId,
          newName,
          timestamp: Date.now()
        });
      }
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        nameInput.blur();
      } else if (e.key === 'Escape') {
        nameInput.value = this.layerItems.get(layerId)?.name || '';
        nameInput.blur();
      }
    });

    // 表示切り替え
    visibilityButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.eventBus.emit('ui:layer-visibility-toggle', {
        layerId,
        timestamp: Date.now()
      });
    });

    // 不透明度変更
    opacitySlider.addEventListener('input', () => {
      const opacity = parseInt(opacitySlider.value) / 100;
      opacityLabel.textContent = `${opacitySlider.value}%`;
      
      this.eventBus.emit('ui:layer-opacity-change', {
        layerId,
        opacity,
        timestamp: Date.now()
      });
    });

    // 右クリックメニュー・Phase2後半実装予定
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // TODO: コンテキストメニュー実装
    });
  }

  /**
   * レイヤー選択・アクティブ状態更新
   */
  private selectLayer(layerId: string): void {
    // 既存選択解除
    for (const item of this.layerItems.values()) {
      item.element.classList.remove('active');
      item.active = false;
    }

    // 新規選択
    const selectedItem = this.layerItems.get(layerId);
    if (selectedItem) {
      selectedItem.element.classList.add('active');
      selectedItem.active = true;
      
      this.eventBus.emit('ui:layer-select', {
        layerId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * レイヤー項目削除・UI更新
   */
  private removeLayerItem(layerId: string): void {
    const item = this.layerItems.get(layerId);
    if (!item) return;

    // フェードアウトアニメーション
    item.element.style.transition = 'all 0.3s ease';
    item.element.style.transform = 'translateX(-20px)';
    item.element.style.opacity = '0';

    setTimeout(() => {
      if (item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
      this.layerItems.delete(layerId);
    }, 300);
  }

  /**
   * レイヤー項目並び替え・UI更新
   */
  private reorderLayerItem(layerId: string, newIndex: number): void {
    const item = this.layerItems.get(layerId);
    if (!item) return;

    const children = Array.from(this.elements.layerList.children);
    const currentIndex = children.indexOf(item.element);
    
    if (currentIndex === newIndex) return;

    // DOM操作・要素移動
    if (newIndex >= children.length) {
      this.elements.layerList.appendChild(item.element);
    } else {
      this.elements.layerList.insertBefore(item.element, children[newIndex]);
    }

    // 移動アニメーション・視覚フィードバック
    item.element.style.transform = 'scale(1.05)';
    setTimeout(() => {
      item.element.style.transform = 'scale(1)';
    }, 200);
  }

  /**
   * レイヤー表示状態更新・UI同期
   */
  private updateLayerVisibility(layerId: string, visible: boolean): void {
    const item = this.layerItems.get(layerId);
    if (!item) return;

    item.visible = visible;
    
    if (visible) {
      item.visibilityButton.classList.add('active');
      item.visibilityButton.textContent = '👁';
      item.element.style.opacity = '1';
    } else {
      item.visibilityButton.classList.remove('active');
      item.visibilityButton.textContent = '🙈';
      item.element.style.opacity = '0.6';
    }
  }

  /**
   * ドラッグ開始・状態初期化
   */
  private startDrag(element: HTMLElement, layerId: string, startY: number): void {
    this.dragState = {
      isDragging: true,
      dragElement: element,
      dragLayerId: layerId,
      startY,
      placeholder: null
    };

    element.classList.add('dragging');
    document.body.style.cursor = 'grabbing';
    
    // プレースホルダー作成
    const placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    this.dragState.placeholder = placeholder;
  }

  /**
   * ドラッグ移動・プレースホルダー更新
   */
  private handleDragMove(e: MouseEvent): void {
    if (!this.dragState.isDragging || !this.dragState.dragElement || !this.dragState.placeholder) {
      return;
    }

    const layerList = this.elements.layerList;
    const rect = layerList.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // 挿入位置計算
    const children = Array.from(layerList.children).filter(child => 
      child !== this.dragState.dragElement && child !== this.dragState.placeholder
    );

    let insertIndex = children.length;
    
    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      const childY = childRect.top - rect.top + childRect.height / 2;
      
      if (y < childY) {
        insertIndex = i;
        break;
      }
    }

    // プレースホルダー配置
    if (insertIndex >= children.length) {
      layerList.appendChild(this.dragState.placeholder);
    } else {
      layerList.insertBefore(this.dragState.placeholder, children[insertIndex]);
    }
  }

  /**
   * ドラッグ終了・並び替え実行
   */
  private endDrag(): void {
    if (!this.dragState.isDragging || !this.dragState.dragElement || !this.dragState.placeholder) {
      return;
    }

    const dragElement = this.dragState.dragElement;
    const placeholder = this.dragState.placeholder;
    const layerId = this.dragState.dragLayerId!;

    // 新しいインデックス計算
    const children = Array.from(this.elements.layerList.children);
    const newIndex = children.indexOf(placeholder);

    // プレースホルダー削除・要素復元
    if (placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    
    dragElement.classList.remove('dragging');
    document.body.style.cursor = '';

    // 並び替えイベント発火
    if (newIndex >= 0) {
      this.eventBus.emit('ui:layer-reorder', {
        layerId,
        newIndex,
        timestamp: Date.now()
      });
    }

    // 状態リセット
    this.dragState = {
      isDragging: false,
      dragElement: null,
      dragLayerId: null,
      startY: 0,
      placeholder: null
    };
  }

  /**
   * レイヤーリスト更新・外部同期
   */
  public updateLayerList(layers: Array<{ id: string; name: string; visible: boolean; active: boolean }>): void {
    // 既存項目更新
    for (const layer of layers) {
      let item = this.layerItems.get(layer.id);
      
      if (!item) {
        // 新規項目作成
        this.addLayerItem({ id: layer.id, name: layer.name, index: layers.indexOf(layer) });
        item = this.layerItems.get(layer.id)!;
      }

      // 状態同期
      item.nameInput.value = layer.name;
      item.visible = layer.visible;
      item.active = layer.active;

      // UI更新
      if (layer.active) {
        item.element.classList.add('active');
      } else {
        item.element.classList.remove('active');
      }

      this.updateLayerVisibility(layer.id, layer.visible);
    }

    // 削除された項目処理
    const currentLayerIds = new Set(layers.map(l => l.id));
    for (const [layerId, item] of this.layerItems) {
      if (!currentLayerIds.has(layerId)) {
        this.removeLayerItem(layerId);
      }
    }
  }

  /**
   * 空状態表示・レイヤーなし
   */
  private showEmptyState(): void {
    if (this.layerItems.size === 0) {
      this.elements.layerList.innerHTML = `
        <li class="layer-list-empty">
          <div>
            レイヤーがありません<br>
            <small>「+」ボタンで新しいレイヤーを作成</small>
          </div>
        </li>
      `;
    }
  }

  /**
   * リソース解放・メモリクリーンアップ
   */
  public destroy(): void {
    console.log('📑 LayerPanel終了処理開始...');
    
    // ドラッグ状態リセット
    if (this.dragState.isDragging) {
      this.endDrag();
    }

    // CSS削除
    const styleSheet = document.getElementById('layer-panel-styles');
    if (styleSheet) {
      styleSheet.remove();
    }

    // データクリア
    this.layerItems.clear();
    
    // DOM要素クリア
    this.container.innerHTML = '';
    
    console.log('📑 LayerPanel終了処理完了');
  }
}