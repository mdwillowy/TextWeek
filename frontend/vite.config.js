import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_DEV_ORIGIN || 'http://localhost:5050',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_DEV_ORIGIN || 'http://localhost:5050',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_DEV_ORIGIN || 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
