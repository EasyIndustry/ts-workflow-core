# Cambios

Todas las versiones siguen [semver](https://semver.org/lang/es/). Mientras sea 0.x, una versión menor puede romper; un
parche nunca. Se instalan desde el tag: `npm i github:EasyIndustry/ts-workflow-core#vX.Y.Z`.

## 0.2.0 · Trazabilidad

Todo aditivo: no cambia nada de lo que ya había. Cierra [#1](https://github.com/EasyIndustry/ts-workflow-core/issues/1).

- **`huella(valor)` y `jsonCanonico(valor)`:** SHA-256 (hexadecimal) del JSON canónico de un valor (claves ordenadas,
  sin `undefined`). TypeScript puro y síncrono: sin `node:crypto` ni `crypto.subtle`, anda igual en el navegador.
- **`compararFlujos(antes, despues)`:** compara dos versiones de una definición y clasifica cada cambio como
  `compatible` o `rompe` (se puede pasar de una a otra sin reglas nuevas, o no). Rompe: quitar estados, decisiones o
  transiciones, achicar `desde`, cambiar la acción o el `hacia`, cambiar las ramas de una decisión y endurecer
  `requisitos`. Lo demás es compatible.
- **`compararEsquemas(antes, despues)`:** comparación conservadora de dos JSON Schema (el subconjunto de
  `validarJsonSchema`): compatible si todo lo que aceptaba el viejo lo acepta el nuevo.
- **`compararCapacidades(antes, despues)`:** compara dos registros (capacidades quitadas, con otro tipo o con el schema
  endurecido). Para una definición concreta, la respuesta exacta sigue siendo `validarDefinicion(def, registroNuevo)`.
- **`verificarReferencias(referencias, catalogo, comparar)`:** clasifica referencias `{ clave, revision }` contra un
  catálogo de revisiones en vigentes, actualizables, que rompen y huérfanas.
- **Tipos `Referencia`, `Revisionado<T>` y `EstadoRevision`** (`borrador`, `vigente`, `obsoleta`). Solo tipos: guardar y
  publicar revisiones sigue siendo de la app.
- Códigos de `ErrorFlujo` nuevos: `valor_no_serializable` y `revision_duplicada`.

## 0.1.2

- Política del repo: [`POLITICA.md`](POLITICA.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), plantillas de issue y de PR y
  etiquetas de triage. Sin cambios en el código.

## 0.1.1

- CI: `actions/checkout` y `actions/setup-node` a v7. Sin cambios en el código.

## 0.1.0

- Primera versión: definición (zod y JSON Schema), registro de capacidades, validación del grafo, `evaluar`, `explicar`,
  `simular`, versionado y el ejemplo del taller.
