## Qué cambia y por qué

<!-- Qué problema resuelve y para qué dominios. -->

Cierra #

## Política

- [ ] Viene de un issue `aceptado` (o es un error).
- [ ] Es una herramienta general, no la solución de una app ([POLITICA.md](../POLITICA.md)).
- [ ] No se podía resolver registrando una capacidad, con una definición o con el contexto de la app.
- [ ] Sin nombres de clientes, productos ni sistemas internos (código, tests, ejemplos).

## Contrato

- [ ] `src/` sigue puro: sin IO, sin Node, solo `zod`.
- [ ] Respeta las reglas del diseño: vocabulario cerrado, el flujo restringe, versiones fijas.
- [ ] Tiene sus pruebas; `npm run typecheck`, `npm run test:cobertura` y `npm run ejemplo` pasan.
- [ ] `dist/` regenerado con `npm run build`.
- [ ] README y `docs/diseno.md` al día.
- [ ] Lo que andaba sigue andando, o la ruptura está dicha con cómo migrar.
