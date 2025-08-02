import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

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
  
  // PixiJS v8 ESM最適化（エラー修正版）
  optimizeDeps: {
    include: [
      'pixi.js',
      'mitt',
      'lodash-es',
      'chroma-js',
      'lz-string'
    ],
    // 問題のあるexclude設定を削除
    esbuildOptions: {
      target: 'esnext'
    }
  },
  
  // エイリアス設定（開発効率化）
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@pixiv8': resolve(__dirname, './src/pixi-v8'),
      '@stores': resolve(__dirname, './src/stores'),
      '@utils': resolve(__dirname, './src/utils'),
      '@assets': resolve(__dirname, './src/assets')
    }
  },
  
  // WebGPU・モダンブラウザ対応
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
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