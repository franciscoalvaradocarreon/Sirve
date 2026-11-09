import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarTema } from './utils/tema'
import { aplicarTextoGrande, leerTextoGrande } from './utils/texto'
import './index.css'

// El color primario se escribe antes de pintar para que no haya un parpadeo
// con el color por omisión. El tamaño de letra, igual: si se aplicara después
// de montar, la pantalla se vería pequeña y luego saltaría.
aplicarTema()
aplicarTextoGrande(leerTextoGrande())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * Service worker: deja la aplicación disponible sin conexión.
 *
 * Solo en producción. En desarrollo estorba: guarda en caché los módulos de
 * Vite y los cambios dejan de verse hasta limpiar el almacenamiento a mano.
 *
 * No se espera a que esté listo: la primera carga funciona igual y a partir de
 * la segunda ya abre sin red.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la aplicación funciona, solo que no sin conexión.
    })
  })
}
