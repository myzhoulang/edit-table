import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      'edit-table': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'packages/core/dist',
    lib: {
      entry: 'packages/core/src/index.ts',
      name: 'EditTable',
      formats: ['es'],
      fileName: 'edit-table',
      cssFileName: 'style',
    },
    rollupOptions: { external: ['async-validator'] },
  },
});
