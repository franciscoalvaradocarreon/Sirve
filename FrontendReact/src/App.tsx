import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Inicio } from './components/Inicio'
import { Procesos } from './components/Procesos'
import { Municipios } from './components/Municipios'
import { Distritos } from './components/Distritos'
import { Secciones } from './components/Secciones'
import { Casillas } from './components/Casillas'
import { Elecciones } from './components/Elecciones'
import { Captura } from './components/Captura'
import { Avance } from './components/Avance'
import { EnConstruccion } from './components/EnConstruccion'
import { TemaProveedor } from './context/TemaContext'

export default function App() {
  return (
    <TemaProveedor>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="/catalogos/procesos" element={<Procesos />} />
            <Route path="/catalogos/elecciones" element={<Elecciones />} />
            <Route path="/catalogos/municipios" element={<Municipios />} />
            <Route path="/catalogos/distritos" element={<Distritos />} />
            <Route path="/catalogos/secciones" element={<Secciones />} />
            <Route path="/catalogos/casillas" element={<Casillas />} />
            <Route path="/captura" element={<Captura />} />
            <Route path="/captura/consulta" element={<EnConstruccion titulo="Consultar captura" />} />
            <Route path="/reportes/avance" element={<Avance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TemaProveedor>
  )
}