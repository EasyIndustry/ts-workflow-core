# Contribuir

Varias apps instalan este core. Lo que entra acá lo reciben todas, así que la pregunta antes de cada
cambio no es «¿le sirve a la app que lo pidió?» sino «¿le sirve a cualquier app con entidades que
tienen un ciclo de vida configurable?».

**Primero, [`POLITICA.md`](POLITICA.md):** qué entra, cómo se evalúa un pedido y qué puede pasar con
él. Un pedido de una app de casa pasa por el mismo filtro que uno de afuera.

## Cómo proponer

1. **Abrí un issue** con la plantilla *Pedido* (algo que el core no hace) o *Error* (algo que
   promete y no cumple). Contá la necesidad, no solo la solución, y a qué otro dominio le serviría.
2. **Antes de enviarlo**, chequeá:
   - ¿sirve fuera de tu app?
   - ¿se puede resolver registrando una capacidad, escribiendo una definición o armando el contexto
     en tu app, en vez de tocar el core?
   - ¿no tiene nombres de clientes, de productos ni de sistemas internos? Si los tiene, reformulalo
     como dice [POLITICA.md](POLITICA.md#cómo-reformular-un-pedido-específico).
3. **Un PR, mejor después de un issue `aceptado`.** Un PR sin issue se revisa igual, pero primero
   contra la política y después contra el código.

## Cómo se revisa

Cada issue entra con `triage`. Quien mantiene el repo lo pasa por el filtro de la política, en
orden, y deja una respuesta con el motivo:

1. **La necesidad:** qué problema hay detrás del pedido.
2. **¿Se resuelve en la app?** Si alcanza con una capacidad, una definición o el contexto, se
   responde con el cómo y se cierra como `sin-cambios`.
3. **¿Le sirve a otro dominio?** Si no, `fuera-de-alcance`, con dónde resolverlo.
4. **¿Se puede generalizar?** Si la necesidad es general pero el pedido trae nombres o reglas de una
   app, se reescribe en el issue como herramienta general (`generalizar`) y después pasa a
   `aceptado`.
5. **¿Respeta el modelo?** Las cuatro reglas del diseño y el contrato de abajo.

Un PR se revisa con la misma lista y con la plantilla de PR, que repite el contrato.

## El contrato

Lo que sigue lo hacen cumplir las pruebas o el CI:

1. **Puro y sin IO.** Nada en `src/` lee ni escribe base, red, archivos o reloj. La app carga el
   contexto, persiste y ejecuta los efectos.
2. **Una sola dependencia, `zod`, y nada de Node.** `test/limites.test.ts` es una lista blanca de
   imports, y `tsconfig.json` compila `src/` con `types: []`.
3. **Vocabulario cerrado.** Quien configura combina capacidades registradas; no hay código ni
   expresiones libres en una definición.
4. **El flujo restringe; nunca habilita.** Nada de lo que se configure puede abrir algo que el código
   de la app cierra.
5. **Las versiones publicadas no cambian.** Cada instancia se evalúa con la suya.
6. **Sin nombres propios** en el código, los tests ni los ejemplos.
7. **Nada entra sin su prueba.** La cobertura tiene mínimos en `vitest.config.ts`.
8. **Mensajes en castellano**, con la ruta del problema cuando la hay.

Lo que cuenta como **cambio que rompe**: cambiar o quitar una función, un tipo o un campo exportado;
cambiar el formato de la definición de forma que una definición válida deje de serlo; cambiar lo que
devuelve `evaluar` para la misma entrada. Agregar una función, un campo opcional o un código de
error nuevo no rompe.

## Cómo se agrega algo

1. El cambio en `src/`, con su prueba en `test/`.
2. Exportado desde `src/index.ts` si es API pública.
3. `README.md` y `docs/diseno.md` al día. Si cambia lo que se ve en el ejemplo, también
   `ejemplos/taller/`, que corre en `test/ejemplos.test.ts`.
4. Antes del PR:

   ```bash
   npm run typecheck
   npm run test:cobertura
   npm run ejemplo
   npm run build   # y commiteá dist/: el CI falla si no coincide con el build
   ```
