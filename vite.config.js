const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  publicDir: 'static',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/v2': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/rankings': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/bot': { target: 'http://127.0.0.1:3001', changeOrigin: true }
    }
  }
});
