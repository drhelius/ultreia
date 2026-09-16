import { readFile, writeFile } from 'node:fs/promises';
import pathFinderModule from 'geojson-path-finder';
import { featureCollection, lineString, point, length } from '@turf/turf';
import { createJsonFetcher, mapCacheDirectory } from './map-data-source.mjs';
import { extractRouteLines, findNetworkGaps } from './map-network.mjs';

const PathFinder = pathFinderModule.default ?? pathFinderModule;
const getJson = createJsonFetcher({ cacheDirectory: mapCacheDirectory });
const endpoint = process.env.ULTREIA_OVERPASS_URL ?? 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const dataPath = 'src/data/camino/mapCorrections.json';
const corrections = JSON.parse(await readFile(dataPath, 'utf8'));
const selectedRoute = process.env.ULTREIA_MAP_ROUTE;
const maxGapKm = Number(process.env.ULTREIA_MAP_MAX_GAP_KM ?? '1');
const townNodes = [
  { id: 768282714, title: 'Sarria', routeSlugs: ['camino-frances'] },
  { id: 766653704, title: 'Triacastela', routeSlugs: ['camino-frances'] },
  { id: 495953502, title: 'Sobrado dos Monxes', routeSlugs: ['camino-del-norte'] },
  { id: 475763054, title: 'Cea', routeSlugs: ['camino-sanabres'] },
  { id: 617809758, title: 'Laza', routeSlugs: ['camino-sanabres'] },
  { id: 286179589, title: 'Muxia', routeSlugs: ['epilogo-a-fisterra-y-muxia'] },
  { id: 196006930, title: 'Jaca', routeSlugs: ['camino-frances'] },
  { id: 27552541, title: 'Zerain', routeSlugs: ['camino-vasco'] },
  { id: 288260314, title: 'Queveda', routeSlugs: ['camino-del-norte'] },
  { id: 1235110932, title: 'A Coruna', routeSlugs: ['camino-ingles'] },
  { id: 1690923675, title: 'Bayona', routeSlugs: ['camino-baztanes'] },
  { id: 1826708933, title: 'Ustaritz', routeSlugs: ['camino-baztanes'] },
  { id: 1470838412, title: 'Igualada', routeSlugs: ['camino-catalan-por-san-juan-de-la-pena'] },
  { id: 312163949, title: 'La Panadella', routeSlugs: ['camino-catalan-por-san-juan-de-la-pena'] },
];
if (!process.argv.includes('--connections-only')) {
const townUrl = new URL(endpoint);
townUrl.searchParams.set('data', `[out:json][timeout:20];node(id:${townNodes.map((town) => town.id).join(',')});out body;`);
const townData = await getJson('audit-corrected-town-nodes', townUrl.toString(), { validate: (value) => Array.isArray(value.elements) });
corrections.towns = townNodes.map((town) => {
  const node = townData.elements.find((element) => element.id === town.id);
  if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) throw new Error(`Localidad OSM no disponible: ${town.id}`);
  return { id: `osm-town:${town.id}`, slug: `osm-town-${town.id}`, title: town.title, routeSlugs: town.routeSlugs, stageSlugs: [], coordinate: { latitude: node.lat, longitude: node.lon }, coordinateStatus: 'verified', geocoding: { provider: 'other', fetchedAtIso: new Date().toISOString(), providerUrl: `https://www.openstreetmap.org/node/${node.id}` }, contentStatus: 'curated' };
});
await writeFile(dataPath, JSON.stringify(corrections));
if (process.argv.includes('--towns-only')) process.exit(0);
}
const sources = {
  'camino-frances': [2163573, 2163937, 2163936], 'camino-primitivo': [19298101, 2163559],
  'via-de-la-plata': [241329], 'camino-del-norte': [19001007], 'camino-sanabres': [2164353, 2164354],
  'camino-vasco': [18021078, 6621567], 'camino-baztanes': [7201036], 'camino-ingles': [1102966],
  'epilogo-a-fisterra-y-muxia': [385098],
};
for (const [routeSlug, relationIds] of Object.entries(sources)) {
  if (selectedRoute && routeSlug !== selectedRoute) continue;
  const lines = [];
  for (const relationId of relationIds) extractRouteLines((await getJson(`relation-${relationId}`, `https://hiking.waymarkedtrails.org/api/v1/details/relation/${relationId}`)).route, lines);
  for (const connection of corrections.connections[routeSlug] ?? []) lines.push(lineString(connection.coordinates));
  const finder = new PathFinder(featureCollection(lines), { tolerance: .00002 });
  const { componentCount, gaps } = findNetworkGaps(finder.graph, maxGapKm);
  console.log(routeSlug, { componentCount, gaps: gaps.length });
  const connections = new Map((corrections.connections[routeSlug] ?? []).map((way) => [way.id, way]));
  for (const gap of gaps) {
    try {
      const latitude = (gap.start[1] + gap.end[1]) / 2; const longitude = (gap.start[0] + gap.end[0]) / 2;
      const url = new URL(endpoint);
      const radius = Math.max(250, Math.ceil(gap.gapKm * 2000));
      url.searchParams.set('data', `[out:json][timeout:20];(way[highway](around:${radius},${latitude},${longitude});way[route=ferry](around:${radius},${latitude},${longitude}););out tags geom;`);
      const response = await getJson(`gap-${radius}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`, url.toString(), { validate: (value) => Array.isArray(value.elements) });
      const ways = response.elements.filter((way) => way.geometry?.length > 1 && !['no', 'private'].includes(way.tags?.access) && way.tags?.foot !== 'no' && !['motorway', 'motorway_link', 'construction', 'proposed'].includes(way.tags?.highway) && (!['trunk', 'trunk_link'].includes(way.tags?.highway) || way.tags?.foot === 'yes'));
      const local = new PathFinder(featureCollection(ways.map((way) => lineString(way.geometry.map((coordinate) => [coordinate.lon, coordinate.lat])))), { tolerance: .00002 });
      const path = local.findPath(point(gap.start), point(gap.end));
      if (!path || path.path.length < 2 || length(lineString(path.path)) > Math.max(.3, gap.gapKm * 4)) continue;
      const pathKeys = new Set(path.path.map((coordinate) => coordinate.join(',')));
      for (const way of ways) {
        if (!way.geometry.some((coordinate) => pathKeys.has([coordinate.lon, coordinate.lat].join(',')))) continue;
        connections.set(way.id, { id: way.id, sourceUrl: `https://www.openstreetmap.org/way/${way.id}`, fetchedAt: new Date().toISOString(), coordinates: way.geometry.map((coordinate) => [coordinate.lon, coordinate.lat]) });
      }
      console.log('Conexion real', routeSlug, `${Math.round(gap.gapKm * 1000)}m`, connections.size);
    } catch (error) { console.error('Conexion pendiente:', routeSlug, error.message); }
  }
  corrections.connections[routeSlug] = [...connections.values()];
  await writeFile(dataPath, JSON.stringify(corrections));
}