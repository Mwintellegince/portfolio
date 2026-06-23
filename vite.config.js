import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        policies: resolve(__dirname, 'policies.html'),
        worker: resolve(__dirname, 'worker.html')
      }
    }
  }
});
