/**
 * AlbumPopup - アルバムUI管理
 * 仮想アルバムの表示・操作インターフェース
 */
class AlbumPopup {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.container = null;
        this.isVisible = false;
    }

    create() {
        this.container = document.createElement('div');
        this.container.id = 'album-popup';
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-width: 90vw;
            max-height: 80vh;
            background: #f5e6e0;
            border: 2px solid #800000;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            display: none;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '📁 仮想アルバム';
        title.style.cssText = 'margin: 0; color: #800000; font-size: 18px;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #800000;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            line-height: 32px;
        `;
        closeBtn.onclick = () => this.hide();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const grid = document.createElement('div');
        grid.id = 'album-grid';
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
        `;
        
        this.container.appendChild(header);
        this.container.appendChild(grid);
        document.body.appendChild(this.container);
    }

    async show() {
        if (!this.container) this.create();
        
        this.container.style.display = 'block';
        this.isVisible = true;
        
        await this.refresh();
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }

    async refresh() {
        const grid = document.getElementById('album-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const items = await window.virtualAlbum.getAllAnimations();
        
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = `
                grid-column: 1/-1;
                text-align: center;
                padding: 40px;
                color: #800000;
            `;
            empty.textContent = 'アルバムは空です';
            grid.appendChild(empty);
            return;
        }
        
        items.forEach(item => {
            const card = this.createCard(item);
            grid.appendChild(card);
        });
    }

    createCard(item) {
        const card = document.createElement('div');
        card.style.cssText = `
            background: #ede0d8;
            border: 1px solid #c0a090;
            border-radius: 4px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            width: 100%;
            aspect-ratio: 4/3;
            background: #d0c0b0;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
            thumb.appendChild(img);
        } else {
            thumb.textContent = 'No Preview';
            thumb.style.color = '#800000';
        }
        
        thumb.onclick = () => this.loadAnimation(item);
        
        const info = document.createElement('div');
        info.style.cssText = 'font-size: 11px; color: #800000; line-height: 1.4;';
        const date = new Date(item.timestamp);
        info.innerHTML = `
            <strong>${item.format.toUpperCase()}</strong> | ${item.width}×${item.height} | ${item.frames}f<br>
            ${date.toLocaleDateString('ja-JP')} ${date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}
        `;
        
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px;';
        
        const downloadBtn = this.createIconButton('⬇', 'ダウンロード', async () => {
            const url = URL.createObjectURL(item.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation-${item.id}.${item.format}`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        const copyBtn = this.createIconButton('📋', 'コピー', async () => {
            try {
                await window.virtualAlbum.copyToClipboard(item.id);
                copyBtn.textContent = '✓';
                copyBtn.style.background = '#90c090';
                setTimeout(() => {
                    copyBtn.textContent = '📋';
                    copyBtn.style.background = '#c0a090';
                }, 1000);
            } catch (err) {
                alert('コピー失敗: ' + err.message);
            }
        });
        
        const deleteBtn = this.createIconButton('🗑', '削除', async () => {
            if (confirm('削除しますか？')) {
                await window.virtualAlbum.deleteAnimation(item.id);
                await this.refresh();
            }
        });
        
        buttons.appendChild(downloadBtn);
        buttons.appendChild(copyBtn);
        buttons.appendChild(deleteBtn);
        
        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(buttons);
        
        return card;
    }

    createIconButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        btn.textContent = icon;
        btn.title = tooltip;
        btn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #c0a090;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s;
        `;
        btn.onmouseenter = () => btn.style.background = '#b09080';
        btn.onmouseleave = () => btn.style.background = '#c0a090';
        btn.onclick = onClick;
        return btn;
    }

    loadAnimation(item) {
        alert('アニメーション読み込み機能は未実装です\n（将来的にレイヤーに展開予定）');
    }
}