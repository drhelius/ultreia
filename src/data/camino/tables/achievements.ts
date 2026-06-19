import type { CaminoDataTable } from '../../../domain';
export type AchievementData = { id: string; title: string; category: string; criteria: string; contentStatus: import('../../../domain').ContentStatus };

export const achievementsTable: CaminoDataTable<AchievementData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "achievement:primera-etapa",
      "title": "Primera etapa",
      "category": "progreso",
      "criteria": "Completa tu primera etapa",
      "contentStatus": "curated"
    },
    {
      "id": "achievement:compostela",
      "title": "Compostelano",
      "category": "progreso",
      "criteria": "Llega a Santiago con distancia valida",
      "contentStatus": "curated"
    },
    {
      "id": "achievement:madrugador",
      "title": "El Madrugador",
      "category": "peregrino",
      "criteria": "Inicia 3 etapas antes de las 7:00",
      "contentStatus": "curated"
    },
    {
      "id": "achievement:buen-companero",
      "title": "Buen Companero",
      "category": "social",
      "criteria": "Ayuda con un reporte util",
      "contentStatus": "curated"
    }
  ]
};
