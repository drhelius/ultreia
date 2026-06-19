import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const generatedAtIso = '2026-06-18T00:00:00.000Z';
const cachePath = 'src/data/camino/geocoding-cache.json';

const tableFiles = {
  hostels: {
    path: 'src/data/camino/tables/hostels.ts',
    exportName: 'hostelsTable',
  },
  monuments: {
    path: 'src/data/camino/tables/monuments.ts',
    exportName: 'monumentsTable',
  },
  services: {
    path: 'src/data/camino/tables/services.ts',
    exportName: 'servicesTable',
  },
  stagePoints: {
    path: 'src/data/camino/tables/stagePoints.ts',
    exportName: 'stagePointsTable',
  },
  towns: {
    path: 'src/data/camino/tables/towns.ts',
    exportName: 'townsTable',
  },
};

const userAgent = 'UltreiaPrototypeGeocoder/0.1 (local development)';
const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;

const fetchJson = async (url, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    const contentType = response.headers.get('content-type') || '';

    if (response.ok && contentType.includes('application/json')) {
      return response.json();
    }

    if (attempt < retries) {
      await delay(1000 * (attempt + 1));
      continue;
    }

    return undefined;
  }

  return undefined;
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));

  return {
    dryRun: args.has('--dry-run'),
    limit: [...args].find((arg) => arg.startsWith('--limit='))?.split('=')[1],
    provider: [...args].find((arg) => arg.startsWith('--provider='))?.split('=')[1],
    includeStagePointGeocoding: args.has('--include-stage-point-geocoding'),
    overwriteVerified: args.has('--overwrite-verified'),
  };
};

const parseTable = async ({ path, exportName }) => {
  const source = await readFile(path, 'utf8');
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Cannot find ${exportName} in ${path}`);
  }

  const equalsIndex = source.indexOf('=', markerIndex);
  const objectStart = source.indexOf('{', equalsIndex);
  const objectEnd = source.lastIndexOf('};');

  if (equalsIndex === -1 || objectStart === -1 || objectEnd === -1) {
    throw new Error(`Cannot parse table ${path}`);
  }

  return {
    path,
    exportName,
    before: source.slice(0, equalsIndex + 1),
    value: JSON.parse(source.slice(objectStart, objectEnd + 1)),
  };
};

const writeTable = async (table) => {
  const body = JSON.stringify(table.value, null, 2);
  await writeFile(table.path, `${table.before} ${body};\n`, 'utf8');
};

const readCache = async () => {
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {
    return {
      schemaVersion: '1.0',
      generatedAt: generatedAtIso,
      entries: {},
    };
  }
};

const writeCache = async (cache) => {
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ');

const compactQuery = (...parts) => parts.map(normalize).filter(Boolean).join(' ');

const geocodeWithGoogle = async (query) => {
  if (!googleKey) {
    return undefined;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', googleKey);
  url.searchParams.set('language', 'es');

  const data = await fetchJson(url);

  if (!data) {
    throw new Error('Google geocoding returned no JSON response');
  }

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google geocoding failed: ${data.status}`);
  }

  const result = data?.results?.[0];

  if (!result?.geometry?.location) {
    return undefined;
  }

  return {
    coordinate: {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    },
    geocoding: {
      provider: 'google_geocoding',
      fetchedAtIso: generatedAtIso,
      providerUrl: 'https://maps.googleapis.com/maps/api/geocode/json',
      query,
      placeId: result.place_id,
    },
    raw: {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      locationType: result.geometry.location_type,
    },
  };
};

const geocodeWithPhoton = async (query) => {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

  const data = await fetchJson(url);
  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    return undefined;
  }

  return {
    coordinate: {
      latitude: coordinates[1],
      longitude: coordinates[0],
    },
    geocoding: {
      provider: 'photon',
      fetchedAtIso: generatedAtIso,
      providerUrl: 'https://photon.komoot.io/api/',
      query,
      placeId: feature.properties?.osm_id ? `${feature.properties.osm_type || 'osm'}:${feature.properties.osm_id}` : undefined,
    },
    raw: {
      properties: feature.properties,
    },
  };
};

const geocodeWithNominatim = async (query) => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const data = await fetchJson(url);
  const result = data?.[0];

  if (!result?.lat || !result?.lon) {
    return undefined;
  }

  return {
    coordinate: {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    },
    geocoding: {
      provider: 'nominatim',
      fetchedAtIso: generatedAtIso,
      providerUrl: 'https://nominatim.openstreetmap.org/search',
      query,
      placeId: result.place_id ? String(result.place_id) : undefined,
    },
    raw: {
      displayName: result.display_name,
      osmType: result.osm_type,
      osmId: result.osm_id,
      category: result.category,
      type: result.type,
    },
  };
};

const geocode = async (query, provider) => {
  if (provider === 'google') {
    return geocodeWithGoogle(query);
  }
  if (provider === 'nominatim') {
    return geocodeWithNominatim(query);
  }
  if (provider === 'photon') {
    return geocodeWithPhoton(query);
  }

  if (googleKey) {
    return geocodeWithGoogle(query);
  }

  return geocodeWithPhoton(query);
};

const cacheKey = (provider, query) => `${provider || (googleKey ? 'google' : 'photon')}::${query}`;

const geocodeEntity = async ({ entity, query, provider, cache }) => {
  const key = cacheKey(provider, query);

  if (cache.entries[key]?.result) {
    return { ...cache.entries[key], cached: true };
  }

  let result;
  try {
    result = await geocode(query, provider);
  } catch (error) {
    if (provider === 'google') {
      throw error;
    }

    result = undefined;
  }
  const entry = {
    query,
    provider: result?.geocoding.provider || provider || (googleKey ? 'google_geocoding' : 'photon'),
    fetchedAtIso: generatedAtIso,
    entityId: entity.id,
    result: result || null,
  };

  cache.entries[key] = entry;
  return entry;
};

const applyCoordinate = (entity, geocodingEntry) => {
  const result = geocodingEntry.result;

  if (!result?.coordinate) {
    entity.coordinateStatus = 'not_available';
    delete entity.coordinate;
    delete entity.geocoding;
    return false;
  }

  entity.coordinate = result.coordinate;
  entity.coordinateStatus = 'verified';
  entity.geocoding = result.geocoding;
  return true;
};

const buildHostelQuery = (hostel) => compactQuery(hostel.title, hostel.address, hostel.town, 'Spain');

const buildMonumentQuery = (monument) => compactQuery(monument.title, monument.stageSlug?.replaceAll('-', ' '), 'Spain');

const buildStagePointQuery = (point) => compactQuery(point.title, point.stageSlug?.replaceAll('-', ' '), 'Spain');

const buildTownQuery = (town) => compactQuery(town.title, 'Spain');

const indexBySlug = (items) => {
  const map = new Map();
  for (const item of items) {
    if (item.slug && item.coordinateStatus === 'verified' && item.coordinate) {
      map.set(item.slug, item);
    }
  }
  return map;
};

const copyCoordinate = (target, source) => {
  target.coordinate = source.coordinate;
  target.coordinateStatus = source.coordinateStatus;
  target.geocoding = source.geocoding;
};

const main = async () => {
  const args = parseArgs();
  const limit = args.limit ? Number(args.limit) : undefined;
  const provider = args.provider;
  const cache = await readCache();
  const hostels = await parseTable(tableFiles.hostels);
  const monuments = await parseTable(tableFiles.monuments);
  const services = await parseTable(tableFiles.services);
  const stagePoints = await parseTable(tableFiles.stagePoints);
  const towns = await parseTable(tableFiles.towns);
  let processed = 0;
  let verified = 0;

  const geocodeItems = async (items, buildQuery, label) => {
    for (const entity of items) {
      if (entity.coordinateStatus === 'verified' && entity.coordinate && !args.overwriteVerified) {
        continue;
      }

      if (limit !== undefined && processed >= limit) {
        return;
      }

      const query = buildQuery(entity);
      if (!query) {
        entity.coordinateStatus = 'not_available';
        continue;
      }

      const entry = await geocodeEntity({ entity, query, provider, cache });
      processed += 1;
      if (applyCoordinate(entity, entry)) {
        verified += 1;
      }

      if (processed % 50 === 0) {
        console.log(`[geocode] ${processed} processed, ${verified} verified (${label})`);
        await writeCache(cache);
      }

      if (!entry.cached) {
        await delay(provider === 'nominatim' ? 1100 : 300);
      }
    }
  };

  await geocodeItems(hostels.value.items, buildHostelQuery, 'hostels');
  await geocodeItems(monuments.value.items, buildMonumentQuery, 'monuments');
  await geocodeItems(towns.value.items, buildTownQuery, 'towns');

  const hostelsBySlug = indexBySlug(hostels.value.items);
  const monumentsBySlug = indexBySlug(monuments.value.items);

  for (const service of services.value.items) {
    const sourceId = service.id.replace(/^service:/, '');
    const source = service.type === 'albergue'
      ? hostels.value.items.find((hostel) => hostel.id === sourceId)
      : monuments.value.items.find((monument) => monument.id === sourceId);

    if (source?.coordinateStatus === 'verified') {
      copyCoordinate(service, source);
    } else if (service.coordinateStatus === 'pending') {
      service.coordinateStatus = 'not_available';
    }
  }

  for (const point of stagePoints.value.items) {
    const source = hostelsBySlug.get(point.slug) || monumentsBySlug.get(point.slug);
    if (source) {
      copyCoordinate(point, source);
      continue;
    }

    if (args.includeStagePointGeocoding && (point.type === 'monumento' || point.type === 'servicio')) {
      const query = buildStagePointQuery(point);
      const entry = await geocodeEntity({ entity: point, query, provider, cache });
      processed += 1;
      if (applyCoordinate(point, entry)) {
        verified += 1;
      }
      await delay(provider === 'nominatim' ? 1100 : 120);
    }
  }

  await writeCache(cache);

  if (!args.dryRun) {
    await Promise.all([writeTable(hostels), writeTable(monuments), writeTable(services), writeTable(stagePoints), writeTable(towns)]);
  }

  console.log(JSON.stringify({ processed, verified, dryRun: args.dryRun, provider: provider || (googleKey ? 'google' : 'photon') }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
