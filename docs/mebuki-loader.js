/**
 * MebukiMode - めぶき/ふたばモード制御
 * ブックマークレット起動時の専用機能
 */
class MebukiMode {
    constructor(app) {
        this.app = app;
        this.sproutButton = null;
        this.isEnabled = false;
    }

    init() {
        const params = new URLSearchParams(window.location.search);
        this.isEnabled = params.get('mode') === 'mebuki';
        
        if (this.isEnabled) {
            this.createSproutButton();
        }
    }

    createSproutButton() {
        this.sproutButton = document.createElement('button');
        this.sproutButton.id = 'mebuki-sprout-btn';
        this.sproutButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/>
                <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/>
                <path d="M5 21h14"/>
            </svg>
        `;
        this.sproutButton.title = 'めぶきに投稿（保存→コピー）';
        this.sproutButton.style.cssText = `
            position: fixed;
            top: 16px;
            right: 60px;
            width: 48px;
            height: 48px;
            background: rgba(255, 245, 230, 0.95);
            border: 2px solid #800000;
            border-radius: 50%;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s;
        `;
        
        this.sproutButton.onmouseenter = () => {
            this.sproutButton.style.transform = 'scale(1.1)';
        };
        
        this.sproutButton.onmouseleave = () => {
            this.sproutButton.style.transform = 'scale(1)';
        };
        
        this.sproutButton.onclick = async () => {
            await this.exportToMebuki();
        };
        
        document.body.appendChild(this.sproutButton);
    }

    async exportToMebuki() {
        const btn = this.sproutButton;
        const originalHTML = btn.innerHTML;
        
        try {
            btn.innerHTML = '⏳';
            btn.style.pointerEvents = 'none';
            
            const format = 'apng';
            let blob;
            
            if (format === 'apng') {
                blob = await this.app.exportManager.exportAPNG();
            } else {
                blob = await this.app.exportManager.exportGIF();
            }
            
            const thumbnail = await this.generateThumbnail();
            
            const metadata = {
                format: format,
                width: this.app.stateManager.state.canvasWidth,
                height: this.app.stateManager.state.canvasHeight,
                frames: this.app.animationSystem.totalFrames,
                thumbnail: thumbnail
            };
            
            const id = await window.virtualAlbum.saveAnimation(blob, metadata);
            
            await window.virtualAlbum.copyToClipboard(id);
            
            btn.innerHTML = '✓';
            btn.style.background = 'rgba(144, 238, 144, 0.95)';
            
            alert('めぶきアルバムに保存し、クリップボードにコピーしました！\n掲示板でCtrl+Vしてください。');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = 'rgba(255, 245, 230, 0.95)';
                btn.style.pointerEvents = 'auto';
            }, 2000);
            
        } catch (err) {
            btn.innerHTML = '✕';
            btn.style.background = 'rgba(255, 100, 100, 0.95)';
            alert('エクスポート失敗: ' + err.message);
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = 'rgba(255, 245, 230, 0.95)';
                btn.style.pointerEvents = 'auto';
            }, 2000);
        }
    }

    async generateThumbnail() {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        const width = this.app.stateManager.state.canvasWidth;
        const height = this.app.stateManager.state.canvasHeight;
        const scale = Math.min(maxSize / width, maxSize / height);
        
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        
        const renderer = this.app.pixiApp.renderer;
        const stage = this.app.pixiApp.stage;
        
        const tempCanvas = renderer.extract.canvas(stage);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    }
}