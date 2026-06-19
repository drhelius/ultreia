export const caminoDataManifest = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "coordinatePolicy": "Coordinates are omitted unless resolved from a traceable geocoding provider. Verified coordinates include geocoding metadata. Unresolved entities are marked not_available or pending.",
  "coordinates": {
    "provider": "google_geocoding",
    "verifiedHostels": 1193,
    "verifiedMonuments": 58,
    "verifiedServices": 1251,
    "verifiedStagePoints": 372,
    "verifiedTowns": 727,
    "unresolvedHostels": 1,
    "unresolvedMonuments": 1,
    "pendingStagePoints": 1165,
    "unresolvedTowns": 1
  },
  "tables": {
    "routes": 12,
    "stages": 172,
    "cyclingStages": 78,
    "stageSections": 172,
    "stagePoints": 1381,
    "hostels": 1194,
    "monuments": 59,
    "services": 1253,
    "towns": 728,
    "campaignTemplates": 6,
    "questTemplates": 4,
    "regions": 6
  }
} as const;
