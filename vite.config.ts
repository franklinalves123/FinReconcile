
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Define o caminho base como relativo para funcionar em qualquer subpasta (cPanel)
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          utils: ['@supabase/supabase-js', '@google/genai', 'lucide-react', 'recharts']
        }
      }
    }
  },
  // Removido o define vazio de process.env para permitir que o shim no index.html tenha prioridade
  define: {
    'global': 'window'
  }
});
