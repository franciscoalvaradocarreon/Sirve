package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.CasillaAsignadaDTO;
import mx.sirve.modelo.dto.CodigoEnrolamientoDTO;
import mx.sirve.modelo.dto.DispositivoDTO;
import mx.sirve.modelo.dto.EnrolamientoDTO;
import mx.sirve.repositorio.CapturistaRepositorio;
import mx.sirve.repositorio.DispositivoRepositorio;
import mx.sirve.seguridad.Pases;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Enrolamiento de teléfonos y validación de pases.
 *
 * El flujo es el de las aplicaciones de mensajería: se entrega un código una
 * sola vez, el teléfono lo canjea por un pase, y el código deja de servir.
 */
@Service
@Transactional
public class DispositivoServicio {

    private final DispositivoRepositorio dispositivos;
    private final CapturistaRepositorio capturistas;
    private final EleccionServicio eleccionServicio;

    public DispositivoServicio(DispositivoRepositorio dispositivos,
                               CapturistaRepositorio capturistas,
                               EleccionServicio eleccionServicio) {
        this.dispositivos = dispositivos;
        this.capturistas = capturistas;
        this.eleccionServicio = eleccionServicio;
    }

    /** Máximo de teléfonos activos por capturista. */
    private static final int MAXIMO_TELEFONOS = 2;

    /**
     * Genera un código para un teléfono del capturista.
     *
     * Si ya tiene uno pendiente de enrolar, se reemite ese: pedir el código
     * otra vez no debe dejar teléfonos de sobra en la lista.
     */
    public CodigoEnrolamientoDTO generarCodigo(int idCapturista, String nombre) {
        if (capturistas.buscar(idCapturista).isEmpty()) {
            throw new NoEncontradoExcepcion("NO_ENCONTRADO", "No existe el capturista " + idCapturista);
        }

        String codigo = Pases.nuevoCodigo();

        // Ya hay uno esperando: se le cambia el código y se reutiliza.
        Optional<Integer> pendiente = dispositivos.sinEnrolar(idCapturista);
        if (pendiente.isPresent()) {
            int id = pendiente.get();
            dispositivos.reemitir(id, Pases.hash(codigo));
            // Los que quedaron de pruebas anteriores no sirven para nada.
            dispositivos.depurarSinEnrolar(idCapturista, id);
            return new CodigoEnrolamientoDTO(id, codigo, nombre);
        }

        if (dispositivos.activos(idCapturista) >= MAXIMO_TELEFONOS) {
            throw new DatosInvalidosExcepcion(
                    "TELEFONOS_COMPLETOS",
                    "Ya tiene " + MAXIMO_TELEFONOS + " teléfonos. Desactiva uno antes de agregar otro.");
        }

        int id = dispositivos.crear(idCapturista, nombre, Pases.hash(codigo));
        return new CodigoEnrolamientoDTO(id, codigo, nombre);
    }

    /** Reemite el código de un dispositivo: sirve para cambiar de teléfono. */
    public CodigoEnrolamientoDTO reemitir(int idDispositivo) {
        String codigo = Pases.nuevoCodigo();
        dispositivos.reemitir(idDispositivo, Pases.hash(codigo));
        return new CodigoEnrolamientoDTO(idDispositivo, codigo, null);
    }

    /**
     * Canjea el código por un pase.
     *
     * Si el código no existe, el mensaje es el mismo que si ya se hubiera
     * usado: no conviene decirle a nadie qué códigos son válidos.
     */
    public EnrolamientoDTO enrolar(String codigo, Integer idEleccion) {
        String limpio = Pases.normalizarCodigo(codigo);
        if (limpio.length() < 6) {
            throw new DatosInvalidosExcepcion("El código no es válido.");
        }

        int[] dispositivo = dispositivos.porCodigo(Pases.hash(limpio))
                .orElseThrow(() -> new DatosInvalidosExcepcion(
                        "El código no es válido o ya se usó. Pide uno nuevo."));

        String pase = Pases.nuevoPase();
        dispositivos.enrolar(dispositivo[0], Pases.hash(pase));

        int idCapturista = dispositivo[1];
        String nombre = capturistas.buscar(idCapturista)
                .map(c -> c.nombre())
                .orElse("");

        // La elección es opcional: al enrolar todavía no se ha elegido ninguna.
        // Sin esta comprobación, el nulo reventaba al convertirlo a int y el
        // enrolamiento respondía 500.
        List<CasillaAsignadaDTO> casillas = idEleccion == null
                ? List.of()
                : capturistas.casillas(idCapturista, idEleccion);

        return new EnrolamientoDTO(pase, idCapturista, nombre, casillas);
    }

    /** Devuelve [idDispositivo, idCapturista] si el pase es válido y está activo. */
    @Transactional(readOnly = true)
    public Optional<int[]> autenticar(String pase) {
        if (pase == null || pase.isBlank()) return Optional.empty();
        return dispositivos.porPase(Pases.hash(pase.trim()));
    }

    public void tocar(int idDispositivo) {
        dispositivos.tocar(idDispositivo);
    }

    public List<DispositivoDTO> listar(int idCapturista) {
        return dispositivos.listar(idCapturista);
    }

    public void desactivar(int idDispositivo) {
        dispositivos.desactivar(idDispositivo);
    }
}
