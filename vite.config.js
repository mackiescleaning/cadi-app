import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Honour a harness/CI-assigned PORT (e.g. preview autoPort); default to 3000 locally.
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
  preview: {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes('/node_modules/react') ||
            id.includes('/node_modules/react-dom') ||
            id.includes('/node_modules/react-router')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/@supabase')) {
            return 'vendor-supabase';
          }
        },
      },
    },
  },
});
