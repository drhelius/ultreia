import type { CaminoDataTable } from '../../../domain';
export type QuestTemplateData = { id: string; title: string; stageSlug: string | null };

export const questTemplatesTable: CaminoDataTable<QuestTemplateData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "quest:visita-cultural",
      "title": "Descubrimiento cultural cercano",
      "stageSlug": null
    },
    {
      "id": "quest:rellenar-agua",
      "title": "Rellena agua antes del siguiente tramo",
      "stageSlug": null
    },
    {
      "id": "quest:sellar-credencial",
      "title": "Sella tu credencial al final de etapa",
      "stageSlug": null
    },
    {
      "id": "quest:reporte-util",
      "title": "Deja un reporte util del Camino",
      "stageSlug": null
    }
  ]
};
