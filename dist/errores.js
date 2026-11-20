export class ErrorFlujo extends Error {
    codigo;
    constructor(codigo, mensaje, opciones) {
        super(mensaje, opciones);
        this.name = "ErrorFlujo";
        this.codigo = codigo;
    }
}
//# sourceMappingURL=errores.js.map