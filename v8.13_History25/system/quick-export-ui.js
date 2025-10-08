class QuickExportUI {
  constructor(exportManager) {
    this.exportManager = exportManager;
    this.overlay = null;
    this.panel = null;
    this.statusDiv = null;
    this.isVisible = false;
  }

  initialize() {
    this.createUI();
    this.setupKeyboardShortcuts();
  }

  createUI() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'quickExportOverlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: none;
      z-index: 9999;
      justify-content: center;
      align-items: center;
    `;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      min-width: 300px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Quick Export';
    title.style.marginTop = '0';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 15px 0;
    `;

    const formats = [
      { name: 'APNG', format: 'apng' },
      { name: 'GIF', format: 'gif' },
      { name: 'WebP (animated)', format: 'webp' }
    ];

    formats.forEach(({ name, format }) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = `
        padding: 10px;
        cursor: pointer;
        border: 1px solid #ccc;
        background: #f5f5f5;
        border-radius: 4px;
      `;
      btn.addEventListener('mouseenter', () => btn.style.background = '#e0e0e0');
      btn.addEventListener('mouseleave', () => btn.style.background = '#f5f5f5');
      btn.addEventListener('click', () => this.handleExport(format));
      buttonContainer.appendChild(btn);
    });

    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      margin-top: 15px;
      padding: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 12px;
      min-height: 20px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close (Esc)';
    closeBtn.style.cssText = `
      margin-top: 10px;
      padding: 8px 16px;
      cursor: pointer;
      width: 100%;
    `;
    closeBtn.addEventListener('click', () => this.hide());

    this.panel.appendChild(title);
    this.panel.appendChild(buttonContainer);
    this.panel.appendChild(this.statusDiv);
    this.panel.appendChild(closeBtn);
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  async handleExport(format) {
    this.setStatus('Exporting...');
    
    try {
      let blob;
      let filename;

      if (format === 'gif') {
        const gifExporter = this.exportManager.exporters.gif;
        if (!gifExporter || typeof gifExporter.generateBlob !== 'function') {
          throw new Error('GIF exporter not available');
        }
        blob = await gifExporter.generateBlob();
        filename = `animation_${this.getTimestamp()}.gif`;

      } else if (format === 'apng') {
        const result = await this.exportManager.generatePreview('png');
        blob = result.blob;
        filename = `animation_${this.getTimestamp()}.png`;

      } else if (format === 'webp') {
        const webpExporter = this.exportManager.exporters.webp;
        if (!webpExporter || typeof webpExporter.generateBlob !== 'function') {
          throw new Error('WebP exporter not available');
        }
        blob = await webpExporter.generateBlob();
        filename = `animation_${this.getTimestamp()}.webp`;

      } else {
        throw new Error('Unsupported format: ' + format);
      }

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: format.toUpperCase() + ' file',
              accept: { ['image/' + format]: ['.' + format] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          this.setStatus('Saved: ' + filename);
        } catch (err) {
          if (err.name !== 'AbortError') {
            this.downloadBlob(blob, filename);
            this.setStatus('Downloaded: ' + filename);
          }
        }
      } else {
        this.downloadBlob(blob, filename);
        this.setStatus('Downloaded: ' + filename);
      }

    } catch (error) {
      this.setStatus('Error: ' + error.message);
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  setStatus(message) {
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
    }
  }

  show() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.isVisible = true;
      this.setStatus('Select format to export');
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}