// ==================================================
// system/quick-export-ui.js
// クイックエクスポートUI - File System Access API対応
// ==================================================
window.QuickExportUI = (function() {
    'use strict';
    
    class QuickExportUI {
        constructor() {
            this.exportManager = null;
            this.button = null;
            this.popup = null;
            this.lastSaveHandles = {};
            
            this.initWhenReady();
        }
        
        initWhenReady() {
            const checkInterval = setInterval(() => {
                if (window.exportManager) {
                    clearInterval(checkInterval);
                    this.exportManager = window.exportManager;
                    this.createButton();
                    this.setupMessageBridge();
                }
            }, 100);
            
            setTimeout(() => clearInterval(checkInterval), 10000);
        }
        
        createButton() {
            this.button = document.createElement('button');
            this.button.id = 'quick-export-btn';
            this.button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
                     fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" 
                     stroke-linejoin="round">
                    <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/>
                    <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/>
                    <path d="M5 21h14"/>
                </svg>
            `;
            this.button.title = 'Quick Export (Ctrl+E)';
            
            Object.assign(this.button.style, {
                position: 'fixed',
                top: '10px',
                right: '10px',
                width: '44px',
                height: '44px',
                border: 'none',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: '10000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                padding: '0'
            });
            
            this.button.onmouseenter = () => {
                this.button.style.background = 'rgba(255,255,255,1)';
                this.button.style.transform = 'scale(1.05)';
                this.button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            };
            
            this.button.onmouseleave = () => {
                this.button.style.background = 'rgba(255,255,255,0.9)';
                this.button.style.transform = 'scale(1)';
                this.button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            };
            
            this.button.onclick = () => this.togglePopup();
            
            document.body.appendChild(this.button);
            
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'e') {
                    e.preventDefault();
                    this.togglePopup();
                }
            });
        }
        
        togglePopup() {
            if (this.popup && document.body.contains(this.popup)) {
                this.closePopup();
            } else {
                this.showPopup();
            }
        }
        
        showPopup() {
            this.closePopup();
            
            this.popup = document.createElement('div');
            this.popup.id = 'quick-export-popup';
            
            Object.assign(this.popup.style, {
                position: 'fixed',
                top: '60px',
                right: '10px',
                width: '280px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                padding: '16px',
                zIndex: '10001',
                fontFamily: 'sans-serif',
                fontSize: '14px'
            });
            
            this.popup.innerHTML = `
                <div style="font-weight:bold;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                    <span style="font-size:18px;">📤</span>
                    <span>Quick Export</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
                    <button id="qe-apng" style="padding:10px;border:1px solid #4a9eff;border-radius:4px;cursor:pointer;background:#f0f8ff;font-weight:500;text-align:left;">
                        <div style="font-size:13px;color:#333;">APNG</div>
                        <div style="font-size:11px;color:#666;margin-top:2px;">ふたば☆推奨</div>
                    </button>
                    <button id="qe-webp" style="padding:10px;border:1px solid #ff9a4a;border-radius:4px;cursor:pointer;background:#fff8f0;font-weight:500;text-align:left;">
                        <div style="font-size:13px;color:#333;">WebP</div>
                        <div style="font-size:11px;color:#666;margin-top:2px;">軽量・高品質</div>
                    </button>
                    <button id="qe-gif" style="padding:10px;border:1px solid #999;border-radius:4px;cursor:pointer;background:#f0f0f0;font-weight:500;text-align:left;">
                        <div style="font-size:13px;color:#333;">GIF</div>
                        <div style="font-size:11px;color:#666;margin-top:2px;">互換用</div>
                    </button>
                </div>
                <div style="padding-top:12px;border-top:1px solid #eee;">
                    <button id="qe-close" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#ffe4e4;font-size:13px;">
                        🗙 Close Window
                    </button>
                </div>
                <div id="qe-status" style="margin-top:8px;font-size:12px;color:#666;min-height:20px;text-align:center;"></div>
            `;
            
            document.body.appendChild(this.popup);
            
            this.popup.querySelector('#qe-apng').onclick = () => this.handleExport('apng');
            this.popup.querySelector('#qe-webp').onclick = () => this.handleExport('webp');
            this.popup.querySelector('#qe-gif').onclick = () => this.handleExport('gif');
            this.popup.querySelector('#qe-close').onclick = () => this.closeWindow();
            
            setTimeout(() => {
                const handleOutsideClick = (e) => {
                    if (this.popup && 
                        !this.popup.contains(e.target) && 
                        e.target !== this.button &&
                        !this.button.contains(e.target)) {
                        this.closePopup();
                        document.removeEventListener('click', handleOutsideClick);
                    }
                };
                document.addEventListener('click', handleOutsideClick);
            }, 100);
        }
        
        closePopup() {
            if (this.popup && document.body.contains(this.popup)) {
                this.popup.remove();
                this.popup = null;
            }
        }
        
        async handleExport(format) {
            const status = this.popup?.querySelector('#qe-status');
            if (!status) return;
            
            status.textContent = '⏳ Exporting...';
            status.style.color = '#666';
            
            try {
                let blob, filename;
                
                switch(format) {
                    case 'gif':
                        const gifExporter = this.exportManager.exporters.gif;
                        if (!gifExporter) throw new Error('GIF exporter not available');
                        blob = await gifExporter.generateBlob();
                        filename = `animation_${this.getTimestamp()}.gif`;
                        break;
                        
                    case 'apng':
                        const apngExporter = this.exportManager.exporters.apng;
                        if (!apngExporter) throw new Error('APNG exporter not available');
                        blob = await apngExporter.generateBlob();
                        filename = `animation_${this.getTimestamp()}.png`;
                        break;
                        
                    case 'webp':
                        const webpExporter = this.exportManager.exporters.webp;
                        if (!webpExporter) throw new Error('WebP exporter not available');
                        blob = await webpExporter.generateBlob();
                        filename = `animation_${this.getTimestamp()}.webp`;
                        break;
                        
                    default:
                        throw new Error(`Unknown format: ${format}`);
                }
                
                const saved = await this.saveWithFileSystemAPI(blob, filename, format);
                
                if (saved) {
                    status.textContent = `✅ Saved: ${filename}`;
                    status.style.color = '#28a745';
                    setTimeout(() => this.closePopup(), 1500);
                } else {
                    status.textContent = `⬇️ Downloaded: ${filename}`;
                    status.style.color = '#007bff';
                    setTimeout(() => this.closePopup(), 2000);
                }
                
            } catch (error) {
                status.textContent = `❌ ${error.message}`;
                status.style.color = '#dc3545';
            }
        }
        
        async saveWithFileSystemAPI(blob, filename, format) {
            if (!window.showSaveFilePicker) {
                this.downloadFile(blob, filename);
                return false;
            }
            
            try {
                let handle = this.lastSaveHandles[format];
                
                if (!handle) {
                    handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: `${format.toUpperCase()} Animation`,
                            accept: { 
                                [`image/${format === 'apng' ? 'png' : format}`]: [`.${format === 'apng' ? 'png' : format}`] 
                            }
                        }]
                    });
                    
                    this.lastSaveHandles[format] = handle;
                }
                
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                return true;
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Cancelled');
                }
                
                this.downloadFile(blob, filename);
                return false;
            }
        }
        
        downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        
        closeWindow() {
            if (window.opener) {
                window.close();
            } else {
                const status = this.popup?.querySelector('#qe-status');
                if (status) {
                    status.textContent = '⚠️ Please close manually';
                    status.style.color = '#ff9800';
                }
            }
        }
        
        getTimestamp() {
            return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        }
        
        setupMessageBridge() {
            window.addEventListener('message', (event) => {
                if (event.data.type === 'request-quick-export') {
                    this.showPopup();
                }
            });
            
            if (window.opener) {
                window.opener.postMessage({ 
                    type: 'tegaki-ready',
                    features: ['quick-export', 'file-system-api']
                }, '*');
            }
        }
    }
    
    return QuickExportUI;
})();

window.addEventListener('DOMContentLoaded', () => {
    window.quickExportUI = new window.QuickExportUI();
});

console.log('✅ quick-export-ui.js loaded');