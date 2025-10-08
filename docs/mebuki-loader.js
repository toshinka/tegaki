(function(){
  if(globalThis.mebukiStart){
    globalThis.mebukiStart();
    return;
  }

  globalThis.mebukiStart = function(){
    // PixiJS アプリの canvas を直接 overlay に生成
    const overlay = document.createElement('div');
    overlay.id = 'tegaki-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '999999';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    document.body.appendChild(overlay);

    const canvas = document.createElement('canvas');
    canvas.id = 'tegaki-canvas';
    canvas.style.width = '80%';
    canvas.style.height = '80%';
    canvas.style.margin = '5% auto';
    canvas.style.display = 'block';
    overlay.appendChild(canvas);

    // TODO: PixiJS 初期化して canvas に描画
    const app = new PIXI.Application({ view: canvas, width:800, height:600 });

    // 完了ボタン
    const btn = document.createElement('button');
    btn.textContent = "完了して添付";
    btn.style.position = 'absolute';
    btn.style.bottom = '20px';
    btn.style.left = '50%';
    btn.style.transform = 'translateX(-50%)';
    overlay.appendChild(btn);

    btn.onclick = function(){
      app.view.toBlob(blob => {
        const file = new File([blob], "tegaki.png", { type:"image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);

        detectFileInput().then(input => {
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles:true }));
          overlay.remove();
          app.destroy(true);
        });
      });
    };
  };

  function detectFileInput(){
    let input = document.querySelector('input[type=file][accept*="image/png"]');
    if(input) return Promise.resolve(input);
    const btn = document.querySelector('.dt_r_status-button');
    if(btn) btn.click();
    return new Promise((resolve,reject)=>{
      const obs = new MutationObserver(()=>{
        input = document.querySelector('input[type=file][accept*="image/png"]');
        if(input){
          obs.disconnect();
          resolve(input);
        }
      });
      obs.observe(document.body,{childList:true,subtree:true});
      setTimeout(()=>{obs.disconnect();reject("input not found");},5000);
    });
  }
})();
