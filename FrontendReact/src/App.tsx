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
import { HistorialCaptura } from './components/HistorialCaptura'
import { CapturistaFormulario } from './components/CapturistaFormulario'
import { EnConstruccion } from './components/EnConstruccion'
import { MovilLayout } from './movil/MovilLayout'
import { ProcesoProveedor } from './movil/ProcesoContext'
import { MovilCaptura } from './movil/MovilCaptura'
import { MovilPendientes } from './movil/MovilPendientes'
import { TemaProveedor } from './context/TemaContext'
import { SesionProveedor, useSesion } from './context/SesionContext'
import { Login } from './components/Login'
import { Usuarios } from './components/Usuarios'
import { UsuariosMenus } from './components/UsuariosMenus'
import { ImportarCapturistas } from './components/ImportarCapturistas'
import { Sala } from './components/Sala'
import { Operacion } from './components/Operacion'
import { Parametros } from './components/Parametros'
import { Partidos } from './components/Partidos'
import { Coaliciones } from './components/Coaliciones'
import { Boletas } from './components/Boletas'

/** Deja pasar solo con sesión iniciada; si no, manda al login. */
function RutaPrivada({ children }: { children: React.ReactNode }) {
  const { usuario } = useSesion()
  return usuario ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <TemaProveedor>
      <SesionProveedor>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Sala de resultados: pública y a pantalla completa, sin menú ni
              sesión, igual que el móvil. Va fuera del armazón a propósito. */}
          <Route path="/sala" element={<Sala />} />
          {/* Escritorio: menú lateral */}
          <Route element={<RutaPrivada><Layout /></RutaPrivada>}>
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
            <Route path="/reportes/operacion" element={<Operacion />} />
            <Route path="/reportes/asignacion" element={<AsignacionReporte />} />
            <Route path="/reportes/actas" element={<ActasReporte />} />
            <Route path="/reportes/historial" element={<HistorialCaptura />} />
            <Route path="/capturistas" element={<Capturistas />} />
            <Route path="/capturistas/nuevo" element={<CapturistaFormulario />} />
            <Route path="/capturistas/importar" element={<ImportarCapturistas />} />
            <Route path="/capturistas/:id" element={<CapturistaFormulario />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/usuarios/menus" element={<UsuariosMenus />} />
            <Route path="/parametros" element={<Parametros />} />
            <Route path="/catalogos/partidos" element={<Partidos />} />
            <Route path="/catalogos/coaliciones" element={<Coaliciones />} />
            <Route path="/catalogos/boletas" element={<Boletas />} />
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
      </SesionProveedor>
    </TemaProveedor>
  )
}
