import type { CaminoDataTable } from '../../../domain';
export type RegionData = { id: string; slug: string; title: string; color: string; routeSlugs: string[]; contentStatus: import('../../../domain').ContentStatus };

export const regionsTable: CaminoDataTable<RegionData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "region:pirineos",
      "slug": "pirineos",
      "title": "Pirineos",
      "color": "#B8872C",
      "routeSlugs": [
        "camino-frances"
      ],
      "contentStatus": "curated"
    },
    {
      "id": "region:navarra",
      "slug": "navarra",
      "title": "Navarra",
      "color": "#2F6D4F",
      "routeSlugs": [
        "camino-frances",
        "camino-baztanes"
      ],
      "contentStatus": "curated"
    },
    {
      "id": "region:la-rioja",
      "slug": "la-rioja",
      "title": "La Rioja",
      "color": "#8E2C32",
      "routeSlugs": [
        "camino-frances"
      ],
      "contentStatus": "curated"
    },
    {
      "id": "region:castilla",
      "slug": "castilla",
      "title": "Castilla",
      "color": "#536A78",
      "routeSlugs": [
        "camino-frances",
        "via-de-la-plata"
      ],
      "contentStatus": "curated"
    },
    {
      "id": "region:galicia",
      "slug": "galicia",
      "title": "Galicia",
      "color": "#4D8B57",
      "routeSlugs": [
        "camino-frances",
        "camino-portugues",
        "camino-ingles",
        "camino-primitivo"
      ],
      "contentStatus": "curated"
    },
    {
      "id": "region:costa-fisterra",
      "slug": "costa-fisterra",
      "title": "Costa/Fisterra",
      "color": "#1D7F89",
      "routeSlugs": [
        "epilogo-a-fisterra-y-muxia"
      ],
      "contentStatus": "curated"
    }
  ]
};
