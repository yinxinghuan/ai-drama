import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ai-drama/',
  plugins: [react()],
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
