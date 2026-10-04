import { defineConfig } from 'vite';
import { createLocalFontBridgePlugin } from './build/local-font-bridge.mjs';

export default defineConfig(({ command, isPreview }) => ({
    ...(command === 'serve' && !isPreview ? {
        plugins: [createLocalFontBridgePlugin()],
        server: {
            // Personal localhost only: the dev server must not become a LAN file reader.
            host: '127.0.0.1',
            // Vite's CORS middleware runs before plugins, including OPTIONS.
            cors: false
        }
    } : {}),
    build: {
        rollupOptions: {
            input: {
                index: 'index.html'
            }
        }
    }
}));
