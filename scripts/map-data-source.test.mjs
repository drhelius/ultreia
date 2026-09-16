import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertMapDataImport, createJsonFetcher } from './map-data-source.mjs';

const withFetcher = async (context, fetchImpl) => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'ultreia-map-test-'));
  context.after(() => rm(cacheDirectory, { recursive: true, force: true }));
  return { cacheDirectory, getJson: createJsonFetcher({ cacheDirectory, fetchImpl }) };
};

test('reports HTTP status and response detail without caching failures', async (context) => {
  const { cacheDirectory, getJson } = await withFetcher(context, async () => new Response('Access denied by provider', { status: 403 }));
  await assert.rejects(getJson('denied', 'https://example.test'), /HTTP 403.*Access denied/);
  await assert.rejects(readFile(join(cacheDirectory, 'denied.json')), { code: 'ENOENT' });
});

test('rejects Overpass runtime errors even with HTTP 200', async (context) => {
  const { getJson } = await withFetcher(context, async () => Response.json({ remark: 'runtime timeout', elements: [] }));
  await assert.rejects(getJson('partial', 'https://example.test'), /Respuesta incompleta.*runtime timeout/);
});

test('validates downloaded and cached responses', async (context) => {
  const { cacheDirectory, getJson } = await withFetcher(context, async () => Response.json({ elements: [{ id: 1 }] }));
  await writeFile(join(cacheDirectory, 'services.json'), JSON.stringify({ wrong: true }));
  const result = await getJson('services', 'https://example.test', { validate: (value) => Array.isArray(value.elements) });
  assert.equal(result.elements.length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(cacheDirectory, 'services.json'), 'utf8')), result);
});

test('rejects an unexpected response schema', async (context) => {
  const { getJson } = await withFetcher(context, async () => Response.json({ wrong: true }));
  await assert.rejects(getJson('invalid', 'https://example.test', { validate: (value) => Array.isArray(value.elements) }), /Respuesta inesperada/);
});

test('reuses valid cache without network access', async (context) => {
  let calls = 0;
  const { getJson } = await withFetcher(context, async () => {
    calls++;
    return Response.json({ elements: [{ id: 1 }] });
  });
  const options = { validate: (value) => Array.isArray(value.elements) };
  await getJson('services', 'https://example.test', options);
  await getJson('services', 'https://example.test', options);
  assert.equal(calls, 1);
});

test('network errors include the endpoint and underlying cause', async (context) => {
  const { getJson } = await withFetcher(context, async () => {
    throw new Error('fetch failed', { cause: { code: 'ETIMEDOUT' } });
  });
  await assert.rejects(getJson('timeout', 'https://example.test'), /example.test.*ETIMEDOUT/);
});

test('refuses to publish empty or incomplete service imports', () => {
  assert.throws(() => assertMapDataImport({ stages: [], services: [], failedServiceAreas: [] }), /ninguna etapa/);
  assert.throws(() => assertMapDataImport({ stages: [{}], services: [], failedServiceAreas: [] }), /Se conserva/);
  assert.throws(() => assertMapDataImport({ stages: [{}], services: [{}], failedServiceAreas: ['42,-7'] }), /zonas fallidas/);
  assert.doesNotThrow(() => assertMapDataImport({ stages: [{}], services: [{}], failedServiceAreas: [] }));
});