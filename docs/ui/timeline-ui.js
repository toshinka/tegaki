// timeline-ui.js
// タイムライン UI 管理（Phase2.5: StateManager完全同期版）

class TimelineUI {
  constructor() {
    this.panel = null;
    this.cutsList = null;
    this.isVisible = false;
    this.dragState = null;
    
    EventBus.on('state:changed', () => this.render());
    EventBus.on('cut:changed', () => this.render());
    EventBus.on('layer:changed', () => this.render());
  }

  init() {
    this.createPanel();
    this.setupEventListeners();
    this.render();
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'timeline-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 120px;
      background: rgba(40, 40, 40, 0.95);
      border-top: 1px solid #555;
      display: none;
      z-index: 1000;
      overflow-x: auto;
      overflow-y: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      background: rgba(30, 30, 30, 0.9);
      border-bottom: 1px solid #555;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 32px;
    `;

    const title = document.createElement('span');
    title.textContent = 'Timeline (F2: Toggle)';
    title.style.cssText = 'color: #fff; font-size: 12px; font-weight: bold;';

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px;';

    const addButton = document.createElement('button');
    addButton.textContent = '+ Cut';
    addButton.style.cssText = `
      padding: 4px 12px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    `;
    addButton.onclick = () => this.addCut();

    controls.appendChild(addButton);
    header.appendChild(title);
    header.appendChild(controls);

    this.cutsList = document.createElement('div');
    this.cutsList.className = 'cuts-list';
    this.cutsList.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 12px;
      height: calc(100% - 32px);
      align-items: flex-start;
    `;

    this.panel.appendChild(header);
    this.panel.appendChild(this.cutsList);
    document.body.appendChild(this.panel);
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggle();
      }

      if (!this.isVisible) return;

      const cuts = StateManager.state.timeline.cuts;
      const currentIndex = StateManager.state.timeline.currentCutIndex;

      if (e.key === 'ArrowLeft' && !e.ctrlKey) {
        e.preventDefault();
        this.selectPreviousCut();
      } else if (e.key === 'ArrowRight' && !e.ctrlKey) {
        e.preventDefault();
        this.selectNextCut();
      } else if (e.key === 'Delete' && e.ctrlKey) {
        e.preventDefault();
        if (cuts.length > 1) {
          this.deleteCut(cuts[currentIndex].id);
        }
      }
    });
  }

  toggle() {
    this.isVisible = !this.isVisible;
    this.panel.style.display = this.isVisible ? 'block' : 'none';
    if (this.isVisible) {
      this.render();
    }
  }

  render() {
    if (!this.cutsList || !this.isVisible) return;

    this.cutsList.innerHTML = '';

    const cuts = StateManager.state.timeline.cuts;
    const currentIndex = StateManager.state.timeline.currentCutIndex;

    cuts.forEach((cut, index) => {
      const cutItem = this.createCutItem(cut, index, index === currentIndex);
      this.cutsList.appendChild(cutItem);
    });
  }

  createCutItem(cut, index, isActive) {
    const item = document.createElement('div');
    item.className = 'cut-item';
    item.dataset.cutId = cut.id;
    item.dataset.index = index;
    item.style.cssText = `
      min-width: 80px;
      width: 80px;
      height: 80px;
      background: ${isActive ? '#4a9eff' : '#2a2a2a'};
      border: 2px solid ${isActive ? '#fff' : '#555'};
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.2s;
    `;

    const label = document.createElement('div');
    label.textContent = cut.name || `Cut ${index + 1}`;
    label.style.cssText = `
      color: white;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 4px;
      text-align: center;
      padding: 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    `;

    const layerCount = document.createElement('div');
    layerCount.textContent = `${cut.layers.length} layers`;
    layerCount.style.cssText = `
      color: #aaa;
      font-size: 10px;
    `;

    item.appendChild(label);
    item.appendChild(layerCount);

    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-btn')) {
        this.selectCut(cut.id);
      }
    });

    item.addEventListener('mouseenter', () => {
      if (!isActive) {
        item.style.background = '#3a3a3a';
        item.style.borderColor = '#777';
      }
    });

    item.addEventListener('mouseleave', () => {
      if (!isActive) {
        item.style.background = '#2a2a2a';
        item.style.borderColor = '#555';
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      background: rgba(255, 50, 50, 0.8);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const cuts = StateManager.state.timeline.cuts;
      if (cuts.length > 1) {
        this.deleteCut(cut.id);
      }
    };

    item.appendChild(deleteBtn);

    return item;
  }

  selectCut(cutId) {
    const cuts = StateManager.state.timeline.cuts;
    const cutIndex = cuts.findIndex(c => c.id === cutId);
    
    if (cutIndex === -1) return;

    StateManager.setCurrentCutIndex(cutIndex);
    EventBus.emit('cut:changed', { cutId, cutIndex });
    this.render();
  }

  selectNextCut() {
    const cuts = StateManager.state.timeline.cuts;
    const currentIndex = StateManager.state.timeline.currentCutIndex;
    const nextIndex = Math.min(currentIndex + 1, cuts.length - 1);
    
    if (nextIndex !== currentIndex) {
      StateManager.setCurrentCutIndex(nextIndex);
      EventBus.emit('cut:changed', { cutId: cuts[nextIndex].id, cutIndex: nextIndex });
      this.render();
    }
  }

  selectPreviousCut() {
    const cuts = StateManager.state.timeline.cuts;
    const currentIndex = StateManager.state.timeline.currentCutIndex;
    const prevIndex = Math.max(currentIndex - 1, 0);
    
    if (prevIndex !== currentIndex) {
      StateManager.setCurrentCutIndex(prevIndex);
      EventBus.emit('cut:changed', { cutId: cuts[prevIndex].id, cutIndex: prevIndex });
      this.render();
    }
  }

  addCut() {
    const cuts = StateManager.state.timeline.cuts;
    const newIndex = cuts.length;
    const cutId = `cut_${Date.now()}`;
    
    const newCut = {
      id: cutId,
      name: `Cut ${newIndex + 1}`,
      layers: [{
        id: `layer_${Date.now()}`,
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1,
        paths: []
      }],
      activeLayerIndex: 0
    };

    const command = {
      name: 'add-cut',
      do: () => {
        StateManager.state.timeline.cuts.push(newCut);
        StateManager.setCurrentCutIndex(newIndex);
        EventBus.emit('cut:added', { cutId, cutIndex: newIndex });
        this.render();
      },
      undo: () => {
        const index = StateManager.state.timeline.cuts.findIndex(c => c.id === cutId);
        if (index !== -1) {
          StateManager.state.timeline.cuts.splice(index, 1);
          if (StateManager.state.timeline.currentCutIndex >= StateManager.state.timeline.cuts.length) {
            StateManager.setCurrentCutIndex(Math.max(0, StateManager.state.timeline.cuts.length - 1));
          }
          EventBus.emit('cut:removed', { cutId });
          this.render();
        }
      },
      meta: { type: 'cut', cutId }
    };

    History.push(command);
  }

  deleteCut(cutId) {
    const cuts = StateManager.state.timeline.cuts;
    if (cuts.length <= 1) return;

    const cutIndex = cuts.findIndex(c => c.id === cutId);
    if (cutIndex === -1) return;

    const cutToDelete = cuts[cutIndex];
    const currentIndex = StateManager.state.timeline.currentCutIndex;

    const command = {
      name: 'delete-cut',
      do: () => {
        const index = StateManager.state.timeline.cuts.findIndex(c => c.id === cutId);
        if (index !== -1) {
          StateManager.state.timeline.cuts.splice(index, 1);
          
          if (StateManager.state.timeline.currentCutIndex >= StateManager.state.timeline.cuts.length) {
            StateManager.setCurrentCutIndex(Math.max(0, StateManager.state.timeline.cuts.length - 1));
          } else if (index <= StateManager.state.timeline.currentCutIndex) {
            StateManager.setCurrentCutIndex(Math.max(0, StateManager.state.timeline.currentCutIndex - 1));
          }
          
          EventBus.emit('cut:removed', { cutId });
          this.render();
        }
      },
      undo: () => {
        StateManager.state.timeline.cuts.splice(cutIndex, 0, cutToDelete);
        StateManager.setCurrentCutIndex(currentIndex);
        EventBus.emit('cut:added', { cutId, cutIndex });
        this.render();
      },
      meta: { type: 'cut', cutId }
    };

    History.push(command);
  }

  show() {
    this.isVisible = true;
    this.panel.style.display = 'block';
    this.render();
  }

  hide() {
    this.isVisible = false;
    this.panel.style.display = 'none';
  }
}

window.TimelineUI = new TimelineUI();