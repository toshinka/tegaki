import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true // ネットワークアクセス
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pixi.js']
  }
});