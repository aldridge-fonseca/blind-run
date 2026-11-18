import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { runsPlugin } from './scripts/runs-plugin';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), runsPlugin()],
  server: { port: 4320, strictPort: true },
  preview: { port: 4320, strictPort: true },
});
