import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import pathFinderModule from 'geojson-path-finder';
import { featureCollection, lineString, point, toWgs84, length, distance, nearestPointOnLine, simplify, bbox } from '@turf/turf';
import { assertMapDataImport, createJsonFetcher, mapCacheDirectory } from './map-data-source.mjs';
import { extractRouteLines } from './map-network.mjs';

const require = createRequire(import.meta.url);
const PathFinder = pathFinderModule.default ?? pathFinderModule;
const { routesTable, stagesTable, cyclingStagesTable, townsTable } = require('/tmp/ultreia-data-validate/src/data/camino/tables');
const corrections = JSON.parse(await readFile('src/data/camino/mapCorrections.json', 'utf8'));
const cache = mapCacheDirectory;
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getJson = createJsonFetcher({ cacheDirectory: cache });
const overpassEndpoint = process.env.ULTREIA_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const diagnosticRoute = process.env.ULTREIA_MAP_DIAGNOSTIC_ROUTE;
const reuseServices = process.env.ULTREIA_MAP_REUSE_SERVICES === '1';
const selectedRoute = diagnosticRoute ?? process.env.ULTREIA_MAP_ROUTE;
if (selectedRoute && !routesTable.items.some((route) => route.slug === selectedRoute)) throw new Error(`Ruta desconocida: ${selectedRoute}`);
const previousData = selectedRoute && !diagnosticRoute ? JSON.parse(await readFile('src/data/camino/mapData.json', 'utf8')) : undefined;
const serviceData = reuseServices ? previousData ?? JSON.parse(await readFile('src/data/camino/mapData.json', 'utf8')) : undefined;
const knownRelations = {
  'camino-frances': [2163573, 2163937, 2163936],
  'via-de-la-plata': [241329],
  'camino-primitivo': [19298101, 2163559],
  'camino-sanabres': [2164353, 2164354],
  'camino-portugues': [12786090],
  'camino-vasco': [18021078, 6621567],
  'camino-baztanes': [7201036, 2163573],
  'camino-catalan-por-san-juan-de-la-pena': [380796, 2171174, 2164133],
};
const routeConnections = {
  'camino-primitivo': [80340316],
};
const routeData = [];
const stages = [];
const services = new Map();
const failedServiceAreas = [];
const failedRoutes = [];
const missingStages = [];
const extractLines = extractRouteLines;
const findTown = (name, stage, vertices) => {
  const target = normalize(name);
  const corrected = corrections.towns.filter((town) => town.routeSlugs.includes(stage.routeSlug) && normalize(town.title) === target);
  const candidates = corrected.length ? corrected : townsTable.items.filter((town) => town.coordinate && (target.includes(normalize(town.title)) || normalize(town.title).includes(target)));
  return candidates.map((town) => ({ town, nearest: nearestVertex(town.coordinate, vertices) }))
    .filter((candidate) => candidate.nearest)
    .sort((left, right) => {
      const nameRank = (town) => normalize(town.title) === target ? 0 : normalize(town.title).startsWith(target) ? 1 : 2;
      return nameRank(left.town) - nameRank(right.town)
        || distance([left.town.coordinate.longitude, left.town.coordinate.latitude], left.nearest) - distance([right.town.coordinate.longitude, right.town.coordinate.latitude], right.nearest);
    })[0]?.town;
};
const nearestVertex = (coordinate, vertices) => {
  const target = [coordinate.longitude, coordinate.latitude];
  let best = vertices[0];
  let bestDistance = Infinity;
  for (const vertex of vertices) {
    const delta = (target[0] - vertex[0]) ** 2 + (target[1] - vertex[1]) ** 2;
    if (delta < bestDistance) { best = vertex; bestDistance = delta; }
  }
  return distance(target, best) <= 4 ? best : undefined;
};

for (const route of routesTable.items) {
  if (selectedRoute && route.slug !== selectedRoute) continue;
  try {
    const search = knownRelations[route.slug] ? undefined : await getJson(`search-${route.slug}`, `https://hiking.waymarkedtrails.org/api/v1/list/search?query=${encodeURIComponent(route.title)}&limit=8`);
    const match = search?.results?.find((item) => normalize(item.name ?? '') === normalize(route.title)) ?? search?.results?.[0];
    const relationIds = knownRelations[route.slug] ?? (match ? [match.id] : []);
    const relationId = relationIds[0];
    if (!relationId) throw new Error(`Sin relacion: ${route.slug}`);
    const detail = await getJson(`relation-${relationId}`, `https://hiking.waymarkedtrails.org/api/v1/details/relation/${relationId}`);
    const lines = extractLines(detail.route ?? {});
    for (const extraId of relationIds.slice(1)) {
      const extra = await getJson(`relation-${extraId}`, `https://hiking.waymarkedtrails.org/api/v1/details/relation/${extraId}`);
      extractLines(extra.route ?? {}, lines);
    }
    const connectionWayIds = routeConnections[route.slug] ?? [];
    for (const wayId of connectionWayIds) {
      const url = new URL(overpassEndpoint);
      url.searchParams.set('data', `[out:json][timeout:20];way(${wayId});out tags geom;`);
      const response = await getJson(`connection-${wayId}`, url.toString(), { validate: (result) => Array.isArray(result?.elements) });
      const way = response.elements.find((element) => element.type === 'way' && element.id === wayId);
      if (!way?.geometry?.length || way.tags?.access === 'no' || way.tags?.foot === 'no') throw new Error(`Conexion OSM no disponible: ${wayId}`);
      lines.push(lineString(way.geometry.map((coordinate) => [coordinate.lon, coordinate.lat])));
    }
    if (!lines.length) throw new Error(`Sin geometria de origen: ${route.slug}`);
    for (const connection of corrections.connections[route.slug] ?? []) lines.push(lineString(connection.coordinates));
    const network = featureCollection(lines);
    const finder = new PathFinder(network, { tolerance: 0.00002 });
    const vertices = lines.flatMap((line) => line.geometry.coordinates);
    const routeStages = [...stagesTable.items, ...cyclingStagesTable.items].filter((stage) => stage.routeSlug === route.slug);
    let covered = 0;
    for (const stage of routeStages) {
      const start = findTown(stage.startTown, stage, vertices);
      const end = findTown(stage.endTown, stage, vertices);
      const startVertex = start && nearestVertex(start.coordinate, vertices);
      const endVertex = end && nearestVertex(end.coordinate, vertices);
      const viaVertices = (stage.viaTowns ?? []).map((name) => {
        const town = findTown(name, stage, vertices);
        return town && nearestVertex(town.coordinate, vertices);
      });
      const stops = [startVertex, ...viaVertices, endVertex];
      const legs = stops.slice(1).map((vertex, index) => vertex && stops[index] && finder.findPath(point(stops[index]), point(vertex)));
      const path = legs.every((leg) => leg?.path.length > 1) ? { path: legs.flatMap((leg, index) => index ? leg.path.slice(1) : leg.path) } : undefined;
      if (!path || path.path.length < 2) {
        if (diagnosticRoute) console.error(JSON.stringify({ stage: stage.slug, reason: !startVertex || !endVertex ? 'missing_endpoint' : 'disconnected_path', startTown: start?.title, endTown: end?.title, startVertex, endVertex }));
        missingStages.push(stage.slug);
        continue;
      }
      const line = simplify(lineString(path.path), { tolerance: 0.000025, highQuality: true });
      const distanceKm = length(line);
      if (distanceKm < stage.distanceKm * 0.35 || distanceKm > stage.distanceKm * 2) {
        if (diagnosticRoute) console.error(JSON.stringify({ stage: stage.slug, reason: 'distance_mismatch', distanceKm, expectedKm: stage.distanceKm }));
        missingStages.push(stage.slug);
        continue;
      }
      stages.push({ stageSlug: stage.slug, routeSlug: route.slug, relationId, distanceKm: Number(distanceKm.toFixed(3)), coordinates: line.geometry.coordinates.map((coordinate) => coordinate.map((value) => Number(value.toFixed(6)))) });
      covered++;
    }
    const usedConnectionIds = [...new Set([...connectionWayIds, ...(corrections.connections[route.slug] ?? []).map((way) => way.id)])];
    routeData.push({ routeSlug: route.slug, relationId, title: detail.name, ...(usedConnectionIds.length ? { connectionWayIds: usedConnectionIds } : {}), lines: lines.map((line) => simplify(line, { tolerance: 0.00007, highQuality: true }).geometry.coordinates.map((coordinate) => coordinate.map((value) => Number(value.toFixed(6))))) });
    console.log(route.slug, `${covered}/${routeStages.length} etapas`);
  } catch (error) { failedRoutes.push(route.slug); console.error(route.slug, error.message); }
}

if (failedRoutes.length) throw new Error(`Rutas no importadas: ${failedRoutes.join(', ')}. Se conserva el data pack anterior.`);
if (diagnosticRoute) process.exit(stages.length && !missingStages.length ? 0 : 1);

const category = (tags) => ({ drinking_water: 'fuente', pharmacy: 'farmacia', hospital: 'centro_salud', clinic: 'centro_salud', doctors: 'centro_salud', restaurant: 'restaurante', cafe: 'bar', bar: 'bar', atm: 'cajero' }[tags.amenity] ?? { supermarket: 'supermercado', bicycle: 'taller_bici' }[tags.shop] ?? (tags.tourism === 'information' ? 'oficina_turismo' : undefined));
const labels = { fuente: 'Fuente de agua potable', farmacia: 'Farmacia', centro_salud: 'Centro sanitario', restaurante: 'Restaurante', bar: 'Bar / cafeteria', cajero: 'Cajero', supermercado: 'Supermercado', taller_bici: 'Taller de bicicletas', oficina_turismo: 'Informacion turistica' };
const stageLines = stages.map((stage) => ({ ...stage, line: lineString(stage.coordinates), bounds: bbox(lineString(stage.coordinates)) }));
const areas = new Map();
for (const stage of stages) for (const coordinate of stage.coordinates.filter((_, index) => index % 30 === 0)) {
  const west = Math.floor(coordinate[0] * 2) / 2;
  const south = Math.floor(coordinate[1] * 2) / 2;
  areas.set(`${south},${west}`, [south - 0.01, west - 0.01, south + 0.51, west + 0.51]);
}
if (serviceData) {
  const uniqueServices = new Map(serviceData.services.filter((service) => service.coordinate && service.geocoding?.providerUrl).map((service) => [service.geocoding.providerUrl, service]));
  for (const service of uniqueServices.values()) {
    const { latitude, longitude } = service.coordinate;
    const origin = point([longitude, latitude]);
    for (const stage of stageLines) {
      const [west, south, east, north] = stage.bounds;
      if (longitude < west - .018 || longitude > east + .018 || latitude < south - .014 || latitude > north + .014) continue;
      if (nearestPointOnLine(stage.line, origin).properties.dist > 1.2) continue;
      const elementPath = new URL(service.geocoding.providerUrl).pathname.split('/').filter(Boolean);
      const id = `osm:${elementPath[0]}:${elementPath[1]}:${stage.stageSlug}`;
      services.set(id, { ...service, id, routeSlug: stage.routeSlug, stageSlug: stage.stageSlug });
    }
  }
  console.log('Servicios anteriores reasociados:', services.size);
}
for (const [key, bounds] of reuseServices ? [] : areas) {
  try {
    const query = `[out:json][timeout:20][maxsize:67108864];(nwr[amenity~"^(drinking_water|pharmacy|hospital|clinic|doctors|restaurant|cafe|bar|atm)$"](${bounds.join(',')});nwr[shop~"^(supermarket|bicycle)$"](${bounds.join(',')}););out center tags;`;
    const url = new URL(overpassEndpoint);
    url.searchParams.set('data', query);
    const data = await getJson(`pois-${key}`, url.toString(), { validate: (result) => Array.isArray(result?.elements) });
    for (const element of data.elements) {
      const coordinate = { latitude: element.lat ?? element.center?.lat, longitude: element.lon ?? element.center?.lon };
      const type = category(element.tags ?? {});
      if (!type || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) continue;
      const origin = point([coordinate.longitude, coordinate.latitude]);
      for (const stage of stageLines) {
        const [west, south, east, north] = stage.bounds;
        if (coordinate.longitude < west - 0.018 || coordinate.longitude > east + 0.018 || coordinate.latitude < south - 0.014 || coordinate.latitude > north + 0.014) continue;
        if (nearestPointOnLine(stage.line, origin).properties.dist > 1.2) continue;
        const id = `osm:${element.type}:${element.id}:${stage.stageSlug}`;
        services.set(id, { id, slug: `${element.type}-${element.id}`, type, title: element.tags.name ?? labels[type], routeSlug: stage.routeSlug, stageSlug: stage.stageSlug, coordinate, coordinateStatus: 'verified', address: [element.tags['addr:street'], element.tags['addr:housenumber']].filter(Boolean).join(' ') || undefined, phone: element.tags.phone ?? element.tags['contact:phone'], openingHoursText: element.tags.opening_hours, tags: ['openstreetmap'], geocoding: { provider: 'other', fetchedAtIso: new Date().toISOString(), providerUrl: `https://www.openstreetmap.org/${element.type}/${element.id}` }, contentStatus: 'imported' });
      }
    }
    console.log('Servicios', key, services.size);
  } catch (error) {
    failedServiceAreas.push(key);
    console.error('Servicios no importados', key, error.message);
    break;
  }
}
const output = { generatedAt: new Date().toISOString(), attribution: '© OpenStreetMap contributors · ODbL 1.0 · Waymarked Trails', routes: routeData, stages, services: [...services.values()], missingStages };
if (serviceData) output.serviceImport = { mode: 'reassociated_existing', previousDataGeneratedAt: serviceData.generatedAt, refreshed: false };
try {
  assertMapDataImport({ ...output, failedServiceAreas });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (previousData) {
  const replacedSlugs = new Set([...stagesTable.items, ...cyclingStagesTable.items].filter((stage) => stage.routeSlug === selectedRoute).map((stage) => stage.slug));
  output.routes = [...previousData.routes.filter((route) => route.routeSlug !== selectedRoute), ...output.routes];
  output.stages = [...previousData.stages.filter((stage) => stage.routeSlug !== selectedRoute), ...output.stages];
  output.services = [...previousData.services.filter((service) => service.routeSlug !== selectedRoute), ...output.services];
  output.missingStages = [...previousData.missingStages.filter((slug) => !replacedSlugs.has(slug)), ...output.missingStages];
}
await writeFile('src/data/camino/mapData.json', JSON.stringify(output));
console.log(JSON.stringify({ routes: routeData.length, stages: stages.length, services: services.size, missingStages }, null, 2));