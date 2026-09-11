import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two builds from one source:
 *   vite build              → normal assets, served at the domain root by
 *                              either server.js (Render/any Node host) or
 *                              Vercel (via outputDirectory in vercel.json)
 *   vite build --mode single → one self-contained HTML file, double-clickable
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
  ],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  define: { __SINGLE_FILE__: JSON.stringify(mode === 'single') },
  base: mode === 'single' ? './' : '/',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 2000,
  },
}));
