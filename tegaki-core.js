(function(global){
  'use strict';

  // 名前空間初期化
  if(!global.toshinka){
    global.toshinka = {};
    console.log("二次裏用手書きブックマークレット起動！");
  }

  const T = global.toshinka;

  /*
   * ユーティリティ
   */
  T.$ = function(id){
    return typeof id === 'string' ? document.getElementById(id) : id;
  };

  T.$qs = function(selector, node){
    return (T.$(node) || document).querySelector(selector);
  };

  T.$qsa = function(selector, node){
    return (T.$(node) || document).querySelectorAll(selector);
  };

  T.empty = function(node){
    node = T.$(node);
    if (!node) return;
    const r = document.createRange();
    r.selectNodeContents(node);
    r.deleteContents();
  };

  // パレットもtoshinka名前空間内で管理
  if(!T.palette){
    T.palette = ['#FFFCE5','#A42C2C','#D28F8F','#EBC4B4','#F7E8D5','#FFFFFF','#FF9C4A','#77BB77'];
  }

  /*
   * 双葉転写ボタン
   */
  const canvas = T.$("oejs");
  if (!canvas) {
    alert("手書きキャンバスが見つかりません！先に手書きモードを開いてや！");
    return;
  }

  // 仮ツールバー div 作成
  let toolbar = T.$("tegakiToolbar");
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

  // 双葉ボタン
  const futabaBtn = document.createElement("button");
  futabaBtn.textContent = "🌱";
  futabaBtn.title = "ふたばコメント欄に転写";
  futabaBtn.style.fontSize = "18px";
  futabaBtn.style.margin = "2px";

  futabaBtn.onclick = function(){
    const dataUrl = canvas.toDataURL("image/png");
    const textArea = T.$("ftxa");
    if (!textArea) {
      alert("コメント欄が見つからんで！");
      return;
    }
    textArea.value = dataUrl;
    alert("転写完了や！");
  };

  toolbar.appendChild(futabaBtn);

})(window);
