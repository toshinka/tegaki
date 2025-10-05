(function() {
  'use strict';

  class AnimationSystem {
    constructor(stateManager, eventBus, layerSystem) {
      this.stateManager = stateManager;
      this.eventBus = eventBus;
      this.layerSystem = layerSystem;

      this.playback = {
        isPlaying: false,
        startTime: 0,
        currentTime: 0,
        animationFrameId: null
      };

      this.settings = {
        fps: 24,
        loop: true
      };

      this.setupEventListeners();
    }

    setupEventListeners() {
      this.eventBus.on('animation:play', () => this.play());
      this.eventBus.on('animation:pause', () => this.pause());
      this.eventBus.on('animation:stop', () => this.stop());
      this.eventBus.on('animation:next-cut', () => this.nextCut());
      this.eventBus.on('animation:prev-cut', () => this.prevCut());
      this.eventBus.on('animation:settings-changed', (data) => this.updateSettings(data));
    }

    getCurrentCut() {
      return this.stateManager.getCurrentCut();
    }

    getAllCuts() {
      return this.stateManager.state.cuts || [];
    }

    createNewBlankCut() {
      const cutData = {
        id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `CUT${this.getAllCuts().length + 1}`,
        duration: 0.5,
        layers: [
          {
            id: `layer_${Date.now()}_bg`,
            name: '背景',
            visible: true,
            opacity: 1.0,
            isBackground: true,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            paths: []
          },
          {
            id: `layer_${Date.now()}_main`,
            name: 'レイヤー1',
            visible: true,
            opacity: 1.0,
            isBackground: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            paths: []
          }
        ]
      };

      const command = new window.CreateCutCommand(
        this.stateManager,
        this.eventBus,
        cutData
      );
      window.History.executeCommand(command);
    }

    deleteCut(cutIndex) {
      if (this.getAllCuts().length <= 1) {
        return;
      }

      const command = new window.DeleteCutCommand(
        this.stateManager,
        this.eventBus,
        cutIndex
      );
      window.History.executeCommand(command);
    }

    nextCut() {
      const cuts = this.getAllCuts();
      const currentIndex = this.stateManager.state.currentCutIndex || 0;
      const nextIndex = (currentIndex + 1) % cuts.length;
      this.switchToCut(nextIndex);
    }

    prevCut() {
      const cuts = this.getAllCuts();
      const currentIndex = this.stateManager.state.currentCutIndex || 0;
      const prevIndex = currentIndex === 0 ? cuts.length - 1 : currentIndex - 1;
      this.switchToCut(prevIndex);
    }

    switchToCut(cutIndex) {
      const cuts = this.getAllCuts();
      if (cutIndex < 0 || cutIndex >= cuts.length) return;

      this.stateManager.setActiveCut(cutIndex);
      this.layerSystem.rebuildFromState();
      this.eventBus.emit('animation:cut-switched', { cutIndex });
    }

    play() {
      if (this.playback.isPlaying) return;

      this.playback.isPlaying = true;
      this.playback.startTime = performance.now();
      this.playback.currentTime = 0;

      this.animationLoop();
      this.eventBus.emit('animation:playback-started');
    }

    pause() {
      this.playback.isPlaying = false;
      if (this.playback.animationFrameId) {
        cancelAnimationFrame(this.playback.animationFrameId);
        this.playback.animationFrameId = null;
      }
      this.eventBus.emit('animation:playback-paused');
    }

    stop() {
      this.pause();
      this.playback.currentTime = 0;
      this.switchToCut(0);
      this.eventBus.emit('animation:playback-stopped');
    }

    animationLoop() {
      if (!this.playback.isPlaying) return;

      const elapsed = (performance.now() - this.playback.startTime) / 1000;
      const cuts = this.getAllCuts();
      const currentCutIndex = this.stateManager.state.currentCutIndex || 0;
      const currentCut = cuts[currentCutIndex];

      if (elapsed >= currentCut.duration) {
        const nextIndex = currentCutIndex + 1;
        if (nextIndex < cuts.length) {
          this.switchToCut(nextIndex);
          this.playback.startTime = performance.now();
        } else {
          if (this.settings.loop) {
            this.switchToCut(0);
            this.playback.startTime = performance.now();
          } else {
            this.stop();
            return;
          }
        }
      }

      this.playback.animationFrameId = requestAnimationFrame(() => this.animationLoop());
    }

    updateSettings(settings) {
      if (settings.fps !== undefined) {
        this.settings.fps = settings.fps;
      }
      if (settings.loop !== undefined) {
        this.settings.loop = settings.loop;
      }
      this.eventBus.emit('animation:settings-updated', this.settings);
    }

    getPlaybackState() {
      return {
        isPlaying: this.playback.isPlaying,
        currentTime: this.playback.currentTime,
        currentCutIndex: this.stateManager.state.currentCutIndex || 0
      };
    }
  }

  window.AnimationSystem = AnimationSystem;
})();