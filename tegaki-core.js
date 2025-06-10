(function(){
  if(!window.tegakiTool){
    window.tegakiTool = {}; // 名前空間初期化
    console.log("二次裏用手書きブックマークレット起動！");

    // パレット定義
    window.tegakiTool.palette = ['#FFFCE5','#A42C2C','#D28F8F','#EBC4B4','#F7E8D5','#FFFFFF','#FF9C4A','#77BB77'];

    // 手描きキャンバス確認
    const canvas = document.getElementById("oejs");
    if (!canvas) {
      alert("手書きキャンバスが見つかりません！先に手書きモードを開いてや！");
      return;
    }

    // コメント欄確認
    const textarea = document.getElementById("ftxa");
    if (!textarea) {
      console.warn("コメント欄がまだ無いっぽいで！");
    }

    // 仮ツールバー用のdiv作成
    let toolbar = document.getElementById("tegakiToolbar");
    if(!toolbar){
      toolbar = document.createElement("div");
      toolbar.id = "tegakiToolbar";
      toolbar.style.position = "absolute";
      toolbar.style.top = "5px";
      toolbar.style.right = "5px";
      toolbar.style.zIndex = "9999";
      toolbar.style.background = "rgba(255,255,255,0.8)";
      toolbar.style.padding = "5px";
      toolbar.style.border = "1px solid #ccc";
      document.body.appendChild(toolbar);
    }

    // 双葉ボタン追加
    const futabaBtn = document.createElement("button");
    futabaBtn.textContent = "🌱";
    futabaBtn.title = "ふたばコメント欄に転写";
    futabaBtn.style.fontSize = "18px";
    futabaBtn.style.margin = "2px";

    futabaBtn.onclick = function(){
      const dataUrl = canvas.toDataURL("image/png");
      const textArea = document.getElementById("ftxa");
      if (!textArea) {
        alert("コメント欄が見つからんで！");
        return;
      }
      textArea.value = dataUrl;
      alert("転写完了や！");
    };

    toolbar.appendChild(futabaBtn);

  } else {
    console.log("tegakiTool 既に読み込み済み！");
  }
})();
