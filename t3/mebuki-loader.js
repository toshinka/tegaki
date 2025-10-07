javascript:void((d) => {
    // ツールURL。別タブでこのURLを開きます。
    const toolUrl = 'https://toshinka.github.io/tegaki/';
    
    // 【重要】別タブを開く
    // _blank は新しいウィンドウ/タブで開くことを指示します。
    // 'mebuki_tegaki' はウィンドウ名。同じウィンドウ名を使うと、既に開いているタブを再利用します。
    const newTab = window.open(toolUrl, 'mebuki_tegaki');

    // 新しいタブがブロックされた場合の処理
    if (newTab) {
        // 新しいタブにフォーカスを当てる
        newTab.focus();
        
        // 既存のiframeが存在すれば削除 (念のため、干渉防止)
        const existingIframe = d.getElementById('mebuki-tegaki-overlay');
        if (existingIframe) {
            existingIframe.remove();
        }

        // 別タブ方式では、掲示板側でメッセージハンドラを待つ必要はなくなります。
        // ツールを閉じる/エクスポートする機能は、開いたツール側（別タブ）で完結させる必要があります。
        
    } else {
        // ポップアップブロッカーなどでブロックされた場合
        alert('お絵かきツールの新しいタブが開けませんでした。\nブラウザのポップアップブロッカーを確認してください。');
    }
    
})(document);