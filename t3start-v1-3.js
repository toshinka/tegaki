// t3start-v1-3.js
// 掲示板ページ上に、としんか手書き-v1-3-rev4b.htmlをiframeとして埋め込み表示するスクリプト
(function(d){
  // 既に起動している場合は多重起動防止
  if (d.getElementById('toshinka-tegaki-iframe')) {
    alert('としんか手書きツールは既に開いています。');
    return;
  }
  // iframeの作成
const iframe = document.createElement('iframe');
iframe.src = 'https://toshinka.github.io/tegaki/v1-3/としんか手書き-v1-3-rev4b.html'; // ←絶対必要
iframe.id = 'toshinka-tegaki-iframe';
iframe.style.position = "fixed";
iframe.style.top = 0;
iframe.style.left = 0;
iframe.style.width = "100vw";
iframe.style.height = "100vh";
iframe.style.zIndex = "99999";
iframe.style.border = "none";
document.body.appendChild(iframe);

window.addEventListener("resize", () => {
  iframe.style.width = "100vw";
  iframe.style.height = "100vh";
});

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