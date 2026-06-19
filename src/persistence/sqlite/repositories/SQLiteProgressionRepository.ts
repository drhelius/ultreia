import type { AchievementState, CollectibleState, QuestState } from '../../../domain';
import type { ProgressionRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteProgressionRepository implements ProgressionRepository {
  constructor(private readonly database: LocalDatabase) {}

  async saveQuestState(state: QuestState): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO quest_state (id, journey_id, quest_template_id, status, progress, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [state.id, state.journeyId, state.questTemplateId, state.status, state.progress, state.updatedAtIso, toJson(state)],
    );
  }

  async getQuestStates(journeyId: string): Promise<QuestState[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM quest_state WHERE journey_id = ?;', [journeyId]);

    return rows.map((row) => fromJson<QuestState>(row.payload_json));
  }

  async saveAchievementState(state: AchievementState): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO achievement_state (id, user_id, achievement_id, unlocked_at_iso, progress, payload_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [state.id, state.userId, state.achievementId, state.unlockedAtIso ?? null, state.progress, toJson(state)],
    );
  }

  async getAchievementStates(userId: string): Promise<AchievementState[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM achievement_state WHERE user_id = ?;', [userId]);

    return rows.map((row) => fromJson<AchievementState>(row.payload_json));
  }

  async saveCollectibleState(state: CollectibleState): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO collectible_state (id, user_id, collectible_id, count, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [state.id, state.userId, state.collectibleId, state.count, state.updatedAtIso, toJson(state)],
    );
  }

  async getCollectibleStates(userId: string): Promise<CollectibleState[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM collectible_state WHERE user_id = ?;', [userId]);

    return rows.map((row) => fromJson<CollectibleState>(row.payload_json));
  }
}
