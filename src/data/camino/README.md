# Camino Data Pack

Data pack hardcodeado de Ultreia. Es la fuente de verdad del prototipo para rutas, etapas, albergues, monumentos, servicios, campanas y contenido derivado.

## Reglas

- La app consume estos datos mediante `StaticCaminoDataRepository`.
- Los componentes no deben importar tablas directamente.
- No hay datos de negocio inventados para pintar pantallas.
- Las coordenadas GPS no se inventan.
- Si una entidad no tiene coordenadas desde una fuente trazable, omite `coordinate` y usa `coordinateStatus: 'pending'`.
- Para rellenar coordenadas en el futuro, usar un proveedor verificable como Google Geocoding/Places y guardar `geocoding` con proveedor, query, fecha y `placeId` si existe.
- El script `scripts/geocode-camino-data.mjs` rellena coordenadas verificadas con `geocoding` y cache local ignorado por git.
- El geocoding actual usa Google Geocoding como fuente principal: 1193 albergues, 58 monumentos, 1251 servicios, 372 puntos de etapa y 727 localidades quedaron verificados. El resto permanece sin coordenada usable o pendiente cuando el punto de etapa es ambiguo.

## Comandos

```bash
npm run data:geocode
npm run data:validate
```
