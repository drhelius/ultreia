import { readFile, writeFile } from 'node:fs/promises';
const javascript = await readFile(new URL('../node_modules/leaflet/dist/leaflet.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../node_modules/leaflet.markercluster/dist/leaflet.markercluster.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../node_modules/leaflet/dist/leaflet.css', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../node_modules/leaflet.markercluster/dist/MarkerCluster.css', import.meta.url), 'utf8');
await writeFile(new URL('../src/data/camino/mapAssets.json', import.meta.url), JSON.stringify({ javascript, css }));
console.log('Leaflet JS y CSS incluidos para web y movil.');