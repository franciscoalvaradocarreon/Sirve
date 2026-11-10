import { useState } from 'react'
import { KeyRound, TriangleAlert } from 'lucide-react'
import { dispositivoServicio } from '../api/dispositivoServicio'
import { guardarSesion } from '../utils/sesion'

/**
 * Enrolamiento del teléfono.
 *
 * Es lo primero que ve el capturista y lo único que hace una sola vez: pegar
 * el código de su hoja. Después de esto la aplicación abre directo en sus
 * casillas y no vuelve a pedir nada.
 *
 * El código se escribe sin guiones ni espacios: el campo los ignora y pasa
 * todo a mayúsculas, para que escribir «k7m2-qx9p» funcione igual.
 */
export function EnrolamientoMovil({ alEnrolar }: { alEnrolar: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completo = codigo.replace(/[^A-Za-z0-9]/g, '').length >= 6

  async function enrolar() {
    if (!completo) return
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await dispositivoServicio.enrolar(codigo)
      guardarSesion({ pase: respuesta.pase, nombre: respuesta.nombre })
      alEnrolar()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo enrolar. Revisa el código y la conexión.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primario/10">
            <KeyRound size={26} className="text-primario" />
          </div>
          <h1 className="text-lg font-semibold text-texto">Enlazar este teléfono</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            Escribe el código de tu hoja. Solo se hace una vez.
          </p>
        </div>

        <label className="block text-sm text-texto-tenue">
          Código
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void enrolar()
            }}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="XXXXXXXX"
            className="mt-1 w-full rounded-xl border border-borde bg-superficie px-4 py-4 text-center font-mono text-2xl tracking-[0.3em] text-texto placeholder:tracking-[0.3em] placeholder:text-texto-tenue/60 focus:border-primario focus:outline-none"
          />
        </label>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          onClick={() => void enrolar()}
          disabled={enviando || !completo}
          className="mt-5 w-full rounded-xl bg-primario py-4 text-base font-medium text-white transition-opacity disabled:opacity-40"
        >
          {enviando ? 'Enlazando…' : 'Enlazar teléfono'}
        </button>

        <p className="mt-6 text-center text-xs text-texto-tenue">
          Si no tienes código, pídelo a quien coordina la captura.
        </p>
      </div>
    </div>
  )
}
