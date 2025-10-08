class APNGExporter {
  constructor(manager) {
    this.manager = manager;
  }

  _checkUPNGAvailability() {
    if (typeof UPNG === 'undefined') {
      throw new Error('UPNG library not loaded. Add upng.js to index.html');
    }
  }

  async generateBlob(options = {}) {
    this._checkUPNGAvailability();

    const settings = this.manager.animationSystem.getSettings();
    const cuts = this.manager.animationSystem.getCuts();

    if (!cuts || cuts.length === 0) {
      throw new Error('No animation cuts available');
    }

    const frames = [];
    const delays = [];

    const savedState = this.manager.layerSystem.saveLayerStates();

    try {
      for (let i = 0; i < cuts.length; i++) {
        this.manager.animationSystem.applyCutToLayers(i);
        await new Promise(resolve => requestAnimationFrame(resolve));

        const canvas = await this.manager.renderToCanvas();
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, settings.width, settings.height);

        const rgbaBuffer = new Uint8Array(imageData.data.buffer);
        frames.push(rgbaBuffer.buffer);

        const duration = (typeof cuts[i].duration === 'number') ? cuts[i].duration : (1 / settings.fps);
        const delayMs = Math.round(duration * 1000);
        delays.push(delayMs);
      }

      const apngData = UPNG.encode(frames, settings.width, settings.height, 0, delays);
      const blob = new Blob([apngData], { type: 'image/png' });
      return blob;

    } finally {
      this.manager.layerSystem.restoreLayerStates(savedState);
    }
  }

  async export(options = {}) {
    const blob = await this.generateBlob(options);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = options.filename || `animation_${timestamp}.png`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  }
}