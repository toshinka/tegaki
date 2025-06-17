// TopBarManager-v1-3-rev3.js
// 全消去ボタンを動的に追加し、イベントを設定。
class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.canvasManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.canvasManager.redo());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());

        // --- 全消去機能の追加 ---
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.title = 'アクティブレイヤーを消去 (Delete)';
            // 既存のイベントリスナーはToshinkaTegakiTool側で設定されている可能性があるため、ここでは追加しない
            // → v1-3-rev1のHTML/JS構成ではTopBarManagerで設定されていたので、ここで設定する
             clearBtn.addEventListener('click', () => this.app.canvasManager.clearCanvas());

            // 新しい全消去ボタンを動的に作成
            const clearAllBtn = document.createElement('button');
            clearAllBtn.id = 'clear-all-btn';
            // アイコンがボタンからはみ出ないようにstyleを調整
            clearAllBtn.style.fontSize = "16px"; 
            clearAllBtn.style.padding = "0 4px";
            clearAllBtn.className = 'tool-btn'; // 既存のボタンと同じクラスを適用
            clearAllBtn.innerHTML = '🗑️*';      // 仮のアイコン
            clearAllBtn.title = '全レイヤーを消去 (Shift+Delete)';
            
            // 既存のクリアボタンの直後に挿入
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            
            // イベントリスナーを設定
            clearAllBtn.addEventListener('click', () => {
                // 破壊的な操作なので確認ダイアログを挟む
                if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) {
                     this.app.canvasManager.clearAllLayers();
                }
            });
        }
        // --- ここまで ---

        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }

    closeTool() {
        if (confirm('ウィンドウを閉じますか？')) {
            window.close();
        }
    }
}
