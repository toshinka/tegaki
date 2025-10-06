// core-runtime.js
// PixiJS v8.13 お絵かきツール - コアランタイム
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    // 既存の初期化処理（省略）
    // ...

    // ========================================
    // ExportSystem 初期化（GPT5案対応）
    // ========================================
    (function initExportSystem() {
      try {
        // 明示的依存チェック（欠落時は明確にエラー出力）
        if (!window.app || !window.LayerSystem || !window.AnimationSystem || !window.CameraSystem) {
          console.error('[ExportInit] missing dependency: app/LayerSystem/AnimationSystem/CameraSystem');
          if (window.TegakiEventBus && typeof window.TegakiEventBus.emit === 'function') {
            window.TegakiEventBus.emit('export:init:failed', { reason: 'missing-deps' });
          }
          return;
        }

        // ExportManager のインスタンス化（グローバル配置）
        if (!window.TEGAKI_EXPORT_MANAGER) {
          window.TEGAKI_EXPORT_MANAGER = new window.ExportManager(
            window.app,
            window.LayerSystem,
            window.AnimationSystem,
            window.CameraSystem
          );
        }

        const mgr = window.TEGAKI_EXPORT_MANAGER;

        // エクスポーター登録（存在チェックを行う）
        if (window.PNGExporter) mgr.registerExporter('png', new window.PNGExporter(mgr));
        if (window.GIFExporter) mgr.registerExporter('gif', new window.GIFExporter(mgr));
        if (window.APNGExporter) mgr.registerExporter('apng', new window.APNGExporter(mgr));
        if (window.WEBPExporter) mgr.registerExporter('webp', new window.WEBPExporter(mgr));

        // ExportPopup の生成（ExportManager を渡す）
        if (!window.TEGAKI_EXPORT_POPUP) {
          window.TEGAKI_EXPORT_POPUP = new window.ExportPopup(mgr);
        }

        // UI を開くための基本ハンドラ（既存UIにボタン id="btn-open-export" があれば接続）
        const openBtn = document.getElementById('btn-open-export');
        if (openBtn) {
          openBtn.addEventListener('click', () => window.TEGAKI_EXPORT_POPUP.show());
        } else {
          // ショートカットキー（例: E）登録は既存のキーマップ経由で行うことを推奨
          if (window.TEGAKI_KEYMAP && typeof window.TEGAKI_KEYMAP.bind === 'function') {
            window.TEGAKI_KEYMAP.bind('KeyE', () => window.TEGAKI_EXPORT_POPUP.show());
          }
        }

        // 初期化完了イベント
        if (window.TegakiEventBus && typeof window.TegakiEventBus.emit === 'function') {
          window.TegakiEventBus.emit('export:manager:initialized', { timestamp: Date.now() });
        }
        console.info('[ExportInit] ExportManager initialized');
      } catch (e) {
        console.error('[ExportInit] unexpected error:', e);
      }
    })();

  }); // DOMContentLoaded end

})();