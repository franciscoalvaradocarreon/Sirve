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
import { Capturistas } from './components/Capturistas'
import { AsignacionReporte } from './components/AsignacionReporte'
import { ActasReporte } from './components/ActasReporte'
import { CapturistaFormulario } from './components/CapturistaFormulario'
import { EnConstruccion } from './components/EnConstruccion'
import { MovilLayout } from './movil/MovilLayout'
import { ProcesoProveedor } from './movil/ProcesoContext'
import { MovilCaptura } from './movil/MovilCaptura'
import { MovilPendientes } from './movil/MovilPendientes'
import { TemaProveedor } from './context/TemaContext'

export default function App() {
  return (
    <TemaProveedor>
      <BrowserRouter>
        <Routes>
          {/* Escritorio: menú lateral */}
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
            <Route path="/reportes/asignacion" element={<AsignacionReporte />} />
            <Route path="/reportes/actas" element={<ActasReporte />} />
            <Route path="/capturistas" element={<Capturistas />} />
            <Route path="/capturistas/nuevo" element={<CapturistaFormulario />} />
            <Route path="/capturistas/:id" element={<CapturistaFormulario />} />
          </Route>

          {/* Teléfono y tableta: árbol propio, sin menú lateral, con
              navegación inferior. Las pantallas de escritorio no se tocan. */}
          <Route
            path="/movil"
            element={
              <ProcesoProveedor>
                <MovilLayout />
              </ProcesoProveedor>
            }
          >
            <Route index element={<MovilCaptura />} />
            <Route path="pendientes" element={<MovilPendientes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TemaProveedor>
  )
}
