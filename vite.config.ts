import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'es2022',
  },
});
