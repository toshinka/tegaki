import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    // PixiJS v8 + Chrome最新API最適化設定
    plugins: [
      legacy({
        targets: ['Chrome >= 100', 'Firefox >= 100', 'Safari >= 15'],
        modernPolyfills: ['es.promise.finally', 'es.array.flat']
      })
    ],
    
    // PixiJS v8最適化ビルド設定
    build: {
      target: 'esnext',
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
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
            'ui-icons': ['@phosphor-icons/core'],
            'utilities': [
              'mitt',
              'lodash-es',
              'chroma-js',
              'lz-string'
            ]
          }
        }
      }
    },
    
    // 開発サーバー設定（Chrome最新API対応）
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: true,
      cors: true,
      // Chrome最新API対応ヘッダー
      headers: {
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },
    
    // PixiJS v8 ESM最適化
    optimizeDeps: {
      include: [
        'pixi.js',
        '@pixi/filters',
        '@pixi/mesh',
        '@phosphor-icons/core',
        'mitt',
        'lodash-es',
        'chroma-js'
      ]
    },
    
    // エイリアス設定（開発効率化）
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@pixi': new URL('./src/pixi-v8', import.meta.url).pathname,
        '@stores': new URL('./src/stores', import.meta.url).pathname,
        '@utils': new URL('./src/utils', import.meta.url).pathname,
        '@assets': new URL('./src/assets', import.meta.url).pathname,
        '@workers': new URL('./src/workers', import.meta.url).pathname
      }
    },
    
    // PixiJS v8 + Chrome最新API対応
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      '__PIXIJS_VERSION__': JSON.stringify('8.0.0'),
      '__WEBGPU_ENABLED__': JSON.stringify(true),
      '__TARGET_FPS__': JSON.stringify(60),
      '__CHROME_API_ENABLED__': JSON.stringify(true)
    },
    
    // CSS設定（ふたば色統合）
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            // ふたば色完全統合
            $futaba-maroon: #800000;
            $futaba-light-maroon: #aa5a56;
            $futaba-medium: #cf9c97;
            $futaba-light-medium: #e9c2ba;
            $futaba-cream: #f0e0d6;
            $futaba-background: #ffffee;
            
            // UI統一変数
            $sidebar-width: 72px;
            $layer-panel-width: 300px;
            $icon-size-normal: 44px;
            $icon-size-active: 48px;
            $border-radius: 16px;
            
            // 性能対応
            $target-fps: 60;
            $performance-mode: 'optimized';
          `
        }
      }
    }
  };
});