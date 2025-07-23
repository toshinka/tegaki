// src/ui/ToolPanel.js
// ツール選択UI（Phosphor Icons統合）
// Phase2-A: Vite環境でのPhosphor Icons SVG直接実装

export class ToolPanel {
  constructor(container, serviceContainer) {
    this.container = container;
    this.serviceContainer = serviceContainer;
    
    // ServiceContainerからサービス取得 - resolve()メソッドを使用
    this.toolStore = serviceContainer.resolve('toolStore');
    this.toolEngineController = serviceContainer.resolve('toolEngineController');
    
    this.tools = [
      { 
        id: 'pen', 
        name: 'ペン', 
        icon: 'Pencil',
        engine: 'bezier',
        description: 'Bezier.js精密ペン描画'
      },
      { 
        id: 'eraser', 
        name: '消しゴム', 
        icon: 'Eraser',
        engine: 'canvas2d',
        description: 'Canvas2D消去ツール'
      }
    ];

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    
    // 初期ツール選択（ペンツール）
    this.selectTool('pen');
  }

  render() {
    this.container.innerHTML = this.tools.map(tool => this.renderToolButton(tool)).join('');

    // React IconsをVanilla JSで使用するためのヘルパー
    this.renderIcons();
  }

  renderToolButton(tool) {
    return `
      <button 
        class="tool-button"
        data-tool="${tool.id}"
        data-engine="${tool.engine}"
        title="${tool.description}"
      >
        <div class="icon-container" data-icon="${tool.id}">
          <!-- アイコンはrenderIcons()で動的挿入 -->
        </div>
      </button>
    `;
  }

  renderIcons() {
    // Vite環境でのPhosphor Icons シンプル統合
    // React IconsはReact環境専用のため、Vanilla JSでは直接SVGを使用
    const iconSvgs = {
      pen: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M227.31,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.32,64l24-24L216,84.68Z"/>
            </svg>`,
      brush: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
               <path d="M232,80a56.06,56.06,0,0,1-56,56H172a4,4,0,0,1-4-4V128a12,12,0,0,0-24,0v4a4,4,0,0,1-4,4H136a56.06,56.06,0,0,1-56-56,8,8,0,0,1,8-8H224A8,8,0,0,1,232,80ZM72,160v48a16,16,0,0,0,16,16h80a16,16,0,0,0,16-16V160a8,8,0,0,0-16,0v48H88V160a8,8,0,0,0-16,0Z"/>
             </svg>`,
      eraser: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                <path d="M225,80.4,183.6,39a24,24,0,0,0-33.94,0L31,157.66a24,24,0,0,0,0,33.94L72.4,233a24,24,0,0,0,33.94,0l26.83-26.82L225,114.34A24,24,0,0,0,225,80.4ZM108.68,217.37A8,8,0,0,1,103,220H72.4a8,8,0,0,1-5.66-2.34l-41.4-41.41a8,8,0,0,1,0-11.31L124.69,66.34,189.66,131.3Z"/>
              </svg>`,
      select: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                 <path d="M220.24,132.24l-72,72a6,6,0,0,1-8.48,0l-72-72a6,6,0,0,1,8.48-8.48L134,181.51V40a6,6,0,0,1,12,0V181.51l57.76-57.75a6,6,0,0,1,8.48,8.48Z"/>
               </svg>`,
      pan: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
             <path d="M188,80a59.88,59.88,0,0,0-31.23,8.84L134,73.6V64a60,60,0,0,0-120,0v80a60,60,0,0,0,60,60h88a60,60,0,0,0,60-60V140A60.07,60.07,0,0,0,188,80Z"/>
           </svg>`,
      circle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"/>
              </svg>`,
      rectangle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                   <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Z"/>
                 </svg>`,
      line: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM48,48H208V80H48ZM48,208V96H208V208Z"/>
            </svg>`
    };

    this.tools.forEach(tool => {
      const iconContainer = this.container.querySelector(`[data-icon="${tool.id}"]`);
      if (iconContainer && iconSvgs[tool.id]) {
        iconContainer.innerHTML = iconSvgs[tool.id];
      } else if (iconContainer) {
        // フォールバック: 絵文字アイコン
        iconContainer.innerHTML = this.getFallbackIcon(tool.id);
      }
    });
  }

  getFallbackIcon(toolId) {
    const fallbacks = {
      pen: '✏️',
    };
    
    return `<span class="text-xl">${fallbacks[toolId] || '🔧'}</span>`;
  }

  bindEvents() {
    // ツールボタンクリックイベント
    this.container.addEventListener('click', (e) => {
      const toolButton = e.target.closest('.tool-button');
      if (toolButton) {
        const toolId = toolButton.dataset.tool;
        const engineType = toolButton.dataset.engine;
        this.selectTool(toolId, engineType);
      }
    });

    // ToolStore状態変更監視（メソッドが存在する場合のみ）
    if (this.toolStore && typeof this.toolStore.subscribe === 'function') {
      this.toolStore.subscribe(() => {
        this.updateUI();
      });
    }
  }

  selectTool(toolId, engineType = null) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) {
      console.warn(`Unknown tool: ${toolId}`);
      return;
    }

    // ToolEngineController厳格連動
    // ツール選択 = エンジン起動の唯一トリガー
    if (this.toolEngineController && typeof this.toolEngineController.switchTool === 'function') {
      this.toolEngineController.switchTool(toolId, tool.engine);
    }
    
    // ToolStore状態更新
    if (this.toolStore && typeof this.toolStore.setActiveTool === 'function') {
      this.toolStore.setActiveTool(toolId);
    }
    
    console.log(`🎨 ツール切替: ${tool.name} (Engine: ${tool.engine})`);
  }

  updateUI() {
    if (!this.toolStore || typeof this.toolStore.getActiveTool !== 'function') {
      return;
    }

    const currentTool = this.toolStore.getActiveTool();
    const tool = this.tools.find(t => t.id === currentTool);
    
    // ツールボタンのアクティブ状態更新
    this.container.querySelectorAll('.tool-button').forEach(button => {
      const isActive = button.dataset.tool === currentTool;
      
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    console.log(`🔄 UI更新: ${tool ? tool.name : currentTool}ツール選択中`);
  }

  // Phase2-A段階での基本動作確認メソッド
  validatePhase2A() {
    const checks = {
      phosphorIcons: this.container.querySelectorAll('[data-icon]').length === this.tools.length,
      toolButtons: this.container.querySelectorAll('.tool-button').length === this.tools.length,
      serviceContainer: !!this.serviceContainer,
      toolStore: !!this.toolStore,
      toolEngineController: !!this.toolEngineController
    };

    const isValid = Object.values(checks).every(Boolean);
    
    console.log('🔍 ToolPanel Phase2-A 検証:', checks);
    
    if (!isValid) {
      console.error('❌ ToolPanel Phase2-A 検証失敗');
    } else {
      console.log('✅ ToolPanel Phase2-A 検証成功');
    }

    return isValid;
  }
}

export default ToolPanel;