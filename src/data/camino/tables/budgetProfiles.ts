import type { BudgetProfile, CaminoDataTable } from '../../../domain';

export const budgetProfilesTable: CaminoDataTable<BudgetProfile> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "budget:austero",
      "mode": "austero",
      "dailyTargetEur": 25,
      "contentStatus": "curated"
    },
    {
      "id": "budget:equilibrado",
      "mode": "equilibrado",
      "dailyTargetEur": 38,
      "contentStatus": "curated"
    },
    {
      "id": "budget:comodo",
      "mode": "comodo",
      "dailyTargetEur": 60,
      "contentStatus": "curated"
    }
  ]
};
