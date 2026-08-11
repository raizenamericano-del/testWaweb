import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    // Allow the e2b / Railway style preview hosts
    allowedHosts: true,
    cors: true,
    // When served through an HTTPS preview proxy (e2b / codespaces), HMR must
    // talk wss on 443. Locally we let Vite figure it out.
    hmr: process.env.VITE_HTTPS_PROXY_PREVIEW
      ? { clientPort: 443, protocol: 'wss' }
      : true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/media': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          io: ['socket.io-client'],
        },
      },
    },
  },
})
