import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from a /<repo-name>/ subpath; every
  // other target (local dev, Vercel, Netlify) serves from the root.
  base: process.env.GITHUB_PAGES ? '/red_wings_daily_draft/' : '/',
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
