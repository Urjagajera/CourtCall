import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The /guide page imports ../GUIDE.md from the repo root.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
