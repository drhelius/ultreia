import type { CaminoDataTable } from '../../../domain';
export type IndexSummaryData = { id: string; routes: number; stages: number; cyclingStages: number; hostels: number; monuments: number; services: number; stagePoints: number; stageSections: number; contentStatus: import('../../../domain').ContentStatus };

export const indexesTable: CaminoDataTable<IndexSummaryData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "index:summary",
      "routes": 12,
      "stages": 172,
      "cyclingStages": 78,
      "hostels": 1194,
      "monuments": 59,
      "services": 1253,
      "stagePoints": 1381,
      "stageSections": 172,
      "contentStatus": "curated"
    }
  ]
};
