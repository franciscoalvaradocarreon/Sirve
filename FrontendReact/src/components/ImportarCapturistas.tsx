import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, FileUp, TriangleAlert, Upload } from 'lucide-react'
import { cliente } from '../api/cliente'

/** Una fila leída del archivo, ya normalizada. */
interface Fila {
  nombre: string
  telefono: string | null
  secciones: string[]
}

interface Resultado {
  creados: number
  secciones: number
  compartidas: number
  errores: string[]
}

/**
 * Alta masiva de capturistas desde un archivo CSV.
 *
 * El archivo se lee aquí y se manda ya convertido: el servidor no interpreta
 * comas ni comillas, que es donde se rompen estas cosas.
 *
 * Primero se muestra lo que se va a crear y no se escribe nada. Con 300
 * renglones, importar a ciegas y descubrir un error al final sería peor que no
 * tener importación.
 */
export function ImportarCapturistas() {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [importando, setImportando] = useState(false)

  /**
   * Lee el CSV.
   *
   * Se aceptan comas y punto y coma como separador, y comillas alrededor de
   * los campos: un nombre con coma —«Garza, María»— es común y rompería un
   * separador ingenuo.
   */
  function leer(texto: string) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lineas.length < 2) {
      setError('El archivo no tiene renglones además del encabezado.')
      return
    }

    const separador = lineas[0].includes(';') && !lineas[0].includes(',') ? ';' : ','
    const encabezado = partir(lineas[0], separador).map((c) =>
      c.trim().toLowerCase().replace(/^\uFEFF/, ''),
    )

    const iNombre = encabezado.findIndex((c) => c.startsWith('nombre'))
    if (iNombre < 0) {
      setError('No encontré la columna «Nombre» en el encabezado.')
      return
    }
    const iTelefono = encabezado.findIndex((c) => c.startsWith('telefono') || c.startsWith('teléfono'))
    const iSecciones = encabezado
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.startsWith('seccion') || c.startsWith('sección'))
      .map(({ i }) => i)

    if (iSecciones.length === 0) {
      setError('No encontré columnas de secciones (seccion1, seccion2…).')
      return
    }

    const leidas: Fila[] = []
    for (const linea of lineas.slice(1)) {
      const campos = partir(linea, separador)
      const nombre = (campos[iNombre] ?? '').trim()
      if (!nombre) continue
      const telefono = iTelefono >= 0 ? (campos[iTelefono] ?? '').trim() : ''
      leidas.push({
        nombre,
        telefono: telefono || null,
        secciones: iSecciones
          .map((i) => (campos[i] ?? '').trim())
          .filter((s) => s !== ''),
      })
    }

    if (leidas.length === 0) {
      setError('No se pudo leer ningún renglón con nombre.')
      return
    }

    setError(null)
    setResultado(null)
    setFilas(leidas)
  }

  /**
   * Descarga un archivo de ejemplo.
   *
   * Lleva el encabezado y dos renglones: uno completo y otro sin teléfono, para
   * que se vea que ese campo es opcional. Las secciones son reales de 2027.
   *
   * Se antepone el carácter BOM porque Excel, sin él, abre el archivo en ANSI
   * y rompe los acentos: «MARÍA» aparece como «MARÃA».
   */
  function descargarEjemplo() {
    const encabezado = [
      'Nombre', 'telefono',
      ...Array.from({ length: 10 }, (_, i) => `seccion${i + 1}`),
    ].join(',')

    const fila1 = ['Maria Garza Arriaga', '8121234567', '1061', '1062', '1063', '1064',
                   '1065', '1066', '1067', '1068', '1069', '1070'].join(',')

    const fila2 = ['Jose Luis Ramirez', '', '1071', '1072', '1073', '1074', '',
                   '', '', '', '', ''].join(',')

    const contenido = '\uFEFF' + [encabezado, fila1, fila2].join('\r\n') + '\r\n'
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
    enlace.download = 'capturistas-ejemplo.csv'
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  /** Parte una línea respetando las comillas dobles. */
  function partir(linea: string, separador: string): string[] {
    const campos: string[] = []
    let actual = ''
    let entreComillas = false

    for (let i = 0; i < linea.length; i++) {
      const c = linea[i]
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          entreComillas = !entreComillas
        }
      } else if (c === separador && !entreComillas) {
        campos.push(actual)
        actual = ''
      } else {
        actual += c
      }
    }
    campos.push(actual)
    return campos
  }

  async function elegirArchivo(archivo: File) {
    setNombreArchivo(archivo.name)
    try {
      // Se lee como UTF-8. Si viniera en ANSI, los acentos saldrían raros y se
      // notaría en la vista previa, antes de importar nada.
      leer(await archivo.text())
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  async function importar() {
    if (!filas) return
    setImportando(true)
    setError(null)
    try {
      const r = await cliente.post<Resultado>('/capturistas/importar', { filas })
      setResultado(r.data)
      setFilas(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar')
    } finally {
      setImportando(false)
    }
  }

  const totalSecciones = filas?.reduce((t, f) => t + f.secciones.length, 0) ?? 0

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link
          to="/capturistas"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-tenue hover:text-texto"
        >
          <ArrowLeft size={15} />
          Capturistas
        </Link>
        <h1 className="text-xl font-semibold text-texto">Importar capturistas</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Un archivo CSV con una fila por persona. Primero se muestra lo que se va a crear;
          nada se guarda hasta que confirmes.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mb-4 rounded-xl border border-primario/40 bg-primario/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-texto">
            <CheckCircle2 size={16} />
            {resultado.creados} capturistas creados · {resultado.secciones} secciones asignadas
          </p>
          {resultado.compartidas > 0 && (
            <p className="mt-1 text-xs text-texto-tenue">
              {resultado.compartidas} secciones quedaron compartidas con otra persona.
            </p>
          )}
          {resultado.errores.length > 0 && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <TriangleAlert size={13} />
                {resultado.errores.length} renglones no se importaron
              </p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-texto-tenue">
                {resultado.errores.map((e) => (
                  <li key={e}>· {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Selección de archivo */}
      {!filas && (
        <label className="block cursor-pointer rounded-xl border border-dashed border-borde bg-superficie p-10 text-center">
          <FileUp size={26} className="mx-auto mb-2 text-texto-tenue" />
          <p className="text-sm font-medium text-texto">
            {nombreArchivo || 'Elige el archivo CSV'}
          </p>
          <p className="mt-1 text-xs text-texto-tenue">
            Columnas: Nombre, telefono, seccion1, seccion2… · guardado en UTF-8
          </p>

          <button
            type="button"
            onClick={(e) => {
              // El recuadro entero abre el selector de archivo; este botón no
              // debe dispararlo también.
              e.preventDefault()
              e.stopPropagation()
              descargarEjemplo()
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-xs text-texto-tenue hover:text-primario"
          >
            <Download size={13} />
            Descargar ejemplo
          </button>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) void elegirArchivo(archivo)
              e.target.value = ''
            }}
          />
        </label>
      )}

      {/* Vista previa */}
      {filas && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-superficie px-4 py-3">
            <p className="text-sm text-texto">
              {filas.length} capturistas · {totalSecciones} secciones
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilas(null)
                  setNombreArchivo('')
                }}
                className="rounded-lg border border-borde px-4 py-2 text-sm text-texto-tenue"
              >
                Elegir otro
              </button>
              <button
                onClick={() => void importar()}
                disabled={importando}
                className="flex items-center gap-2 rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Upload size={15} />
                {importando ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-superficie">
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Teléfono</th>
                  <th className="px-3 py-2 font-medium">Secciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className="border-b border-borde-tenue last:border-0">
                    <td className="px-3 py-2 text-texto">{f.nombre}</td>
                    <td className="px-3 py-2 text-texto-tenue">{f.telefono ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-texto-tenue">
                      {f.secciones.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
