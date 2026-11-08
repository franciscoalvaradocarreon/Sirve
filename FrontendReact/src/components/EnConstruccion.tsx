/** Marcador para las pantallas que todavía no se construyen. */
export function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-texto">{titulo}</h1>
      <p className="mt-2 text-sm text-texto-tenue">
        Esta pantalla todavía no está construida.
      </p>
    </div>
  )
}