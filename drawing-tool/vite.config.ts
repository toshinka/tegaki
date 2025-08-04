import { defineConfig } from 'vite';

export default defineConfig({
  // 開発サーバー設定・2.5K環境対応
  server: {
    port: 3000,
    host: true, // ネットワークアクセス許可
    open: false, // ブラウザ自動起動無効
    cors: true
  },

  // ビルド最適化・性能重視
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    
    // チャンク分割・読み込み最適化
    rollupOptions: {
      output: {
        manualChunks: {
          // PixiJS専用チャンク・大容量
          pixi: ['pixi.js'],
          
          // UI関連・中容量
          ui: [
            './src/ui/UIManager.ts'
          ],
          
          // ツール関連・小容量
          tools: [
            './src/tools/ToolManager.ts'
          ]
        }
      }
    },
    
    // 最適化設定
    cssCodeSplit: true,
    assetsInlineLimit: 4096
  },

  // 依存関係最適化・PixiJS特化
  optimizeDeps: {
    include: [
      'pixi.js'
    ]
  },

  // 開発用定数定義
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '4.1.0')
  },

  // CSS処理・ふたば色最適化
  css: {
    devSourcemap: true
  },

  // アセット処理
  assetsInclude: [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.ico'
  ]
});