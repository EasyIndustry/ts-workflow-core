/** Errores de uso del motor: una definición que no corresponde a la instancia, una condición que no está en el registro, etc. */
export type CodigoError =
  | "registro_invalido"
  | "version_inexistente"
  | "versiones_mezcladas"
  | "version_duplicada"
  | "sin_versiones"
  | "estado_inexistente"
  | "capacidad_desconocida"
  | "tipo_de_capacidad"
  | "condicion_fallo"
  | "decision_sin_salida";

export class ErrorFlujo extends Error {
  readonly codigo: CodigoError;

  constructor(codigo: CodigoError, mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "ErrorFlujo";
    this.codigo = codigo;
  }
}
