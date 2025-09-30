// ============================================
// TimelineUI - B案: CUT = フォルダ方式対応
// ============================================

class TimelineUI {
  constructor() {
    this.animationSystem = null;
    this.eventBus = null;
    this.draggedCutIndex = null;
  }

  init(animationSystem, eventBus) {
    this.animationSystem = animationSystem;
    this.eventBus = eventBus;

    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('animation:cut-created', () => this.render());
    this.eventBus.on('animation:cut-deleted', () => this.render());
    this.eventBus.on('animation:cut-applied', () => this.render());
    this.eventBus.on('animation:thumbnail-generated', () => this.render());
    this.eventBus.on('animation:cut-duration-updated', () => this.render());
    this.eventBus.on('animation:cuts-reordered', () => this.render());
  }

  render() {
    const timelineContainer = document.getElementById('timeline-cuts');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = '';

    this.animationSystem.cutMetadata.forEach((cutData, index) => {
      const cutElement = this.createCutElement(cutData, index);
      timelineContainer.appendChild(cutElement);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'timeline-add-cut-btn';
    addBtn.textContent = '+ CUT';
    addBtn.onclick = () => this.handleAddCut();
    timelineContainer.appendChild(addBtn);
  }

  createCutElement(cutData, index) {
    const cutElement = document.createElement('div');
    cutElement.className = 'timeline-cut' + 
      (index === this.animationSystem.activeCutIndex ? ' active' : '');
    cutElement.dataset.cutIndex = index;
    cutElement.draggable = true;

    // Drag & Drop
    cutElement.ondragstart = (e) => {
      this.draggedCutIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      cutElement.classList.add('dragging');
    };

    cutElement.ondragend = () => {
      cutElement.classList.remove('dragging');
      this.draggedCutIndex = null;
    };

    cutElement.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    cutElement.ondrop = (e) => {
      e.preventDefault();
      if (this.draggedCutIndex !== null && this.draggedCutIndex !== index) {
        this.animationSystem.reorderCuts(this.draggedCutIndex, index);
      }
    };

    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'timeline-cut-thumbnail';
    
    if (cutData.thumbnailCanvas) {
      const img = document.createElement('img');
      img.src = cutData.thumbnailCanvas.toDataURL();
      thumbnail.appendChild(img);
    } else {
      thumbnail.textContent = 'No Preview';
    }

    cutElement.appendChild(thumbnail);

    // Info
    const info = document.createElement('div');
    info.className = 'timeline-cut-info';

    const name = document.createElement('div');
    name.className = 'timeline-cut-name';
    name.textContent = cutData.name;
    info.appendChild(name);

    const duration = document.createElement('div');
    duration.className = 'timeline-cut-duration';
    duration.textContent = `${cutData.duration.toFixed(2)}s`;
    info.appendChild(duration);

    cutElement.appendChild(info);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'timeline-cut-controls';

    // Duration controls
    const durationControls = document.createElement('div');
    durationControls.className = 'timeline-duration-controls';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'timeline-duration-btn';
    decreaseBtn.innerHTML = '◀'; // シンプルな矢印
    decreaseBtn.title = 'CUT時間を減らす';
    decreaseBtn.onclick = (e) => {
      e.stopPropagation();
      const newDuration = Math.max(0.1, cutData.duration - 0.1);
      this.animationSystem.updateCutDuration(index, newDuration);
    };

    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'timeline-duration-btn';
    increaseBtn.innerHTML = '▶'; // シンプルな矢印
    increaseBtn.title = 'CUT時間を増やす';
    increaseBtn.onclick = (e) => {
      e.stopPropagation();
      const newDuration = cutData.duration + 0.1;
      this.animationSystem.updateCutDuration(index, newDuration);
    };

    durationControls.appendChild(decreaseBtn);
    durationControls.appendChild(increaseBtn);
    controls.appendChild(durationControls);

    // Delete button
    if (this.animationSystem.cutMetadata.length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'timeline-cut-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'CUTを削除';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`${cutData.name}を削除しますか？`)) {
          this.animationSystem.deleteCut(index);
        }
      };
      controls.appendChild(deleteBtn);
    }

    cutElement.appendChild(controls);

    // Click to activate
    cutElement.onclick = () => {
      this.animationSystem.switchToActiveCut(index);
    };

    return cutElement;
  }

  handleAddCut() {
    const menu = document.createElement('div');
    menu.className = 'timeline-add-menu';
    menu.style.cssText = 'position: absolute; background: #2a2a2a; border: 1px solid #444; padding: 8px; z-index: 10000;';

    const blankBtn = document.createElement('button');
    blankBtn.textContent = '空白CUT作成';
    blankBtn.style.cssText = 'display: block; width: 100%; margin-bottom: 4px; padding: 6px;';
    blankBtn.onclick = () => {
      this.animationSystem.createNewCut('blank');
      menu.remove();
    };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '現在CUTをコピー';
    copyBtn.style.cssText = 'display: block; width: 100%; padding: 6px;';
    copyBtn.onclick = () => {
      this.animationSystem.createNewCut('copy_current');
      menu.remove();
    };

    menu.appendChild(blankBtn);
    menu.appendChild(copyBtn);

    document.body.appendChild(menu);

    const addBtn = document.querySelector('.timeline-add-cut-btn');
    const rect = addBtn.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';

    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  // ============================================
  // Playback Controls
  // ============================================

  setupPlaybackControls() {
    const playBtn = document.getElementById('animation-play-btn');
    const stopBtn = document.getElementById('animation-stop-btn');
    const nextBtn = document.getElementById('animation-next-btn');
    const prevBtn = document.getElementById('animation-prev-btn');
    const loopCheckbox = document.getElementById('animation-loop-checkbox');

    if (playBtn) {
      playBtn.onclick = () => this.animationSystem.play();
    }

    if (stopBtn) {
      stopBtn.onclick = () => this.animationSystem.stop();
    }

    if (nextBtn) {
      nextBtn.onclick = () => this.animationSystem.goToNextFrame();
    }

    if (prevBtn) {
      prevBtn.onclick = () => this.animationSystem.goToPreviousFrame();
    }

    if (loopCheckbox) {
      loopCheckbox.checked = this.animationSystem.playbackState.loop;
      loopCheckbox.onchange = (e) => {
        this.animationSystem.playbackState.loop = e.target.checked;
      };
    }
  }
}