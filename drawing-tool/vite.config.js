import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: true,
    open: false
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    rollupOptions: {
      input: resolve(process.cwd(), 'index.html'),
      output: {
        manualChunks: {
          // メインレンダリングエンジン
          pixi: ['pixi.js'],
          
          // ユーティリティライブラリ
          utils: ['lodash-es', 'eventemitter3'],
          
          // 数学・ジオメトリ
          math: ['gl-matrix', 'earcut'],
          
          // カラー・SVG処理
          graphics: ['chroma-js', 'svg-pathdata', 'svg-path-parser'],
          
          // ファイル処理
          files: ['file-saver', 'canvas-to-blob', 'lz-string']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src')
    }
  },
  optimizeDeps: {
    include: [
      'pixi.js',
      'lodash-es',
      'svg-pathdata',
      'svg-path-parser',
      'gl-matrix',
      'chroma-js',
      'file-saver',
      'canvas-to-blob',
      'lz-string',
      'eventemitter3',
      'earcut'
    ]
  },
  esbuild: {
    target: 'es2015',
    keepNames: true
  }
})