import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  // one JavaScript file: the PDF reader is loaded on demand but kept in the same bundle
  build: { rollupOptions: { output: { inlineDynamicImports: true } }, chunkSizeWarningLimit: 4000 }
});
