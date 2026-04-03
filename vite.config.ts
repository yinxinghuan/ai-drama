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
});
