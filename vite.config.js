import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        'dashboard-glass': resolve(__dirname, 'dashboard-glass.html'),
        'dashboard-crystal': resolve(__dirname, 'dashboard-crystal.html'),
      },
    },
  },
});

