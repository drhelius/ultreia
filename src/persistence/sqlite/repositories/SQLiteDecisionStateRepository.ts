import type { DecisionCycle, DecisionRecommendation } from '../../../domain';
import type { DecisionStateRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteDecisionStateRepository implements DecisionStateRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getLastCycle(): Promise<DecisionCycle | undefined> {
    const row = await this.database.getFirst<PayloadRow>('SELECT payload_json FROM decision_cycles ORDER BY started_at_iso DESC LIMIT 1;');

    return row ? fromJson<DecisionCycle>(row.payload_json) : undefined;
  }

  async saveCycle(cycle: DecisionCycle): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO decision_cycles (id, trigger, started_at_iso, completed_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?);`,
      [cycle.id, cycle.trigger, cycle.startedAtIso, cycle.completedAtIso ?? null, toJson(cycle)],
    );

    for (const recommendation of cycle.recommendations) {
      await this.database.run(
        `INSERT OR REPLACE INTO decision_recommendations (id, cycle_id, journey_id, type, priority, title, message, shown_at_iso, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [recommendation.id, cycle.id, cycle.journeyId ?? null, recommendation.type, recommendation.priority, recommendation.title, recommendation.message, null, toJson(recommendation)],
      );
    }
  }

  async getNotificationHistory(): Promise<DecisionRecommendation[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM notification_history ORDER BY shown_at_iso DESC;');

    return rows.map((row) => fromJson<DecisionRecommendation>(row.payload_json));
  }

  async markRecommendationShown(recommendation: DecisionRecommendation): Promise<void> {
    const shownAtIso = new Date().toISOString();
    await this.database.run('UPDATE decision_recommendations SET shown_at_iso = ? WHERE id = ?;', [shownAtIso, recommendation.id]);
    await this.database.run(
      `INSERT OR REPLACE INTO notification_history (id, recommendation_id, shown_at_iso, payload_json)
       VALUES (?, ?, ?, ?);`,
      [`notification:${recommendation.id}`, recommendation.id, shownAtIso, toJson(recommendation)],
    );
  }

  async clearDecisionState(): Promise<void> {
    await this.database.execute('DELETE FROM notification_history; DELETE FROM decision_recommendations; DELETE FROM decision_cycles;');
  }
}
