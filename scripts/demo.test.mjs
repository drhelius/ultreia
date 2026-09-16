import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { getWeatherSnapshot } from './weather-provider.mjs';

const require = createRequire(import.meta.url);
const { createMemoryRepositories } = require('/tmp/ultreia-data-validate/src/persistence/memory/MemoryRepositories');
const { completeJourneyStage } = require('/tmp/ultreia-data-validate/src/features/engagement/completeJourneyStage');
const { mapRepository } = require('/tmp/ultreia-data-validate/src/data/camino/mapRepository');
const { positionOnRoute, progressOnRoute } = require('/tmp/ultreia-data-validate/src/domain/tracking/routeGeometry');
const { stagesTable, cyclingStagesTable, campaignTemplatesTable } = require('/tmp/ultreia-data-validate/src/data/camino/tables');
const { DeterministicDecisionEngine } = require('/tmp/ultreia-data-validate/src/domain/decision/DeterministicDecisionEngine');
const { DirectorSchedule } = require('/tmp/ultreia-data-validate/src/domain/decision/DirectorSchedule');
const { applyPolicyGates, isLocationSetupRecommendation } = require('/tmp/ultreia-data-validate/src/domain/decision/PolicyGates');
const { enrichDirectorContext, recommendationsForDay, localRecommendationDate } = require('/tmp/ultreia-data-validate/src/domain/decision/directorContext');
const { isDirectorAgentOutput, isPlanningAgentOutput } = require('/tmp/ultreia-data-validate/src/services/ai/agentValidators');
const { planCampaigns } = require('/tmp/ultreia-data-validate/src/features/planning/campaignPlanner');
const { selectPlannerRecommendations, recommendationToCampaignPlan, formatCampaignRationale } = require('/tmp/ultreia-data-validate/src/features/planning/campaignPresenter');
const { staticCaminoDataRepository } = require('/tmp/ultreia-data-validate/src/data/camino');
const { findServicesNear } = require('/tmp/ultreia-data-validate/src/domain/camino/nearbyServices');
const { buildAssistantContext } = require('/tmp/ultreia-data-validate/src/features/ai-chat/buildAssistantContext');
const mapData = require('../src/data/camino/mapData.json');
const campaign = { ...campaignTemplatesTable.items.find((item) => item.id === 'campaign:clasica-frances-sarria'), travelMode: 'walk' };

test('map geometry, references and service identifiers are valid', () => {
  const stageSlugs = new Set(mapData.stages.map((stage) => stage.stageSlug));
  assert.equal(stageSlugs.size, mapData.stages.length);
  assert.equal(new Set(mapData.services.map((service) => service.id)).size, mapData.services.length);
  for (const stage of mapData.stages) {
    assert.ok(stage.distanceKm > 0);
    assert.ok(stage.coordinates.length > 1);
    assert.ok(stage.coordinates.every((coordinate) => coordinate.length === 2 && coordinate.every(Number.isFinite) && Math.abs(coordinate[0]) <= 180 && Math.abs(coordinate[1]) <= 90));
  }
  assert.ok(mapData.services.every((service) => stageSlugs.has(service.stageSlug)));
  for (const category of ['fuente', 'farmacia', 'centro_salud', 'restaurante', 'supermercado']) assert.ok(mapData.services.some((service) => service.type === category));
});

test('all demo stages have coherent endpoints, services and simulated progress', () => {
  for (const slug of campaign.stageSlugs) {
    const geometry = mapRepository.getStageGeometry(slug);
    const stage = stagesTable.items.find((item) => item.slug === slug);
    assert.ok(geometry, slug);
    assert.ok(Math.abs(geometry.distanceKm - stage.distanceKm) / stage.distanceKm < .25, slug);
    assert.ok(mapRepository.getServices(slug).length > 0);
    const halfway = geometry.distanceKm / 2;
    const position = positionOnRoute(geometry.coordinates, halfway);
    const progress = progressOnRoute(geometry.coordinates, position);
    assert.ok(Math.abs(progress.distanceKm - halfway) < .01);
    assert.ok(progress.deviationKm < .001);
  }
});

test('Primitivo includes Oviedo-Salas and every subsequent cycling stage', () => {
  const walkingStages = stagesTable.items.filter((stage) => stage.routeSlug === 'camino-primitivo');
  const cyclingStages = cyclingStagesTable.items.filter((stage) => stage.routeSlug === 'camino-primitivo');
  assert.equal(walkingStages.length, 13);
  assert.equal(cyclingStages.length, 6);
  for (const stage of [...walkingStages, ...cyclingStages]) {
    const geometry = mapRepository.getStageGeometry(stage.slug);
    assert.ok(geometry, `Falta el trazado de ${stage.slug}`);
    assert.ok(!mapData.missingStages.includes(stage.slug));
    assert.ok(mapRepository.getServices(stage.slug).length > 0, stage.slug);
    for (const percent of [0, 25, 50, 75, 100]) {
      const expectedKm = geometry.distanceKm * percent / 100;
      const position = positionOnRoute(geometry.coordinates, expectedKm);
      const progress = progressOnRoute(geometry.coordinates, position);
      assert.ok(Math.abs(progress.distanceKm - expectedKm) < .01, `${stage.slug}: ${percent}%`);
    }
  }
  const geometry = mapRepository.getStageGeometry('bici-camino-primitivo-principal-1-oviedo-salas');
  assert.ok(geometry.distanceKm > 45 && geometry.distanceKm < 55);
  const start = positionOnRoute(geometry.coordinates, 0);
  const end = positionOnRoute(geometry.coordinates, geometry.distanceKm);
  assert.ok(Math.abs(start.latitude - 43.3622522) < .005 && Math.abs(start.longitude + 5.8485461) < .005, 'Debe empezar en Oviedo');
  assert.ok(Math.abs(end.latitude - 43.4093046) < .005 && Math.abs(end.longitude + 6.2621567) < .005, 'Debe terminar en Salas');
  assert.ok(mapData.routes.find((route) => route.routeSlug === 'camino-primitivo').connectionWayIds.includes(80340316));
});

test('five stages create five diaries and unlock arrival without duplicate rewards', async () => {
  const repositories = createMemoryRepositories();
  let journey = { id: 'demo-test', userId: 'user', campaignId: campaign.id, routeSlug: campaign.routeSlug, activeStageSlug: campaign.stageSlugs[0], status: 'active', updatedAtIso: new Date().toISOString() };
  await repositories.journeyRepository.saveActiveJourney(journey);
  for (const slug of campaign.stageSlugs) {
    const stage = stagesTable.items.find((item) => item.slug === slug);
    const args = { repositories, campaign, journey, stage, profile: { id: 'user' }, samples: [], distanceKm: mapRepository.getStageGeometry(slug).distanceKm, nowIso: new Date().toISOString() };
    journey = await completeJourneyStage(args);
    assert.deepEqual(await completeJourneyStage(args), journey);
  }
  assert.equal(journey.status, 'completed');
  assert.equal((await repositories.journalRepository.getEntriesByJourney(journey.id)).length, 5);
  const achievements = await repositories.progressionRepository.getAchievementStates('user');
  assert.equal(achievements.length, 2);
  assert.ok(achievements.some((item) => item.achievementId === 'achievement:compostela'));
});

test('web state survives recreation and deletion', async () => {
  const state = new Map();
  const storage = { getItem: (key) => state.get(key) ?? null, setItem: (key, value) => state.set(key, value) };
  await createMemoryRepositories(storage).expenseRepository.saveExpense({ id: 'expense', journeyId: 'demo', amountEur: 12.5, category: 'comida', spentAtIso: new Date().toISOString() });
  const restored = createMemoryRepositories(storage);
  assert.equal((await restored.expenseRepository.getExpensesByJourney('demo'))[0].amountEur, 12.5);
  await restored.expenseRepository.deleteExpense('expense');
  assert.equal((await createMemoryRepositories(storage).expenseRepository.getExpensesByJourney('demo')).length, 0);
});

test('local milestones are available without weather or Foundry and have stable IDs', () => {
  const context = { activeStage: stagesTable.items[0], timestampIso: new Date().toISOString(), physical: { progressPercent: 50, completedDistanceKm: 10, remainingKm: 10 }, nearby: [] };
  const engine = new DeterministicDecisionEngine();
  const first = engine.evaluate(context).recommendations;
  const second = engine.evaluate(context).recommendations;
  assert.ok(first.some((item) => item.id === 'milestone:25'));
  assert.ok(first.some((item) => item.id === 'milestone:50'));
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
});

test('GPS acquisition and ETA warmup do not create manual location recommendations', () => {
  const context = { activeStage: stagesTable.items[0], timestampIso: new Date().toISOString(), physical: { progressPercent: 0, completedDistanceKm: 0, remainingKm: 20 }, nearby: [] };
  const engine = new DeterministicDecisionEngine();
  assert.deepEqual(engine.evaluate(context).recommendations, []);
  assert.deepEqual(engine.evaluate({ ...context, physical: { ...context.physical, currentLocation: { latitude: 43, longitude: -7 } } }).recommendations, []);
  const oldAdvice = { id: 'journey:stage:decision:tracking:registrar-ubicacion', type: 'tracking', title: 'Registra tu ubicacion', message: 'Toma una muestra GPS', priority: 'media', evidence: [{ sourceId: 'missing-location', confidence: 'alta' }] };
  assert.equal(isLocationSetupRecommendation(oldAdvice), true);
  assert.equal(applyPolicyGates({ output: { recommendations: [oldAdvice], discardedRecommendations: [] }, recentRecommendations: [] }).recommendations.length, 0);
  const battery = engine.evaluate({ ...context, physical: { ...context.physical, batteryPercent: 15 } }).recommendations;
  assert.equal(battery.length, 1);
  assert.equal(isLocationSetupRecommendation(battery[0]), false);
});

test('profile-based candidates and accepted AI selections always have continuous maps', async () => {
  for (const travelMode of ['walk', 'bike', 'car']) {
    for (const availableDays of [3, 7, 15, 30]) {
      for (const goal of ['llegar_a_santiago', 'ruta_completa', 'naturaleza']) {
        const draft = { displayName: 'Test', pilgrimClasses: ['cultural', 'tranquilo'], travelMode, availableDays, budgetMode: 'equilibrado', goal, avoidCrowds: false };
        const candidates = await planCampaigns(staticCaminoDataRepository, draft, { verifiedMapsOnly: true });
        assert.ok(candidates.length > 0, `${travelMode}/${availableDays}/${goal}`);
        for (const candidate of candidates) {
          const plan = recommendationToCampaignPlan(candidate, travelMode);
          assert.ok(mapRepository.getCampaignAudit(plan.stageSlugs).ready, plan.title);
          assert.equal(new Set(plan.stageSlugs).size, plan.stageSlugs.length);
        }
        assert.deepEqual(selectPlannerRecommendations(candidates, [candidates[0].campaign.id]), [candidates[0]]);
        assert.throws(() => selectPlannerRecommendations(candidates, ['unknown']), /sin trazado/);
        assert.throws(() => selectPlannerRecommendations(candidates, []), /seleccion valida/);
      }
    }
  }
});

test('director runs every 30 real minutes and manual calls obey the 30-second floor', () => {
  const schedule = new DirectorSchedule();
  assert.equal(schedule.take(0), true);
  assert.equal(schedule.take(29999, undefined, true), false);
  assert.equal(schedule.take(30000), false);
  assert.equal(schedule.take(30 * 60000 - 1), false);
  assert.equal(schedule.take(30 * 60000), true);
  assert.equal(schedule.take(30 * 60000 + 29999, undefined, true), false);
  assert.equal(schedule.take(30 * 60000 + 30000, undefined, true), true);
});

test('simulation schedules by elapsed route time without bursts, including pauses and stage changes', () => {
  const schedule = new DirectorSchedule();
  const clock = (elapsedMinutes, sessionId = 'stage-one') => ({ elapsedMinutes, sessionId });
  assert.equal(schedule.take(0, clock(0)), true);
  assert.equal(schedule.take(10000, clock(30)), false);
  assert.equal(schedule.take(29999, clock(90)), false);
  assert.equal(schedule.take(30000, clock(90)), true);
  assert.equal(schedule.take(60000, clock(90)), false);
  assert.equal(schedule.take(90000, clock(105)), false);
  assert.equal(schedule.take(91000, clock(15, 'stage-two')), true);
  assert.equal(schedule.take(92000, clock(200, 'stage-two'), true), false);
  assert.equal(schedule.take(121000, clock(200, 'stage-two')), true);
  assert.equal(schedule.take(121001, clock(200, 'stage-two')), false);
});

test('director retries failed calls at most twice and never before 30 seconds', () => {
  const schedule = new DirectorSchedule();
  assert.equal(schedule.take(0), true);
  schedule.retryAfterFailure();
  assert.equal(schedule.take(29999), false);
  assert.equal(schedule.take(30000), true);
  schedule.retryAfterFailure();
  assert.equal(schedule.take(59999), false);
  assert.equal(schedule.take(60000), true);
  schedule.retryAfterFailure();
  assert.equal(schedule.take(90000), false);
});

test('director removes equivalent wind advice in the same response and in daily history', () => {
  const wind = { id: 'wind', type: 'seguridad', priority: 'media', title: 'Protege el cuerpo del viento', message: 'La sensacion termica es de 10 C. Lleva una capa cortaviento.', evidence: [{ confidence: 'alta' }] };
  const windAndSun = { ...wind, id: 'wind-sun', title: 'Protege del viento y del sol', message: 'El viento es fuerte. Usa capa cortaviento, gafas y proteccion solar.' };
  const output = { schemaVersion: '1.0', generatedAtIso: new Date().toISOString(), recommendations: [wind, windAndSun], discardedRecommendations: [] };
  const batch = applyPolicyGates({ output, recentRecommendations: [] });
  assert.equal(batch.recommendations.length, 1);
  assert.equal(batch.discardedRecommendations.length, 1);
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [windAndSun] }, recentRecommendations: [wind] }).recommendations.length, 0);
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [{ ...windAndSun, priority: 'critica' }] }, recentRecommendations: [wind] }).recommendations.length, 1);
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [{ ...windAndSun, priority: 'critica', evidence: [{ confidence: 'baja' }] }] }, recentRecommendations: [wind] }).recommendations.length, 0);
});

test('director uses stable advice keys but keeps distinct place recommendations', () => {
  const first = { id: 'first', type: 'descanso', priority: 'media', title: 'Para en Casa Ana', message: 'Casa Ana esta a 1.2 km: puedes parar a comer.', relatedEntityIds: ['poi:ana'], deduplicationKey: 'comer:poi:ana', evidence: [{ confidence: 'alta' }] };
  const repeated = { ...first, id: 'changed-id', title: 'Haz una parada en Casa Ana', message: 'Considera comer en Casa Ana, a 1.3 km.' };
  const different = { ...first, id: 'other', title: 'Para en Casa Rosa', message: 'Casa Rosa esta a 1.2 km: puedes parar a comer.', relatedEntityIds: ['poi:rosa'], deduplicationKey: 'comer:poi:rosa' };
  const output = { recommendations: [first, repeated, different], discardedRecommendations: [] };
  assert.deepEqual(applyPolicyGates({ output, recentRecommendations: [] }).recommendations.map((item) => item.id), ['first', 'other']);
});

test('new places survive generic reused titles and keys while repeated weather remains filtered', () => {
  const previous = { id: 'old', type: 'cultural', priority: 'media', title: 'Descubre el patrimonio cercano', message: 'Visita el puente de la primera etapa.', deduplicationKey: 'visitar:patrimonio', relatedEntityIds: ['osm:way:1'], evidence: [{ confidence: 'alta' }] };
  const current = { ...previous, id: 'new', message: 'Visita el monasterio de la segunda etapa.', relatedEntityIds: ['osm:way:2'] };
  const output = { recommendations: [current], discardedRecommendations: [] };
  assert.equal(applyPolicyGates({ output, recentRecommendations: [previous] }).recommendations.length, 1);
  const legacy = { ...previous, deduplicationKey: undefined, relatedEntityIds: [], stageSlug: 'first-stage' };
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [{ ...current, stageSlug: 'second-stage' }] }, recentRecommendations: [legacy] }).recommendations.length, 1);
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [{ ...current, relatedEntityIds: previous.relatedEntityIds }] }, recentRecommendations: [previous] }).recommendations.length, 0);
  const wind = { ...previous, type: 'seguridad', title: 'Protegete del viento', message: 'Lleva una capa cortaviento.', deduplicationKey: 'proteger:viento' };
  assert.equal(applyPolicyGates({ output: { ...output, recommendations: [{ ...wind, id: 'new-wind', relatedEntityIds: ['osm:way:2'] }] }, recentRecommendations: [wind] }).recommendations.length, 0);
});

test('director history spans stages but resets on the local calendar day and excludes other journeys', () => {
  const now = new Date(2026, 8, 16, 23, 59).toISOString();
  const sample = { type: 'seguridad', priority: 'media', title: 'Lleva cortaviento', message: 'Protegete del viento con una capa.', evidence: [], stageSlug: 'first-stage' };
  const sameDay = { ...sample, id: 'journey:first', createdAtIso: new Date(2026, 8, 16, 8).toISOString() };
  const nextStage = { ...sample, id: 'journey:second', stageSlug: 'second-stage', createdAtIso: new Date(2026, 8, 16, 10).toISOString() };
  const yesterday = { ...sample, id: 'journey:yesterday', createdAtIso: new Date(2026, 8, 15, 23, 59).toISOString() };
  const tomorrow = { ...sample, id: 'journey:tomorrow', createdAtIso: new Date(2026, 8, 17, 1).toISOString() };
  const history = [tomorrow, { ...sameDay, id: 'journey-other:foreign' }, nextStage, yesterday, sameDay, { ...sample, id: 'journey:no-date' }];
  assert.deepEqual(recommendationsForDay(history, 'journey', now).map((item) => item.id), ['journey:first', 'journey:second']);
  assert.equal(localRecommendationDate(now), '2026-09-16');
  assert.deepEqual(recommendationsForDay(history, 'journey', new Date(2026, 8, 17, 0, 1).toISOString()), []);
  const context = { activeJourney: { id: 'journey' }, physical: {}, simulation: { enabled: true } };
  assert.equal(enrichDirectorContext(context, history, now).recommendationHistory.totalShownToday, 2);
  assert.deepEqual(enrichDirectorContext(context, history, now).nearbyPlaces, []);
});

test('director summary is bounded while daily filtering retains older advice', () => {
  const now = new Date(2026, 8, 16, 23).toISOString();
  const history = Array.from({ length: 25 }, (_, index) => ({ id: `journey:${index}`, type: 'seguridad', priority: 'media', title: `Consejo ${index}`, message: 'a'.repeat(400), deduplicationKey: `topic:${index}`, evidence: [], createdAtIso: new Date(2026, 8, 16, 9, index).toISOString() }));
  const enriched = enrichDirectorContext({ activeJourney: { id: 'journey' }, physical: {} }, [...history].reverse(), now);
  assert.equal(enriched.recommendationHistory.items.length, 20);
  assert.equal(enriched.recommendationHistory.totalShownToday, 25);
  assert.equal(enriched.recommendationHistory.omittedCount, 5);
  assert.equal(enriched.recommendationHistory.items[0].id, 'journey:5');
  assert.ok(enriched.recommendationHistory.items.every((item) => item.message.length <= 240));
  assert.ok(enriched.recommendationHistory.deduplicationKeys.includes('topic:0'));
  assert.equal(recommendationsForDay(history, 'journey', now).length, 25);
});

test('director receives named nearby places with actual category and straight-line distance', () => {
  const now = new Date(2026, 8, 16, 12).toISOString();
  const service = { id: 'service:stage-one:casa-ana', title: 'Casa Ana', type: 'restaurante', coordinateStatus: 'verified', coordinate: { latitude: 43.01, longitude: -7 }, geocoding: { providerUrl: 'https://www.openstreetmap.org/node/123' }, address: 'Calle Mayor 2', phone: '000', openingHoursText: 'Mo-Su 12:00-16:00' };
  const context = { activeJourney: { id: 'journey' }, simulation: { enabled: true }, physical: { currentLocation: { latitude: 43, longitude: -7 } }, stageContext: { services: [service, { ...service, id: 'service:other-stage:same-place' }, { ...service, id: 'pending', coordinateStatus: 'pending' }, { ...service, id: 'far-away', coordinate: { latitude: 44, longitude: -7 } }], monuments: [], points: [] } };
  const places = enrichDirectorContext(context, [], now).nearbyPlaces;
  assert.equal(places.length, 1);
  assert.equal(places[0].id, 'osm:node:123');
  assert.equal(places[0].entityId, service.id);
  assert.equal(places[0].title, 'Casa Ana');
  assert.equal(places[0].type, 'restaurante');
  assert.ok(places[0].distanceKm > 1.1 && places[0].distanceKm < 1.2);
  assert.equal(places[0].distanceKind, 'straight_line');
  assert.equal(places[0].availability, 'unknown');
  assert.equal(places[0].openingHoursText, service.openingHoursText);
  assert.ok(places[0].evidence.some((evidence) => evidence.simulated));
});

test('cycling stages inherit cultural content only from walking stages on their geometry', async () => {
  const stage = cyclingStagesTable.items.filter((item) => item.routeSlug === 'camino-del-norte' && item.variantGroup === 'bici')[1];
  assert.ok(stage);
  const sections = await staticCaminoDataRepository.getStageSections(stage.slug);
  assert.ok(sections?.sourceStageSlugs?.length, stage.slug);
  assert.ok(sections.whatToSee.length > 0, stage.slug);
  assert.ok(sections.sourceStageSlugs.every((slug) => stagesTable.items.some((item) => item.slug === slug && item.routeSlug === stage.routeSlug)));
  assert.equal(await staticCaminoDataRepository.getStageSections(stage.slug), sections);
  const next = { activeJourney: { id: 'journey' }, activeStage: stage, physical: {}, stageContext: { sections, services: [], monuments: [], points: [] } };
  const input = enrichDirectorContext(next, [], new Date().toISOString());
  assert.ok(input.stageHighlights.some((highlight) => highlight.id.includes(':culture:')));
  assert.ok(input.stageHighlights.every((highlight) => highlight.scope === 'stage' && highlight.text.length <= 700 && highlight.evidence.length));
  assert.ok(input.contentBrief.newHighlightIds.length > 0);
});

test('new nearby places and stage facts are not crowded out by previously discussed items', () => {
  const now = new Date(2026, 8, 16, 12).toISOString();
  const services = Array.from({ length: 15 }, (_, index) => ({ id: `place:${index}`, title: `Lugar ${index}`, type: 'restaurante', coordinate: { latitude: 43 + index * .0001, longitude: -7 }, coordinateStatus: 'verified' }));
  const history = services.slice(0, 12).map((service, index) => ({ id: `journey:old:${index}`, title: service.title, message: 'Parada anterior', relatedEntityIds: [service.id], createdAtIso: now, evidence: [] }));
  const stage = { slug: 'second-stage', title: 'Segunda etapa', summary: 'Bosque y patrimonio de la etapa.' };
  const context = { activeJourney: { id: 'journey' }, activeStage: stage, physical: { currentLocation: { latitude: 43, longitude: -7 } }, stageContext: { services, monuments: [], points: [], sections: { whatToSee: ['Un puente documentado en esta etapa.'], observations: [], difficultyNotes: [] } } };
  const first = enrichDirectorContext(context, history, now);
  assert.ok(first.contentBrief.newPlaceIds.includes('place:12'));
  assert.ok(first.contentBrief.newPlaceIds.includes('place:14'));
  assert.ok(first.nearbyPlaces.length <= 12);
  const fact = first.stageHighlights.find((item) => item.id.includes(':culture:'));
  const second = enrichDirectorContext(context, [...history, { id: 'journey:fact', title: 'El puente', message: 'Ya mencionado.', relatedEntityIds: [fact.id], createdAtIso: now, evidence: [] }], now);
  assert.ok(!second.contentBrief.newHighlightIds.includes(fact.id));
  assert.ok(second.stageHighlights.find((item) => item.id === fact.id).mentionedToday);
});

test('optional anti-repetition fields remain compatible with the current Foundry prompt', () => {
  const recommendation = { id: 'test', type: 'agua', priority: 'media', title: 'Bebe agua', message: 'Revisa tu agua antes de salir.', evidence: [] };
  const output = { schemaVersion: '1.0', generatedAtIso: new Date().toISOString(), recommendations: [recommendation], discardedRecommendations: [] };
  assert.equal(isDirectorAgentOutput(output), true);
  assert.equal(isDirectorAgentOutput({ ...output, recommendations: [{ ...recommendation, deduplicationKey: 'hidratar:general', relatedEntityIds: ['osm:node:123'] }] }), true);
  assert.equal(isDirectorAgentOutput({ ...output, recommendations: [{ ...recommendation, relatedEntityIds: [null] }] }), false);
  assert.equal(isDirectorAgentOutput({ ...output, recommendations: [{ ...recommendation, deduplicationKey: {} }] }), false);
});

test('chat service search retains pharmacies beyond the old nearby limit and deduplicates stage associations', () => {
  const origin = { latitude: 43, longitude: -7 };
  const bars = Array.from({ length: 12 }, (_, index) => ({ id: `bar:${index}`, title: `Bar ${index}`, type: 'bar', coordinateStatus: 'verified', coordinate: { latitude: 43 + index * .0001, longitude: -7 } }));
  const pharmacy = { id: 'osm:node:123:another-stage', title: 'Farmacia de prueba', type: 'farmacia', coordinateStatus: 'verified', coordinate: { latitude: 43.025, longitude: -7 }, stageSlug: 'other-stage' };
  const services = [...bars, pharmacy, { ...pharmacy, id: 'osm:node:123:duplicated-stage' }, { ...pharmacy, id: 'unverified', coordinateStatus: 'pending' }, { ...pharmacy, id: 'far-away', coordinate: { latitude: 44, longitude: -7 } }];
  const result = findServicesNear(services, origin);
  assert.equal(result.items.filter((item) => item.service.type === 'bar').length, 3);
  const pharmacies = result.items.filter((item) => item.service.type === 'farmacia');
  assert.equal(pharmacies.length, 1);
  assert.ok(pharmacies[0].distanceKm > 2 && pharmacies[0].distanceKm < 3);
  assert.equal(result.categories.find((category) => category.type === 'farmacia').matches, 1);
  assert.equal(result.totalMatches, 13);
  assert.equal(findServicesNear(services, origin, 2).categories.find((category) => category.type === 'farmacia').matches, 0);
  assert.throws(() => findServicesNear(services, { latitude: NaN, longitude: 0 }), /Coordenadas/);
});

test('chat metadata contains fresh category search, weather, stage facts and actual budget', async () => {
  const repositories = createMemoryRepositories();
  const stage = stagesTable.items.find((item) => item.slug === campaign.stageSlugs[0]);
  const timestampIso = new Date(2026, 8, 16, 12).toISOString();
  const profile = { id: 'chat-user', displayName: 'Prueba chat', pilgrimClass: 'cultural', pilgrimClasses: ['cultural'], travelMode: 'walk', budgetMode: 'equilibrado' };
  const journey = { id: 'chat-journey', activeStageSlug: stage.slug, status: 'active' };
  await repositories.expenseRepository.saveExpense({ id: 'today', journeyId: journey.id, category: 'comida', amountEur: 12.5, spentAtIso: timestampIso });
  await repositories.expenseRepository.saveExpense({ id: 'yesterday', journeyId: journey.id, category: 'alojamiento', amountEur: 20, spentAtIso: new Date(2026, 8, 15, 12).toISOString() });
  await repositories.userProfileRepository.savePreferences({ userId: profile.id, notificationTolerance: 'baja', allowLocationTracking: true, allowCommunityFeatures: false });
  const pharmacy = { id: 'pharmacy:test', title: 'Farmacia de prueba', type: 'farmacia', coordinateStatus: 'verified', coordinate: { latitude: 43.025, longitude: -7 }, stageSlug: 'another-stage', address: 'Calle de prueba', phone: '+34000000000', openingHoursText: 'Mo-Fr 09:00-18:00' };
  const dataRepository = Object.create(staticCaminoDataRepository);
  let searches = 0;
  dataRepository.getNearbyServices = async (position, radiusKm, limit) => { searches++; return findServicesNear([pharmacy], position, radiusKm, limit); };
  const weather = { temperatureC: 18, evidence: { sourceType: 'external_realtime', sourceId: 'weather-test', generatedAtIso: timestampIso, confidence: 'media' } };
  const args = { repositories, dataRepository, profile, journey, campaign, timestampIso, decision: { recommendations: [], running: false, weather }, tracking: { currentLocation: { latitude: 43, longitude: -7 }, activeStage: stage, session: { mode: 'simulation', status: 'paused' }, samples: [], nearby: [], completedDistanceKm: 5, remainingKm: 17, progressPercent: 25, elapsedMinutes: 60, batteryPercent: 90 } };
  const first = await buildAssistantContext(args);
  assert.equal(first.serviceSearch.status, 'available');
  assert.equal(first.serviceSearch.scope, 'all_imported_routes');
  assert.equal(first.serviceSearch.coverage, 'partial');
  assert.equal(first.serviceSearch.radiusKm, 20);
  assert.equal(first.nearby.length, 0);
  assert.equal(first.serviceSearch.places[0].title, pharmacy.title);
  assert.equal(first.serviceSearch.places[0].phone, pharmacy.phone);
  assert.equal(first.serviceSearch.places[0].availability, 'unknown');
  assert.equal(first.serviceSearch.places[0].distanceKind, 'straight_line');
  assert.equal(first.tracking.simulated, true);
  assert.equal(first.tracking.distanceScope, 'active_stage');
  assert.equal(first.weather.temperatureC, 18);
  assert.equal(first.budget.spentTodayEur, 12.5);
  assert.equal(first.budget.spentJourneyEur, 32.5);
  assert.equal(first.user.preferences.notificationTolerance, 'baja');
  assert.ok(first.stageDetails.whatToSee.length);
  assert.ok(JSON.stringify(first).length < 16000);
  const second = await buildAssistantContext({ ...args, tracking: { ...args.tracking, currentLocation: pharmacy.coordinate } });
  assert.equal(second.serviceSearch.places[0].distanceKm, 0);
  assert.equal(second.nearby.length, 1);
  assert.equal(searches, 2);
  const noLocation = await buildAssistantContext({ ...args, tracking: { ...args.tracking, currentLocation: undefined } });
  assert.equal(noLocation.serviceSearch.status, 'location_unavailable');
  assert.equal(noLocation.serviceSearch.places.length, 0);
  assert.equal(searches, 2);
});

test('Leon city chat context contains actual pharmacies even when tracking nearby is empty', async () => {
  const stage = stagesTable.items.find((item) => item.slug === 'etapa-de-el-burgo-ranero-a-leon');
  const position = { latitude: 42.5987, longitude: -5.5671 };
  const input = await buildAssistantContext({
    repositories: createMemoryRepositories(), dataRepository: staticCaminoDataRepository,
    profile: { id: 'leon-user', displayName: 'Prueba Leon', pilgrimClasses: ['cultural'], travelMode: 'walk', budgetMode: 'equilibrado' },
    journey: { id: 'leon-journey', activeStageSlug: stage.slug, status: 'active' },
    campaign: { id: 'leon-campaign', title: 'Llegada a Leon', routeSlug: stage.routeSlug, stageSlugs: [stage.slug], travelMode: 'walk', recommendedDays: 1 },
    timestampIso: new Date().toISOString(), decision: { recommendations: [], running: false },
    tracking: { currentLocation: position, samples: [], nearby: [], completedDistanceKm: 35, remainingKm: 1, progressPercent: 97, session: { mode: 'simulation', status: 'paused' } },
  });
  const category = input.serviceSearch.categories.find((item) => item.type === 'farmacia');
  assert.ok(category.matches >= 3);
  const pharmacies = input.serviceSearch.places.filter((item) => item.type === 'farmacia');
  assert.equal(pharmacies.length, 3);
  assert.ok(pharmacies.every((item) => item.distanceKm < .5));
  assert.ok(pharmacies.some((item) => item.title === 'Godón Monreal'));
  assert.deepEqual(input.tracking.currentLocation, position);
});

test('Villadangos pharmacy question explicitly carries matching results beyond the nearby summary', async () => {
  const stage = stagesTable.items.find((item) => item.slug === 'etapa-de-leon-a-san-martin-del-camino');
  const position = { latitude: 42.51837, longitude: -5.76533 };
  const args = {
    repositories: createMemoryRepositories(), dataRepository: staticCaminoDataRepository,
    profile: { id: 'villadangos-user', displayName: 'Prueba', pilgrimClasses: ['cultural'], travelMode: 'walk', budgetMode: 'equilibrado' },
    journey: { id: 'villadangos-journey', activeStageSlug: stage.slug, status: 'active' },
    campaign: { id: 'villadangos-campaign', title: 'Leon a San Martin', routeSlug: stage.routeSlug, stageSlugs: [stage.slug], travelMode: 'walk', recommendedDays: 1 },
    timestampIso: new Date().toISOString(), userMessage: 'alguna farmacia cerca?', decision: { recommendations: [], running: false },
    tracking: { currentLocation: position, samples: [], nearby: [], completedDistanceKm: 20, remainingKm: 5, progressPercent: 80, session: { mode: 'simulation', status: 'paused' } },
  };
  const context = await buildAssistantContext(args);
  const search = context.serviceSearch;
  assert.deepEqual(search.origin, position);
  assert.deepEqual(search.requestedTypes, ['farmacia']);
  assert.equal(search.requestedStatus, 'found');
  assert.ok(search.requestedMatches >= 3);
  assert.equal(search.places.length, 3);
  assert.ok(search.places.every((item) => item.type === 'farmacia'));
  assert.equal(search.places[0].title, 'Lda. María Ramos Natal');
  assert.ok(search.places[0].distanceKm > 11 && search.places[0].distanceKm < 12);
  assert.equal(context.nearby.some((item) => item.type === 'farmacia'), false);
  const missingLocation = await buildAssistantContext({ ...args, tracking: { ...args.tracking, currentLocation: undefined } });
  assert.equal(missingLocation.serviceSearch.requestedStatus, 'not_searched');
  assert.equal(missingLocation.serviceSearch.requestedMatches, undefined);
  const noMatches = await buildAssistantContext({ ...args, tracking: { ...args.tracking, currentLocation: { latitude: 0, longitude: 0 } } });
  assert.equal(noMatches.serviceSearch.requestedStatus, 'not_found_in_catalog');
  assert.equal(noMatches.serviceSearch.requestedMatches, 0);
});

test('complete chat history survives reload and clear starts a new exchange without clearing the journey', async () => {
  const state = new Map();
  const storage = { getItem: (key) => state.get(key) ?? null, setItem: (key, value) => state.set(key, value) };
  const repositories = createMemoryRepositories(storage);
  const thread = await repositories.chatRepository.getOrCreateThread('chat-user', 'Prueba historial');
  await repositories.journeyRepository.saveActiveJourney({ id: 'journey-kept', userId: 'chat-user', status: 'active' });
  const messages = Array.from({ length: 16 }, (_, index) => ({ id: `message:${index}`, threadId: thread.id, role: index % 2 ? 'assistant' : 'user', body: `Mensaje ${index}`, createdAtIso: new Date(2026, 8, 16, 12, index).toISOString() }));
  for (const message of messages) await repositories.chatRepository.saveMessage(message);
  assert.deepEqual(await repositories.chatRepository.getMessages(thread.id), messages);
  const reloaded = createMemoryRepositories(storage);
  assert.deepEqual(await reloaded.chatRepository.getMessages(thread.id), messages);
  await reloaded.chatRepository.clearThread(thread.id);
  const cleared = createMemoryRepositories(storage);
  assert.deepEqual(await cleared.chatRepository.getMessages(thread.id), []);
  assert.equal((await cleared.journeyRepository.getActiveJourney()).id, 'journey-kept');
  const newMessage = { ...messages[0], id: 'new-message', body: 'Nueva conversacion' };
  await cleared.chatRepository.saveMessage(newMessage);
  assert.deepEqual(await cleared.chatRepository.getMessages(thread.id), [newMessage]);
});

test('planning explanations use one bounded paragraph and support the existing agent schema', () => {
  const recommendation = { stages: [{ startTown: 'Sarria' }, { endTown: 'Santiago' }], reasons: ['Dos etapas del catalogo.'], risks: ['Coste aproximado.'] };
  const agent = { campaignId: 'test', fitScore: .9, headline: 'Opcion cultural', reasons: ['Encaja con tu disponibilidad', 'Incluye el patrimonio que te interesa.'], tradeoffs: ['La segunda jornada es mas larga.'] };
  const legacy = formatCampaignRationale(recommendation, agent);
  assert.ok(formatCampaignRationale(recommendation).includes('Sarria a Santiago'));
  assert.ok(!legacy.startsWith('El recorrido va de'));
  assert.ok(legacy.includes('Encaja con tu disponibilidad.'));
  assert.ok(legacy.includes('Incluye el patrimonio que te interesa.'));
  assert.ok(legacy.includes('La segunda jornada es mas larga.'));
  assert.equal(legacy.includes('\n'), false);
  const rationale = 'He elegido el tramo final desde Sarria.\n\nSe ajusta a tus dias y mantiene las visitas culturales.\n El coste es estimado.';
  assert.equal(formatCampaignRationale(recommendation, { ...agent, rationale }), 'He elegido el tramo final desde Sarria. Se ajusta a tus dias y mantiene las visitas culturales. El coste es estimado.');
  assert.equal(formatCampaignRationale(recommendation, { ...agent, rationale: '   ' }), legacy);
  const lengthy = formatCampaignRationale(recommendation, { ...agent, rationale: 'Una explicacion demasiado larga para esta tarjeta. '.repeat(50) });
  assert.ok(lengthy.split(/\s+/).length <= 120);
  assert.ok(lengthy.endsWith('.'));
  assert.ok(formatCampaignRationale(recommendation, { ...agent, rationale: 'palabra '.repeat(200) }).split(/\s+/).length <= 120);
  const output = { schemaVersion: '1.0', summary: 'Resumen', recommendations: [agent], globalAdvice: [], requiresUserChoice: true };
  assert.equal(isPlanningAgentOutput(output), true);
  assert.equal(isPlanningAgentOutput({ ...output, recommendations: [{ ...agent, rationale }] }), true);
  assert.equal(isPlanningAgentOutput({ ...output, recommendations: [{ ...agent, rationale: 42 }] }), false);
});

test('weather validates coordinates and transforms Open-Meteo without inventing alerts', async () => {
  const coordinates = { latitude: 42.76, longitude: -7.42 };
  await assert.rejects(getWeatherSnapshot({ latitude: 100, longitude: 0 }), /no validas/);
  const weather = await getWeatherSnapshot(coordinates, async () => Response.json({ current: { temperature_2m: 20, apparent_temperature: 19, wind_speed_10m: 8 }, hourly: { precipitation_probability: Array(24).fill(30) }, daily: { uv_index_max: [5] } }));
  assert.equal(weather.temperatureC, 20);
  assert.equal(weather.precipitationProbability, 30);
  assert.equal(weather.evidence.sourceId, 'open-meteo');
  assert.equal(weather.alertLevel, undefined);
  await assert.rejects(getWeatherSnapshot(coordinates, async () => new Response('', { status: 503 })), /503/);
});