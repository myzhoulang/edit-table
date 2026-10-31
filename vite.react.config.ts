import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'packages/react/dist',
    lib: { entry: 'packages/react/src/index.ts', formats: ['es'], fileName: 'edit-table-react' },
    rollupOptions: { external: ['edit-table', 'react', 'react-dom'] },
  },
});
