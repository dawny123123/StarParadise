import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/qoderwake-api': {
        target: 'https://api.qoder.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/qoderwake-api/, '/v1/qoderwake')
      }
    }
  },
  css: {
    preprocessorOptions: {}
  }
})
