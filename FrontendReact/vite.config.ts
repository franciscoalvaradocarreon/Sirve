import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo el front corre en el 5173 y la API en el 8081. El proxy evita
// CORS y deja las rutas iguales que en producción, donde el WAR sirve ambos:
// el front pide /api/procesos y aquí se reenvía al backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
