import type { CaminoDataTable } from '../../../domain';
export type CollectibleData = { id: string; title: string; type: string; contentStatus: import('../../../domain').ContentStatus };

export const collectiblesTable: CaminoDataTable<CollectibleData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "collectible:sello",
      "title": "Sellos de credencial",
      "type": "sello",
      "contentStatus": "curated"
    },
    {
      "id": "collectible:vieira",
      "title": "Vieiras encontradas",
      "type": "vieira",
      "contentStatus": "curated"
    },
    {
      "id": "collectible:puente",
      "title": "Puentes historicos",
      "type": "puente",
      "contentStatus": "curated"
    },
    {
      "id": "collectible:plato-local",
      "title": "Platos locales",
      "type": "gastronomia",
      "contentStatus": "curated"
    }
  ]
};
