import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'es2015',
    rollupOptions: {
      external: [
        // Worker関連のファイルを正しいパターンで指定
        /.*\.worker\.js$/,
        /.*\/worker\.js$/,
        /.*\/design-config\.js$/
      ],
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          vendor: ['lodash-es']
        }
      }
    },
    // より詳細なチャンク分割設定
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  },
  optimizeDeps: {
    include: [
      'pixi.js',
      'lodash-es'
    ],
    // Workerファイルを最適化から除外
    exclude: [
      '**/*.worker.js',
      '**/worker.js',
      '**/design-config.js'
    ]
  },
  // Workerとデザインファイルの処理を改善
  assetsInclude: ['**/*.worker.js'],
  
  // より安全なesbuild設定
  esbuild: {
    target: 'es2015',
    keepNames: true
  }
})