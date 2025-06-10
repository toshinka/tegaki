(function(){
  // ボタン追加
  const toolbar = document.getElementById("toolbar");
  if(!toolbar){
    alert("ツールバーが見つからんで！");
    return;
  }

  const futabaBtn = document.createElement("button");
  futabaBtn.textContent = "🌱";  // 双葉マーク
  futabaBtn.title = "ふたばのコメント欄に転写するで！";
  futabaBtn.style.fontSize = "18px";
  futabaBtn.style.marginLeft = "5px";

  futabaBtn.onclick = function(){
    const canvas = document.getElementById("oejs");
    if (!canvas) {
      alert("手書きキャンバスが見つからん！");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const textarea = document.getElementById("ftxa");
    if (!textarea) {
      alert("コメント欄が無いで！");
      return;
    }
    textarea.value = dataUrl;
    alert("転写完了や！");
  };

  toolbar.appendChild(futabaBtn);
})();
