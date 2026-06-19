import type { CaminoDataTable } from '../../../domain';
export type MapLayerData = { id: string; title: string; enabledByDefault: boolean; contentStatus: import('../../../domain').ContentStatus };

export const mapLayersTable: CaminoDataTable<MapLayerData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "layer:ruta",
      "title": "Ruta oficial",
      "enabledByDefault": true,
      "contentStatus": "curated"
    },
    {
      "id": "layer:servicios",
      "title": "Servicios",
      "enabledByDefault": true,
      "contentStatus": "curated"
    },
    {
      "id": "layer:patrimonio",
      "title": "Patrimonio",
      "enabledByDefault": true,
      "contentStatus": "curated"
    },
    {
      "id": "layer:seguridad",
      "title": "Camino seguro",
      "enabledByDefault": true,
      "contentStatus": "curated"
    }
  ]
};
