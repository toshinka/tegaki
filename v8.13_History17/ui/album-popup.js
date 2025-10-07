/**
 * AlbumPopup - 仮想アルバムUI管理 (改良版)
 * GIFクリップボード制限の説明と代替手段の提供
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
            width: 700px;
            max-width: 90vw;
            max-height: 80vh;
            background: #f0e0d6;
            border: 2px solid #800000;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            display: none;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '📁 仮想アルバム';
        title.style.cssText = 'margin: 0; color: #800000; font-size: 18px; font-weight: 600;';
        
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
            border-radius: 4px;
            transition: background 0.2s;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = '#e0d0c6';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'none';
        closeBtn.onclick = () => this.hide();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const info = document.createElement('div');
        info.style.cssText = `
            background: #ffffee;
            border: 1px solid #d0c0b0;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #5d4037;
            line-height: 1.5;
        `;
        info.innerHTML = `
            <strong>⚠️ クリップボード制限について</strong><br>
            ブラウザの仕様上、GIF動画をクリップボード経由で貼り付けると<strong>最初のフレームのみ</strong>が貼り付けられます。<br>
            <strong>推奨：</strong> ⬇ダウンロードボタンでファイル保存し、外部アプリで使用してください。
        `;
        
        const grid = document.createElement('div');
        grid.id = 'album-grid';
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        `;
        
        this.container.appendChild(header);
        this.container.appendChild(info);
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
                padding: 60px 20px;
                color: #800000;
                font-size: 14px;
            `;
            empty.innerHTML = `
                アルバムは空です<br>
                <span style="font-size: 12px; color: #5d4037; margin-top: 8px; display: inline-block;">
                    エクスポートしたアニメーションがここに保存されます
                </span>
            `;
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
            background: #ffffee;
            border: 1px solid #d0c0b0;
            border-radius: 6px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: border-color 0.2s;
        `;
        card.onmouseenter = () => card.style.borderColor = '#b09080';
        card.onmouseleave = () => card.style.borderColor = '#d0c0b0';
        
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            width: 100%;
            aspect-ratio: 4/3;
            background: #e8dcd0;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid #d0c0b0;
        `;
        
        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
            thumb.appendChild(img);
        } else {
            thumb.innerHTML = `<span style="color: #800000; font-size: 12px;">No Preview</span>`;
        }
        
        thumb.onclick = () => this.previewAnimation(item);
        
        const info = document.createElement('div');
        info.style.cssText = 'font-size: 11px; color: #5d4037; line-height: 1.6;';
        const date = new Date(item.timestamp);
        const formatBadge = item.format === 'gif' ? 
            '<span style="background: #90c090; color: #fff; padding: 1px 6px; border-radius: 3px; font-weight: 600;">GIF</span>' :
            '<span style="background: #c09090; color: #fff; padding: 1px 6px; border-radius: 3px; font-weight: 600;">APNG</span>';
        
        info.innerHTML = `
            ${formatBadge} <strong>${item.width}×${item.height}</strong> | ${item.frames}フレーム<br>
            ${date.toLocaleDateString('ja-JP')} ${date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}
        `;
        
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px;';
        
        const downloadBtn = this.createButton('⬇ DL', 'ダウンロード（推奨）', '#800000', async () => {
            const url = URL.createObjectURL(item.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation-${Date.now()}.${item.format}`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        const copyBtn = this.createButton('📋 コピー', 'クリップボードへ（静止画化）', '#5d4037', async () => {
            try {
                await window.virtualAlbum.copyToClipboard(item.id);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ 完了';
                copyBtn.style.background = '#90c090';
                copyBtn.style.color = '#fff';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = '#d0c0b0';
                    copyBtn.style.color = '#5d4037';
                }, 1500);
            } catch (err) {
                alert('コピー失敗: ' + err.message);
            }
        });
        
        const deleteBtn = this.createButton('🗑', '削除', '#a04040', async () => {
            if (confirm('このアニメーションを削除しますか？')) {
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

    createButton(label, tooltip, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.title = tooltip;
        btn.style.cssText = `
            flex: 1;
            padding: 8px 10px;
            background: #d0c0b0;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            color: ${color};
            transition: all 0.2s;
            white-space: nowrap;
        `;
        btn.onmouseenter = () => {
            btn.style.background = '#c0b0a0';
            btn.style.transform = 'translateY(-1px)';
        };
        btn.onmouseleave = () => {
            btn.style.background = '#d0c0b0';
            btn.style.transform = 'translateY(0)';
        };
        btn.onclick = onClick;
        return btn;
    }

    previewAnimation(item) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 20000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(item.blob);
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;
        
        modal.onclick = () => {
            URL.revokeObjectURL(img.src);
            modal.remove();
        };
        
        modal.appendChild(img);
        document.body.appendChild(modal);
    }
}

console.log('✅ AlbumPopup (改良版) loaded');