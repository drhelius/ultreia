# Ultreia

Prototype React Native + Expo app for planning and tracking a gamified Camino de Santiago adventure.

## Scripts

- `npm install`
- `npm run start`
- `npm run typecheck`
- `npm run foundry:gateway`

## Prototype scope

This prototype includes:

- itinerary planning by duration, transport, and interests
- live journey tracking with GPS/runtime signals
- POI-driven rerouting
- Foundry agents for planner, director, and chat through a local gateway
- quests, rewards, and photo-sharing prompts

## Specs

- [Ultreia specs](docs/specs/README.md)

## Demostracion de turismo

1. Ejecutar `npm run foundry:gateway` y, en otro terminal, `npm run web -- --port 8091`.
2. Abrir `http://localhost:8091` y completar los seis pasos del perfilado: nombre, modo, clases, dias, objetivo y presupuesto. Pulsar **Ver recomendaciones** desde presupuesto: aparece la carga antes del calculo local y la llamada a Foundry. No hay acceso rapido de demostracion ni paso extra de preferencias. En el paso 7, comparar rutas sobre un mapa real con destinos numerados y trazados amarillos, sin leyenda de progreso. Una instalacion con Camino activo lo conserva; para ensayar un perfil nuevo sin borrarlo, usar una ventana privada.
3. En Mapa, abrir el panel del matraz e iniciar simulacion. Se puede pausar, elegir 1x/5x/20x o saltar al siguiente hito del 25%. Los multiplicadores son de presentacion, no velocidades fisicas.
4. Revisar los avisos con la campana: los del director real llevan la marca **IA / Foundry**. El motor realiza una primera consulta de contexto y despues revisiones cada 30 minutos reales (GPS) o 30 minutos de recorrido simulado. Nunca inicia dos peticiones con menos de 30 segundos reales entre ellas, incluidos saltos del simulador, reintentos y **Pedir aviso IA**. En caso de fallo se permiten hasta dos reintentos con ese mismo limite; el contador muestra cuando vuelve a estar disponible.
5. Probar el chat desde el icono de conversacion. Al llegar, cerrar etapa y confirmar: se guarda el diario, se concede progreso y se activa la siguiente etapa.
6. Editar el diario, registrar gastos en Perfil y abrir la credencial. SOS incluye recursos sanitarios y reportes locales; la llamada al 112 es real y nunca debe usarse durante un ensayo.

La demo usa rutas y POIs reales con posiciones explicitamente simuladas. Los hitos locales conviven con recomendaciones reales del director de Foundry, que sigue activo al simular y no bloquea el movimiento. Planner, director y chat requieren el gateway y cuota disponible en Azure. Sus contextos se acotan a informacion relevante para reducir latencia y consumo. El clima procede de Open-Meteo y su indisponibilidad no bloquea el avance. El historial, los gastos y el diario persisten en SQLite en movil y localStorage en web.

La ubicacion GPS se inicia automaticamente al entrar en live, con permiso del sistema, y sigue actualizandose aunque el recorrido este sin iniciar o en pausa. `Iniciar recorrido` controla la grabacion, no el encendido del GPS. La simulacion sustituye la posicion real y crea inmediatamente su muestra de kilometro cero; funciona sin permiso de GPS. El director espera a tener ubicacion antes de consultar y no se generan tareas de "registrar GPS" ni de tomar muestras para la ETA. Los recordatorios antiguos se ocultan sin borrar el historial. Los fallos reales de permiso se muestran como estado de ubicacion, no como recomendaciones.

El director recibe lugares concretos (`nearbyPlaces`) y un resumen de recomendaciones del dia local (`recommendationHistory`, hasta 20 mensajes y 128 claves estables). El filtro local compara contra todo el historial del dia de ese Camino, tambien entre etapas, y elimina duplicados dentro de la respuesta. El prompt publicado se actualiza manualmente siguiendo [los cambios para ultreia-director](foundry/agents/ultreia-director-changes.md); este cambio de app no lo modifica en Foundry. Se conserva la excepcion de prioridad critica con evidencia suficiente, y la deteccion de similitud no garantiza reconocer todas las parafrasis.

Para mantener novedades en las siguientes etapas, el contexto incluye `stageHighlights` culturales y del recorrido, lugares marcados como ya mencionados y `contentBrief` con IDs nuevos. Las etapas ciclistas heredan contenido de las etapas a pie coincidentes con su trazado. El filtro no equipara lugares distintos solo por un titulo o clave genericos. Cada ciclo de IA registra los consejos recibidos, publicados y filtrados, para distinguir una respuesta vacia del agente de un descarte local. El apartado final de las instrucciones de Foundry habilita expresamente el papel de acompanante cultural.

### Contexto del chat

Cada turno del chat envia la conversacion completa y metadata estructurada, separada de los mensajes visibles: posicion real o simulada, fecha/zona horaria, estado y progreso de etapa, itinerario, presupuesto, preferencias, clima disponible con su evidencia, contenido cultural y recomendaciones. `tracking.distanceScope` indica que los kilometros corresponden a la etapa activa, no necesariamente al total del dia.

La conversacion incluye todos los mensajes de usuario y asistente, sin limitarla a los ultimos turnos, y la pantalla permite consultar todo ese historial. `Limpiar` elimina los mensajes persistidos de ese chat y el texto pendiente de enviar; el siguiente turno contiene solo el nuevo mensaje. Si una peticion anterior sigue en curso, su respuesta se ignora y no repuebla el chat. El perfil, la posicion y el estado del Camino siguen disponibles como contexto estructurado, pero no se recupera el intercambio borrado.

`serviceSearch` consulta la base local completa, no solo la etapa ni los ocho POIs de tracking: hasta tres resultados por categoria en un radio de 20 km, ordenados por distancia y sin duplicar asociaciones del mismo lugar a varias etapas. Incluye farmacias, centros sanitarios, agua, comida y demas categorias, con nombre, coordenadas, distancia en linea recta, direccion, telefono y horario cuando constan. Sus contadores explicitan el alcance y la cobertura parcial. Sin posicion se marca `location_unavailable`, sin inventar cercania. Los datos del catalogo no confirman apertura ni disponibilidad actuales.

Si el turno pregunta por una categoria reconocida, `serviceSearch.places` prioriza solo esas categorias y envia `requestedTypes`, `requestedMatches`, `requestedStatus` y `origin`. Asi se distingue la ausencia de resultados de la ausencia de lugares en el resumen de 2 km. Comprobado con las coordenadas simuladas 42.51837, -5.76533 (Villadangos del Paramo): 61 farmacias registradas dentro de 20 km, con la mas proxima del catalogo a 11,28 km. La respuesta real del chat identifico las opciones aun conservando una respuesta negativa anterior en la conversacion.

El prompt actual de ultreia-chat admite estos campos dentro de `context`. Para aprovecharlos de forma consistente, anadir en Foundry:

```text
- La app ya consulta la base local en cada turno. Para farmacias u otros servicios revisa context.serviceSearch.places y categories, no solo nearby. No propongas esperar a una futura herramienta si los resultados ya estan presentes.
- Respeta radiusKm, coverage y status: la lista contiene hasta tres lugares por categoria en 20 km. Un resultado a varios kilometros no esta al lado; sin coincidencias, indica el limite del catalogo y del radio consultado, no que no existe ese servicio.
- Responde con nombres concretos, distancias en linea recta y datos de contacto cuando consten. No inventes tiempos de desvio, apertura ni disponibilidad.
- El contexto actual prevalece sobre posiciones y resultados antiguos de conversation. tracking.simulated no representa esfuerzo fisico real y distanceScope indica a que recorrido corresponden los kilometros.
- Usa tambien stageDetails, journey, weather y budget cuando sean pertinentes. No vuelques el JSON ni los nombres de campos al usuario: transforma los datos en una respuesta practica.
```

Verificado con el agente real desde Jacques de Molay, Terradillos: tras preguntar por lugares cercanos y despues por farmacias, identifico J.L. Vazquez a 11,56 km y el centro sanitario de Sahagun; los metadatos no se guardaron como mensajes de conversacion. Esto verifica el caso del catalogo importado, no la actualidad de esos establecimientos.

### Datos y mapas

- Trazas: OpenStreetMap / Waymarked Trails, ODbL 1.0. Servicios adicionales: OpenStreetMap, con enlace al elemento original. Horarios y disponibilidad no se garantizan.
- Mapa MVP: Leaflet y MarkerCluster incluidos localmente, con teselas OpenStreetMap y opcion OpenTopoMap. No requiere clave de Google; las teselas necesitan conexion y no se descargan masivamente para uso offline.
- El mapa abre mostrando la campana completa y los destinos numerados de sus etapas. Verde indica completada, dorado actual y gris futura. Tocar un destino abre su detalle y permite encuadrar ese tramo sin cambiar el viaje activo; los destinos cercanos se agrupan al alejar el zoom.
- El catalogo tiene 248 trazados: 240 etapas superan la auditoria, ocho requieren revision y dos siguen sin geometria. La precision del resto se ha pospuesto para priorizar la demo. El planner solo recibe candidatos cuyas etapas estan verificadas y conectadas; la seleccion de IA se contrasta con ese catalogo antes de mostrarla o guardarla. Las rutas personalizadas siguen conexiones reales y no intercalan ramales por su numero de etapa.
- En Grado, la relacion importada omitia la conexion de la rotonda N-634. El importador incluye su geometria real desde [OpenStreetMap, via 80340316](https://www.openstreetmap.org/way/80340316), registrada en `connectionWayIds`. `ULTREIA_MAP_ROUTE=camino-primitivo` regenera solo esa ruta conservando las demas; `ULTREIA_MAP_DIAGNOSTIC_ROUTE=camino-primitivo` comprueba continuidad sin modificar el data pack.
- `npm run data:build-map` regenera geometria y servicios. `ULTREIA_OVERPASS_URL` permite elegir una instancia publica. Se usa cache persistente en `~/.cache/ultreia/map-data` (configurable con `ULTREIA_MAP_CACHE_DIR`). Los proveedores publicos pueden devolver timeout/429/504: una descarga fallida no sobrescribe el data pack. `ULTREIA_MAP_REUSE_SERVICES=1` reutiliza POIs ya importados y los reasocia por coordenadas; no equivale a refrescar sus datos.
- `npm run data:build-map-assets` actualiza la copia local de las bibliotecas del mapa.
- Para un telefono, configurar `EXPO_PUBLIC_AI_GATEWAY_BASE_URL` y `EXPO_PUBLIC_WEATHER_GATEWAY_BASE_URL` con la IP accesible del servidor, no localhost. Las credenciales Foundry solo residen en el servidor.

### Comprobaciones

`npm run typecheck`, `npm run test:map-data`, `npm run test:demo` y `npm run data:audit-map`. El informe de auditoria detalla las 250 etapas en [map-audit.json](docs/specs/02-live/map-audit.json).

Ensayo real comprobado el 2026-09-16: perfil ciclista/cultural de siete dias, planner Foundry, ruta personalizada Irun-Comillas, simulacion al 25%, dos avisos reales del director y respuesta del chat con etapa/progreso. Las pruebas de reloj cubren intervalos de 30 minutos, limite de 30 segundos, pausas, saltos, cambios de etapa y reintentos.

Las notificaciones de esta demo son avisos dentro de la app, no push del sistema. GPS continuo funciona en primer plano. La credencial QR es un registro local, no una acreditacion oficial. El hardening de produccion queda fuera de este incremento.
