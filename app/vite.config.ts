import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Three builds from one source:
 *   vite build              → normal assets, served under /app/ by the Planzo (Render) server
 *   vite build --mode single → one self-contained HTML file, double-clickable
 *   vite build --mode vercel → normal assets, served at the domain root on Vercel
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
  ],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  define: { __SINGLE_FILE__: JSON.stringify(mode === 'single') },
  // The Render build is served under /app/, not at root — without this,
  // asset URLs come out as /assets/... and 404. Vercel serves the app at
  // the domain root instead, so it needs a plain '/' base.
  base: mode === 'single' ? './' : mode === 'vercel' ? '/' : '/app/',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 2000,
  },
}));
