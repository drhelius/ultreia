import type { CaminoDataTable } from '../../../domain';
export type SafetyNoticeData = { id: string; type: string; title: string; severity: string; contentStatus: import('../../../domain').ContentStatus };

export const safetyNoticesTable: CaminoDataTable<SafetyNoticeData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "safety:sin-agua",
      "type": "sin_agua",
      "title": "Tramo con pocos servicios",
      "severity": "media",
      "contentStatus": "curated"
    },
    {
      "id": "safety:desvio",
      "type": "desvio",
      "title": "Revisa el track oficial si te alejas de la ruta",
      "severity": "alta",
      "contentStatus": "curated"
    }
  ]
};
