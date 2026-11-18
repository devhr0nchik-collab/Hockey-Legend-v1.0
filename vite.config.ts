import { defineConfig } from 'vite';

// base: './' — сборка остаётся рабочей при открытии из любой подпапки и в PWA.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    assetsInlineLimit: 0
  },
  server: {
    port: 5173,
    open: false
  }
});
