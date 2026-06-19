import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const generatedAtIso = '2026-06-18T00:00:00.000Z';
const packVersion = '2026.06.18-phase2';
const userAgent = 'UltreiaPrototypeGeocoder/0.1 (local development)';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ');

const slugify = (value) => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-slug';

const parseTable = async (path, exportName) => {
  const source = await readFile(path, 'utf8');
  const marker = `export const ${exportName}`;
  const start = source.indexOf('{', source.indexOf(marker));
  const end = source.lastIndexOf('};');

  if (start === -1 || end === -1) {
    throw new Error(`Cannot parse ${exportName} from ${path}`);
  }

  return JSON.parse(source.slice(start, end + 1));
};

const geocodeTown = async (town) => {
  const query = `${normalize(town)} Spain`;
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
  const data = await response.json();
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    return undefined;
  }

  return {
    coordinate: { latitude: coordinates[1], longitude: coordinates[0] },
    geocoding: {
      provider: 'photon',
      fetchedAtIso: generatedAtIso,
      providerUrl: 'https://photon.komoot.io/api/',
      query,
      placeId: feature.properties?.osm_id ? `${feature.properties.osm_type || 'osm'}:${feature.properties.osm_id}` : undefined,
    },
  };
};

const addTown = (towns, title, routeSlug, stageSlug) => {
  const cleaned = String(title || '').trim();

  if (!cleaned) {
    return;
  }

  const slug = slugify(cleaned);
  const entry = towns.get(slug) || {
    id: `town:${slug}`,
    slug,
    title: cleaned,
    routeSlugs: new Set(),
    stageSlugs: new Set(),
  };

  if (routeSlug) {
    entry.routeSlugs.add(routeSlug);
  }
  if (stageSlug) {
    entry.stageSlugs.add(stageSlug);
  }

  towns.set(slug, entry);
};

const main = async () => {
  const stages = (await parseTable('src/data/camino/tables/stages.ts', 'stagesTable')).items;
  const cyclingStages = (await parseTable('src/data/camino/tables/cyclingStages.ts', 'cyclingStagesTable')).items;
  const hostels = (await parseTable('src/data/camino/tables/hostels.ts', 'hostelsTable')).items;
  const towns = new Map();

  for (const stage of [...stages, ...cyclingStages]) {
    addTown(towns, stage.startTown, stage.routeSlug, stage.slug);
    addTown(towns, stage.endTown, stage.routeSlug, stage.slug);
  }

  for (const hostel of hostels) {
    addTown(towns, hostel.town, hostel.routeSlug, hostel.stageSlug);
  }

  const items = [];
  let processed = 0;
  let verified = 0;

  for (const town of [...towns.values()].sort((left, right) => left.slug.localeCompare(right.slug))) {
    const item = {
      id: town.id,
      slug: town.slug,
      title: town.title,
      routeSlugs: [...town.routeSlugs].sort(),
      stageSlugs: [...town.stageSlugs].sort(),
      coordinateStatus: 'not_available',
      contentStatus: 'curated',
    };

    try {
      const result = await geocodeTown(town.title);
      processed += 1;
      if (result) {
        item.coordinate = result.coordinate;
        item.coordinateStatus = 'verified';
        item.geocoding = result.geocoding;
        verified += 1;
      }
    } catch {
      // Keep town without coordinates rather than writing unverified data.
    }

    items.push(item);

    if (processed % 50 === 0) {
      console.log(`[towns] ${processed} processed, ${verified} verified`);
    }

    await delay(250);
  }

  const table = {
    schemaVersion: '1.0',
    generatedAt: generatedAtIso,
    dataPackVersion: packVersion,
    items,
  };
  const content = `import type { CaminoDataTable, CaminoTown } from '../../../domain';\n\nexport const townsTable: CaminoDataTable<CaminoTown> = ${JSON.stringify(table, null, 2)};\n`;

  await writeFile('src/data/camino/tables/towns.ts', content, 'utf8');
  console.log(JSON.stringify({ towns: items.length, processed, verified }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
