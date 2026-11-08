import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarTema } from './utils/tema'
import './index.css'

// El color primario se escribe antes de pintar para que no haya un parpadeo
// con el color por omisión.
aplicarTema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)