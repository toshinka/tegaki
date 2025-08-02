import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // PixiJS v8 ESM最適化設定
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  // PixiJS v8最適化ビルド設定
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        // PixiJS v8チャンク最適化
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
          'utilities': [
            'mitt',
            'lodash-es',
            'chroma-js',
            'lz-string'
          ]
        }
      }
    },
    // WebGPU・Chrome API対応
    assetsInclude: ['**/*.wgsl', '**/*.glsl']
  },
  
  // 開発サーバー設定
  server: {
    host: true,
    port: 3000,
    open: true,
    cors: true,
    // PixiJS v8開発用ヘッダー
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // PixiJS v8 ESM最適化
  optimizeDeps: {
    include: [
      'pixi.js',
      '@pixi/filters',
      '@pixi/mesh',
      'mitt',
      'lodash-es',
      'chroma-js'
    ],
    exclude: [
      // WebWorker用ファイルは最適化から除外
      '**/worker.js',
      '**/*.worker.js'
    ]
  },
  
  // エイリアス設定（開発効率化）
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@pixiv8': new URL('./src/pixi-v8', import.meta.url).pathname,
      '@stores': new URL('./src/stores', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
      '@assets': new URL('./src/assets', import.meta.url).pathname
    }
  },
  
  // WebGPU・モダンブラウザ対応
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    '__PIXIJS_VERSION__': JSON.stringify('8.0.0'),
    '__WEBGPU_ENABLED__': true,
    '__CHROME_API_ENABLED__': true
  },
  
  // CSS設定（ふたば色統合）
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          $futaba-maroon: #800000;
          $futaba-light-maroon: #aa5a56;
          $futaba-medium: #cf9c97;
          $futaba-light-medium: #e9c2ba;
          $futaba-cream: #f0e0d6;
          $futaba-background: #ffffee;
        `
      }
    }
  }
});