import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // PixiJS v8 ESM最適化設定（v3.3対応）
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  // PixiJS v8最適化ビルド設定（アイコン責務集約対応）
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        // PixiJS v8チャンク最適化（v3.3アイコン責務集約対応）
        manualChunks: {
          'pixi-core': ['pixi.js'],
          'pixi-extensions': [
            '@pixi/filters',
            '@pixi/mesh',
            '@pixi/particle-emitter'
          ],
          'pixi-advanced': [
            'pixi-spine',
            'pixi-sound',
            'pixi-projection',
            '@pixi/tilemap'
          ],
          'ui-design': [
            '@phosphor-icons/core'
          ],
          'utilities': [
            'mitt',
            'lodash-es',
            'chroma-js',
            'lz-string'
          ]
        }
      }
    },
    // WebGPU・Chrome API対応・Phosphor Icons SVG・デザインアセット
    assetsInclude: [
      '**/*.wgsl', 
      '**/*.glsl', 
      '**/*.svg',
      '**/design-config.js',
      '**/futaba-colors.css'
    ]
  },
  
  // 開発サーバー設定（v3.3 デザイン責務集約対応）
  server: {
    host: true,
    port: 3000,
    open: true,
    cors: true,
    // PixiJS v8開発用ヘッダー
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    // デザイン設定ホットリロード対応
    watch: {
      include: [
        'index.html',
        'src/**/*',
        'public/icons/**/*'
      ]
    }
  },
  
  // PixiJS v8 ESM最適化（基本ライブラリのみ・v3.3対応）
  optimizeDeps: {
    include: [
      'pixi.js',
      'mitt',
      'lodash-es',
      'chroma-js'
    ],
    exclude: [
      // WebWorker用ファイルは最適化から除外
      '**/worker.js',
      '**/*.worker.js',
      // デザイン設定は最適化から除外（ホットリロード対応）
      '**/design-config.js',
      // まだインストールされていない拡張ライブラリ
      '@pixi/filters',
      '@pixi/mesh',
      '@phosphor-icons/core'
    ]
  },
  
  // エイリアス設定（開発効率化・v3.3対応）
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@pixiv8': fileURLToPath(new URL('./src/pixi-v8', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@icons': fileURLToPath(new URL('./public/icons', import.meta.url)),
      '@design': fileURLToPath(new URL('./index.html', import.meta.url))
    }
  },
  
  // WebGPU・モダンブラウザ対応（v3.3拡張）
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    '__PIXIJS_VERSION__': JSON.stringify('8.0.0'),
    '__WEBGPU_ENABLED__': true,
    '__CHROME_API_ENABLED__': true,
    '__PHOSPHOR_ICONS_ENABLED__': true,
    '__DESIGN_CENTRALIZED__': true,
    '__FUTABA_COLORS_ENABLED__': true,
    '__AIRBRUSH_TOOL_ENABLED__': true,
    '__ONION_SKIN_ENABLED__': true,
    '__MOVABLE_POPUP_ENABLED__': true
  },
  
  // CSS設定（ふたば色統合・v3.3完全版）
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          // ふたば色統一（v3.3完全版）
          $futaba-maroon: #800000;
          $futaba-light-maroon: #aa5a56;
          $futaba-medium: #cf9c97;
          $futaba-light-medium: #e9c2ba;
          $futaba-cream: #f0e0d6;
          $futaba-background: #ffffee;
          
          // v3.3 アイコン・UI統一変数
          $sidebar-width: 72px;
          $layer-panel-width: 300px;
          $icon-size-normal: 44px;
          $icon-size-active: 48px;
          $border-radius: 16px;
          
          // PixiJS v8統一座標設定
          $pixi-coordinate-origin: top left;
          $pixi-y-direction: down;
          $webgpu-enabled: true;
          
          // Chrome API最適化
          $gpu-acceleration: translateZ(0);
          $will-change-transform: transform;
          $will-change-opacity: opacity;
          $contain-layout: layout style paint;
        `
      }
    },
    // PostCSS設定（将来の拡張用）
    postcss: {
      plugins: []
    }
  },
  
  // 環境変数設定（v3.3開発効率化）
  envPrefix: 'VITE_',
  
  // パフォーマンス最適化（大規模プロジェクト対応）
  esbuild: {
    target: 'esnext',
    platform: 'browser',
    format: 'esm'
  },
  
  // WebWorker設定（PixiJS v8統合）
  worker: {
    format: 'es',
    plugins: () => [
      // Worker内でもESMモジュール使用
    ]
  },
  
  // 実験的機能（Chrome API活用）
  experimental: {
    // WebCodecs・OffscreenCanvas対応
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { js: filename };
      } else {
        return { relative: true };
      }
    }
  }
});