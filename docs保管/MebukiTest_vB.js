// MebukiTest_vB.js
// Blob/srcdoc fallback loader for Tegaki (Mebuki)
// Strategy:
// 1) Try to inject external loader script (Canvas98-style)
// 2) If not successful within TIMEOUT_MS, create a Blob-based iframe whose HTML
//    contains a small bootstrap that loads the tool inside the blob iframe.
// 3) If that is blocked too, fallback to window.open().

(function(){
  if (globalThis.mebukiStartVb) {
    // Already installed: call to toggle/open
    try { globalThis.mebukiStartVb(); } catch(e){ console.error(e); }
    return;
  }

  // Configuration
  const TOOL_URL_ROOT = 'https://toshinka.github.io/tegaki/'; // tool root (index.html)
  const EXTERNAL_LOADER = TOOL_URL_ROOT + 'MebukiTest.js';    // prefer existing loader
  const ATTEMPT_TIMEOUT_MS = 1200; // wait time to decide injection failed

  // State
  let _current = {
    iframe: null,
    closeBtn: null,
    blobUrl: null,
    injectedScript: null
  };

  // Helper: clean close
  function _cleanup() {
    if (_current.iframe) {
      try { _current.iframe.remove(); } catch(e) {}
      _current.iframe = null;
    }
    if (_current.closeBtn) {
      try { _current.closeBtn.remove(); } catch(e) {}
      _current.closeBtn = null;
    }
    if (_current.blobUrl) {
      try { URL.revokeObjectURL(_current.blobUrl); } catch(e) {}
      _current.blobUrl = null;
    }
    document.body.style.overflow = '';
  }

  // Toggle/open function exposed to user
  globalThis.mebukiStartVb = async function() {
    // If iframe exists, close it (toggle)
    if (_current.iframe) {
      _cleanup();
      return;
    }

    // 1) Try simple script injection (canvas98 style)
    let injected = false;
    try {
      const s = document.createElement('script');
      s.charset = 'UTF-8';
      s.src = EXTERNAL_LOADER;
      s.async = true;
      // set an attribute so we can find/remove it later if needed
      s.dataset.mebuki = 'injected';
      document.body.appendChild(s);
      _current.injectedScript = s;
      // Wait a short time to see if globalThis.mebukiStart appears
      injected = await new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (!done) { done = true; resolve(false); }
        }, ATTEMPT_TIMEOUT_MS);
        // Poll for the initialization function defined by external loader
        const poll = () => {
          if (globalThis.mebukiStart && typeof globalThis.mebukiStart === 'function') {
            if (!done) { done = true; clearTimeout(t); resolve(true); }
          } else {
            if (!done) setTimeout(poll, 80);
          }
        };
        poll();
      });
    } catch(e) {
      console.warn('[MebukiVb] script injection failed:', e);
      injected = false;
    }

    if (injected) {
      try {
        // if external loader exists, call it (it should create its own iframe or UI)
        globalThis.mebukiStart();
        return;
      } catch(e) {
        console.warn('[MebukiVb] calling injected loader failed:', e);
        // fallthrough to blob
      }
    }

    // 2) Blob-based iframe fallback
    try {
      // Minimal bootstrap HTML that will try to load the real tool (index) inside the blob iframe
      // Note: inline code is used; we attempt to load index.html into an inner iframe if possible,
      // otherwise we bring up a basic instruction UI and a link to open the tool in a new tab.
      const bootstrapHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#111;color:#eee;font-family:system-ui,Arial;}
  #wrap{height:100%;display:flex;flex-direction:column}
  #topbar{height:44px;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#0b0b0b;box-shadow:0 2px 8px rgba(0,0,0,0.6);}
  #content{flex:1;display:flex;align-items:center;justify-content:center;padding:12px}
  a.button{display:inline-block;padding:10px 14px;background:#0b84ff;color:white;border-radius:6px;text-decoration:none}
  #innerFrame{width:100%;height:100%;border:0;display:block}
  #msg{max-width:70ch;line-height:1.4}
</style>
</head>
<body>
  <div id="wrap">
    <div id="topbar">
      <div>MEBUKI TOOL (embedded)</div>
      <div><button id="close" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button></div>
    </div>
    <div id="content">
      <div id="msg">
        <div style="margin-bottom:12px">Trying to load tool...</div>
        <iframe id="innerFrame" sandbox="allow-scripts allow-modals allow-forms allow-same-origin"></iframe>
        <div style="margin-top:14px">
          <a id="openNew" class="button" href="${TOOL_URL_ROOT}" target="_blank" rel="noopener">Open tool in new tab</a>
        </div>
      </div>
    </div>
  </div>

<script>
(function(){
  const inner = document.getElementById('innerFrame');
  const closeBtn = document.getElementById('close');
  closeBtn.addEventListener('click', ()=> { parent.postMessage({type:'mebuki-request-close'}, '*'); });

  // Try to set iframe.src to the real index (this may be blocked by parent page rules,
  // but in many environments iframe from blob can load external src)
  try {
    inner.src = '${TOOL_URL_ROOT}';
  } catch(e){
    console.warn('inner.src assignment failed', e);
  }

  // If inner iframe doesn't become usable, the "Open in new tab" link is visible for user fallback.
})();
</script>
</body>
</html>`.trim();

      const blob = new Blob([bootstrapHtml], {type: 'text/html'});
      const blobUrl = URL.createObjectURL(blob);
      _current.blobUrl = blobUrl;

      // create overlay iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'mebuki-blob-iframe';
      iframe.src = blobUrl;
      iframe.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;margin:0;padding:0;z-index:2147483647;background:transparent;`;
      document.body.appendChild(iframe);
      _current.iframe = iframe;

      // create parent-side close button for convenience
      const closeBtn = document.createElement('button');
      closeBtn.id = 'mebuki-blob-close';
      closeBtn.innerText = '✕';
      closeBtn.title = 'Close Mebuki tool';
      closeBtn.style.cssText = 'position:fixed;top:10px;right:14px;z-index:2147483648;width:40px;height:40px;border-radius:20px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:20px;cursor:pointer';
      closeBtn.onclick = () => { _cleanup(); };
      document.body.appendChild(closeBtn);
      _current.closeBtn = closeBtn;

      document.body.style.overflow = 'hidden';

      // listen for close request from inner blob document
      window.addEventListener('message', function onMsg(e){
        // it's fine to be permissive here because user initiated action
        if (e.data && e.data.type === 'mebuki-request-close') {
          _cleanup();
          window.removeEventListener('message', onMsg);
        }
      });

      return;
    } catch(e){
      console.warn('[MebukiVb] blob fallback failed:', e);
    }

    // 3) final fallback: open in new window/tab
    try {
      const w = window.open(TOOL_URL_ROOT, '_blank', 'noopener');
      if (!w) {
        alert('Popup blocked. Please allow popups or click the following link:\n' + TOOL_URL_ROOT);
      }
    } catch(e){
      alert('Could not open tool. ' + TOOL_URL_ROOT);
    }
  };

  // expose simple wrapper name for compatibility
  globalThis.mebukiStart = function(){ return globalThis.mebukiStartVb(); };

  console.log('[MebukiTest_vB] installed (mebukiStartVb / mebukiStart)');
})();
