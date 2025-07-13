import App from './core/App.js';

// DOMが読み込まれたらアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app-container');
  if (container) {
    new App(container);
    console.log("🎨 Application Initialized (Phase 4A11E)");
  } else {
    console.error("Application container #app-container not found.");
  }
});