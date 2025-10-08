// MebukiTest_vC.js
// Universal loader: try injection -> blob iframe -> popup
// Version: 2025-10-08 (MebukiTest_vC)
// Usage: bookmarklet should load this file and call globalThis.mebukiStartC()

(function(){
  if (globalThis.mebukiStartC) {
    try { globalThis.mebukiStartC(); } catch(e){ console.error(e); }
    return;
  }

  const TOOL_URL_ROOT = 'https://toshinka.github.io/tegaki/';
  const EXTERNAL_LOADER = TOOL_URL_ROOT + 'MebukiTest.js';
  const INJECTION_TIMEOUT = 1200;
  const MAX_INJECTION_RETRIES = 3;
  const POLL_INTERVAL = 80;

  let state = {
    injectedScript: null,
    iframe: null,
    closeBtn: null,
    blobUrl: null,
    injectionRetries: 0,
    observer: null
  };

  function log(...args){ try{ console.log('[MebukiC]', ...args); }catch(e){} }
  function warn(...args){ try{ console.warn('[MebukiC]', ...args); }catch(e){} }

  function cleanup() {
    if (state.iframe) try{ state.iframe.remove(); }catch(e){}
    state.iframe = null;
    if (state.closeBtn) try{ state.closeBtn.remove(); }catch(e){}
    state.closeBtn = null;
    if (state.blobUrl) try{ URL.revokeObjectURL(state.blobUrl); }catch(e){}
    state.blobUrl = null;
    if (state.injectedScript) {
      try{ state.injectedScript.remove(); }catch(e){}
      state.injectedScript = null;
    }
    document.body.style.overflow = '';
    if (state.observer) {
      try{ state.observer.disconnect(); }catch(e){}
      state.observer = null;
    }
  }

  async function tryInjection() {
    // prevent infinite loop
    if (state.injectionRetries >= MAX_INJECTION_RETRIES) {
      log('max injection retries reached');
      return false;
    }
    state.injectionRetries++;

    log('attempting external loader injection (#' + state.injectionRetries + ')');

    // create script element and insert
    try {
      const s = document.createElement('script');
      s.charset = 'UTF-8';
      s.src = EXTERNAL_LOADER + '?_=' + Date.now(); // cache-bust a bit
      s.async = true;
      s.dataset.mebuki = '1';
      document.body.appendChild(s);
      state.injectedScript = s;
    } catch (e) {
      warn('script insertion failed', e);
      return false;
    }

    // observe parent DOM for removal of this script (some sites auto-delete external scripts)
    let removedByHost = false;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.removedNodes) {
          if (node === state.injectedScript) {
            removedByHost = true;
            warn('injected script was removed by host page');
          }
        }
      }
    });
    try { mo.observe(document.documentElement || document.body, {childList:true, subtree:true}); state.observer = mo; } catch(e) { /* ignore */ }

    // poll for global function that external loader should define
    const start = Date.now();
    let resolved = false;
    while (Date.now() - start < INJECTION_TIMEOUT) {
      if (typeof globalThis.mebukiStart === 'function') {
        resolved = true;
        break;
      }
      // if host removed script, break early (so we can fallback quicker)
      if (removedByHost) break;
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    if (resolved) {
      log('external loader ready; calling mebukiStart()');
      try {
        await globalThis.mebukiStart();
        return true;
      } catch (e) {
        warn('calling external mebukiStart() failed', e);
        // fallthrough to fallback
      }
    } else {
      warn('external loader not ready or removed');
    }

    // cleanup injected script if it was put in place (we will try other methods)
    try { if (state.injectedScript) state.injectedScript.remove(); } catch(e){}
    state.injectedScript = null;
    if (state.observer) { try{ state.observer.disconnect(); }catch(e){} state.observer = null; }

    return false;
  }

  function createParentCloseButton(onclick) {
    const btn = document.createElement('button');
    btn.id = 'mebuki-universal-close';
    btn.innerText = '✕';
    btn.title = 'Close Mebuki';
    btn.style.cssText = [
      'position:fixed',
      'top:10px',
      'right:12px',
      'z-index:2147483648',
      'width:42px',
      'height:42px',
      'border-radius:21px',
      'border:none',
      'background:rgba(0,0,0,0.6)',
      'color:#fff',
      'font-size:20px',
      'cursor:pointer'
    ].join(' !important;') + ' !important;';
    btn.onclick = onclick;
    document.body.appendChild(btn);
    return btn;
  }

  function createBlobIframe() {
    const bootstrapHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#0b0b0b;color:#eee;font-family:system-ui,Arial}
  #top{height:46px;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#0a0a0a}
  #content{height:calc(100% - 46px);display:flex;flex-direction:column}
  #innerFrame{flex:1;border:0;width:100%;height:100%}
  .btn{display:inline-block;padding:8px 12px;background:#0078ff;border-radius:6px;color:#fff;text-decoration:none}
  .note{padding:14px;color:#ddd}
</style>
</head>
<body>
  <div id="top">
    <div>Mebuki (embedded)</div>
    <div><button id="close">✕</button></div>
  </div>
  <div id="content">
    <iframe id="innerFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>
    <div style="padding:10px;background:#070707">
      <div class="note">If the embedded tool fails, use the button: <a id="openBtn" class="btn" target="_blank" rel="noopener" href="${TOOL_URL_ROOT}">Open tool in new tab</a></div>
    </div>
  </div>

<script>
(function(){
  const inner = document.getElementById('innerFrame');
  const closeBtn = document.getElementById('close');
  closeBtn.addEventListener('click', ()=> { parent.postMessage({type:'mebuki-close-request'}, '*'); });

  // Try to load the tool in the inner iframe.
  // Some hosts allow blob-origin iframe to load external src; try it.
  try {
    inner.src = '${TOOL_URL_ROOT}';
  } catch(e){
    console.warn('Setting inner.src failed', e);
  }

  // Fallback: attempt to fetch index.html and write it into inner iframe via srcdoc (may fail due to CORS).
  (async function(){
    try {
      const res = await fetch('${TOOL_URL_ROOT}', {mode:'cors'});
      if (res.ok) {
        const html = await res.text();
        inner.srcdoc = html;
      }
    } catch(e) {
      console.warn('fetch index failed inside blob iframe', e);
    }
  })();
})();
</script>
</body>
</html>`.trim();

    const blob = new Blob([bootstrapHtml], {type:'text/html'});
    const blobUrl = URL.createObjectURL(blob);
    state.blobUrl = blobUrl;

    const iframe = document.createElement('iframe');
    iframe.id = 'mebuki-blob-iframe';
    iframe.src = blobUrl;
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border:0;margin:0;padding:0;z-index:2147483647;background:transparent;';
    document.body.appendChild(iframe);
    state.iframe = iframe;

    // parent close button
    state.closeBtn = createParentCloseButton(() => { cleanup(); });

    // listen to messages from inside blob iframe
    function onMsg(e){
      if (!e.data) return;
      if (e.data.type === 'mebuki-close-request') {
        cleanup();
        window.removeEventListener('message', onMsg);
      }
    }
    window.addEventListener('message', onMsg);

    document.body.style.overflow = 'hidden';
    log('blob iframe created (url):', blobUrl);
    return true;
  }

  function openPopup() {
    try {
      const w = window.open(TOOL_URL_ROOT, '_blank', 'noopener');
      if (!w) {
        alert('Popup blocked. Please allow popups or click this link:\n' + TOOL_URL_ROOT);
      }
      return true;
    } catch(e) {
      warn('Popup open failed', e);
      try { alert('Could not open tool. Visit: ' + TOOL_URL_ROOT); } catch(e){}
      return false;
    }
  }

  // Main exported function
  globalThis.mebukiStartC = async function() {
    // toggle: if UI present close it
    if (state.iframe) { cleanup(); return; }

    // 1) try injection (with automatic retry on removal)
    let ok = await tryInjection();
    if (ok) return;

    // If external injection was removed quickly by host, try one more time before blob
    if (state.injectionRetries < MAX_INJECTION_RETRIES) {
      log('retrying injection once more before blob');
      ok = await tryInjection();
      if (ok) return;
    }

    // 2) blob fallback
    try {
      const b = await createBlobIframe();
      if (b) return;
    } catch(e) {
      warn('blob creation threw', e);
    }

    // 3) final fallback open in new tab/window
    openPopup();
  };

  // alias for compatibility with earlier code expecting mebukiStart
  globalThis.mebukiStart = function(){ return globalThis.mebukiStartC(); };

  log('MebukiTest_vC installed: mebukiStartC / mebukiStart ready');
})();
