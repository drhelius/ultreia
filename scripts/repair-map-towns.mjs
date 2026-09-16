import { readFile, writeFile } from 'node:fs/promises';
import { createJsonFetcher, mapCacheDirectory } from './map-data-source.mjs';

const getJson = createJsonFetcher({ cacheDirectory: mapCacheDirectory });
const endpoint = process.env.ULTREIA_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const bindings = [
  { id: 619210527, title: 'Caparra', routeSlug: 'via-de-la-plata' },
  { id: 3058869638, title: 'Outeiro', routeSlug: 'camino-sanabres' },
  { id: 3071070836, title: 'A Laxe', routeSlug: 'camino-sanabres' },
  { id: 349243890, title: 'Lubian', routeSlug: 'camino-sanabres' },
  { id: 349244924, title: 'El Cubo de la Tierra del Vino', routeSlug: 'via-de-la-plata' },
  { id: 1080509653, title: 'Canaveral', routeSlug: 'via-de-la-plata' },
  { id: 529391484, title: 'Gijon', routeSlug: 'camino-del-norte' },
  { id: 12638528830, title: 'Montserrat', routeSlug: 'camino-catalan-por-san-juan-de-la-pena' },
];
const url = new URL(endpoint);
url.searchParams.set('data', `[out:json][timeout:20];node(id:${bindings.map((town) => town.id).join(',')});out body;`);
const data = await getJson('verified-endpoint-towns-v1', url.toString(), { validate: (value) => Array.isArray(value.elements) });
const file = 'src/data/camino/mapCorrections.json';
const corrections = JSON.parse(await readFile(file, 'utf8'));
const normalize = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
for (const binding of bindings) {
  const node = data.elements.find((element) => element.id === binding.id);
  if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) throw new Error(`Localidad OSM no disponible: ${binding.id}`);
  corrections.towns = corrections.towns.filter((town) => !(town.routeSlugs.includes(binding.routeSlug) && normalize(town.title) === normalize(binding.title)));
  corrections.towns.push({ id: `osm-town:${node.id}`, slug: `osm-town-${node.id}`, title: binding.title, routeSlugs: [binding.routeSlug], stageSlugs: [], coordinate: { latitude: node.lat, longitude: node.lon }, coordinateStatus: 'verified', geocoding: { provider: 'other', fetchedAtIso: new Date().toISOString(), providerUrl: `https://www.openstreetmap.org/node/${node.id}` }, contentStatus: 'curated' });
}
await writeFile(file, JSON.stringify(corrections));
console.log(`Localidades corregidas con fuente OSM: ${bindings.length}`);