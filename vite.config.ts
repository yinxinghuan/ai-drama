import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/ai-drama/',
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, 'src/shared') },
  },
  css: {
    preprocessorOptions: {
      less: { javascriptEnabled: true },
    },
  },
  server: {
    proxy: {
      '/api/image': {
        target: 'http://aiservice.wdabuliu.com:8019',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/image/, ''),
      },
    },
  },
});
