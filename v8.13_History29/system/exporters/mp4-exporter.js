class MP4Exporter {
  constructor(layerSystem, animationSystem, exportManager) {
    this.layerSystem = layerSystem;
    this.animationSystem = animationSystem;
    this.exportManager = exportManager;
  }

  async generateBlob(options = {}) {
    throw new Error('MP4エクスポートは未実装です');
  }

  async export(options = {}) {
    throw new Error('MP4エクスポートは未実装です');
  }
}

window.MP4Exporter = MP4Exporter;