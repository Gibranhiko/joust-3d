import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': '/src' }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  }
});
