/**
 * めぶき/ふたば用ブックマークレット
 * お絵かきツールを別タブで起動し、めぶきモードを有効化
 */
javascript:void(((d) => {
    const toolUrl = 'https://toshinka.github.io/tegaki/?mode=mebuki';
    
    const toolTab = window.open(toolUrl, 'mebuki_tegaki');
    
    if (!toolTab) {
        alert('ポップアップがブロックされました。\nブラウザ設定を確認してください。');
        return;
    }
    
    toolTab.focus();
    
    const notice = d.createElement('div');
    notice.id = 'mebuki-notice';
    notice.textContent = '🌱 お絵かきツールを起動しました';
    notice.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        background: rgba(144, 238, 144, 0.95);
        color: #2d5016;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 999999;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    
    const style = d.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    d.head.appendChild(style);
    
    d.body.appendChild(notice);
    
    setTimeout(() => {
        notice.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notice.remove(), 300);
    }, 3000);
    
})(document));