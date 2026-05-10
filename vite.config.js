import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const basePath = env.VITE_BASE_PATH || '/'

  return {
    base: basePath,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://127.0.0.1:4000',
        '/uploads': 'http://127.0.0.1:4000',
      },
    },
  }
})
