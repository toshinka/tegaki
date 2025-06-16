// t3start-v1-3.js
// 掲示板ページ上に、としんか手書き-v1-3-rev4b.htmlをiframeとして埋め込み表示するスクリプト
(function(d){
  // 既に起動している場合は多重起動防止
  if (d.getElementById('toshinka-tegaki-iframe')) {
    alert('としんか手書きツールは既に開いています。');
    return;
  }
  // iframeの作成
  const iframe = d.createElement('iframe');
  iframe.id = 'toshinka-tegaki-iframe';
  iframe.src = 'https://tosinka.github.io/tegaki/v1-3/%E3%81%A8%E3%81%97%E3%82%93%E3%81%8B%E6%89%8B%E6%9B%B8%E3%81%8D-v1-3-rev4b.html';
  iframe.style.position = 'fixed';
  iframe.style.top = '40px';
  iframe.style.left = '50%';
  iframe.style.transform = 'translateX(-50%)';
  iframe.style.width = '700px';
  iframe.style.height = '520px';
  iframe.style.zIndex = '2147483647';
  iframe.style.background = 'white';
  iframe.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35)';
  iframe.style.border = '2px solid #666';
  iframe.allow = 'clipboard-read; clipboard-write';

  // 閉じるボタンの作成
  const closeBtn = d.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = '閉じる';
  closeBtn.style.position = 'fixed';
  closeBtn.style.top = '42px';
  closeBtn.style.left = 'calc(50% + 350px - 28px)';
  closeBtn.style.transform = 'translateX(-50%)';
  closeBtn.style.zIndex = '2147483648';
  closeBtn.style.fontSize = '20px';
  closeBtn.style.padding = '4px 10px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = '#fff';
  closeBtn.style.color = '#444';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.16)';
  closeBtn.style.borderRadius = '5px';

  closeBtn.onclick = function() {
    iframe.remove();
    closeBtn.remove();
  };

  d.body.appendChild(iframe);
  d.body.appendChild(closeBtn);
})(document);