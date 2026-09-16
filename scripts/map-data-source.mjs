import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const mapCacheDirectory = process.env.ULTREIA_MAP_CACHE_DIR ?? join(homedir(), '.cache', 'ultreia', 'map-data');

export const createJsonFetcher = ({ cacheDirectory, fetchImpl = fetch, timeoutMs = 30000 }) => async (key, url, options = {}) => {
  const { validate = () => true, ...requestOptions } = options;
  const cachePath = `${cacheDirectory}/${key}.json`;
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
    if (!cached.remark && validate(cached)) return cached;
  } catch {}

  let response;
  try {
    response = await fetchImpl(url, {
      ...requestOptions,
      headers: { 'User-Agent': 'Ultreia/1.0 (Camino de Santiago offline guide data importer)', ...requestOptions.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`No se pudo descargar ${url}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`, { cause: error });
  }
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(`HTTP ${response.status}: ${url}${detail ? `: ${detail}` : ''}`);
  }
  const result = await response.json();
  if (result.remark) throw new Error(`Respuesta incompleta de ${url}: ${result.remark}`);
  if (!validate(result)) throw new Error(`Respuesta inesperada de ${url}`);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cachePath, JSON.stringify(result));
  return result;
};

export const assertMapDataImport = ({ stages, services, failedServiceAreas }) => {
  if (!stages.length) throw new Error('No se ha podido importar ninguna etapa. Se conserva el data pack anterior.');
  if (failedServiceAreas.length || !services.length) {
    throw new Error(`Importacion incompleta: ${services.length} servicios, ${failedServiceAreas.length} zonas fallidas. Se conserva el data pack anterior.`);
  }
};