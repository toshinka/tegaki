class GIFExporter {
  constructor(manager) {
    this.manager = manager;
  }

  async createWorkerBlobURL() {
    try {
      const localResp = await fetch('./vendor/gif.worker.js');
      if (localResp.ok) {
        const localCode = await localResp.text();
        return URL.createObjectURL(new Blob([localCode], { type: 'application/javascript' }));
      }
    } catch (e) {
    }

    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
      const workerCode = await response.text();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    } catch (error) {
      throw new Error('Worker script unavailable. Place gif.worker.js in ./vendor/ or use http(s) server.');
    }
  }

  async generateBlob(options = {}) {
    if (typeof GIF === 'undefined') {
      throw new Error('GIF library not loaded');
    }

    const settings = this.manager.animationSystem.getSettings();
    const cuts = this.manager.animationSystem.getCuts();

    if (!cuts || cuts.length === 0) {
      throw new Error('No animation cuts available');
    }

    const workerUrl = await this.createWorkerBlobURL();

    const gif = new GIF({
      workers: 2,
      quality: options.quality || 10,
      width: settings.width,
      height: settings.height,
      workerScript: workerUrl
    });

    const savedState = this.manager.layerSystem.saveLayerStates();

    try {
      for (let i = 0; i < cuts.length; i++) {
        this.manager.animationSystem.applyCutToLayers(i);
        await new Promise(resolve => requestAnimationFrame(resolve));

        const canvas = await this.manager.renderToCanvas();
        const duration = (typeof cuts[i].duration === 'number') ? cuts[i].duration : (1 / settings.fps);
        const delayMs = Math.round(duration * 1000);

        gif.addFrame(canvas, { delay: delayMs });
      }

      return new Promise((resolve, reject) => {
        gif.on('finished', (blob) => {
          URL.revokeObjectURL(workerUrl);
          resolve(blob);
        });
        gif.on('error', (error) => {
          URL.revokeObjectURL(workerUrl);
          reject(error);
        });
        gif.render();
      });

    } finally {
      this.manager.layerSystem.restoreLayerStates(savedState);
    }
  }

  async export(options = {}) {
    const blob = await this.generateBlob(options);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = options.filename || `animation_${timestamp}.gif`;

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