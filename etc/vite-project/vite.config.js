import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // モダンブラウザ対応
  build: {
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          // WebGL/WebGPU関連を分離
          'webgl': ['gl-matrix', 'twgl.js'],
          // データベース・ストレージを分離
          'storage': ['dexie', 'localforage'],
          // ユーティリティを分離
          'utils': ['lodash-es', 'mitt', 'chroma-js']
        }
      }
    }
  },
  
  // 開発サーバー設定
  server: {
    host: true,
    port: 3000,
    open: true
  },
  
  // プラグイン設定
  plugins: [
    // モダンブラウザ優先、レガシー対応も含む
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  // モジュール解決設定
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@features': '/src/features',
      '@ui': '/src/ui',
      '@utils': '/src/utils',
      '@data': '/src/data'
    }
  },
  
  // 最適化設定
  optimizeDeps: {
    include: [
      'gl-matrix',
      'twgl.js',
      'dexie',
      'lodash-es',
      'mitt',
      'chroma-js'
    ]
  },
  
  // 実験的機能有効化
  experimental: {
    renderBuiltUrl(filename) {
      return `/${filename}`;
    }
  }
});