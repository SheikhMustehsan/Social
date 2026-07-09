import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '::',
    port: 5173,
    strictPort: true,
    allowedHosts: ['social.buzzintechhub.com', 'api.buzzintechhub.com'],
  },
  preview: {
    host: '::',
    port: 5173,
    strictPort: true,
    allowedHosts: ['social.buzzintechhub.com', 'api.buzzintechhub.com'],
  },
})
