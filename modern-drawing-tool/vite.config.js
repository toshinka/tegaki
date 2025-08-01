// vite.config.js - モダンお絵かきツール用Vite設定

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 開発サーバー設定
  server: {
    port: 3000,
    open: true,
    host: true
  },
  
  // ビルド設定
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  
  // 解決設定
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // プラグイン設定
  plugins: [],
  
  // 最適化設定
  optimizeDeps: {
    include: [
      'ogl',
      'mitt', 
      'chroma-js',
      'lodash-es',
      'phosphor-icons'
    ]
  },
  
  // 開発時設定
  define: {
    __DEV__: JSON.stringify(true)
  }
});