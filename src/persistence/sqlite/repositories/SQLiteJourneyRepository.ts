import type { ActiveJourney, CampaignPlan, StageProgress } from '../../../domain';
import type { JourneyRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteJourneyRepository implements JourneyRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getActiveJourney(): Promise<ActiveJourney | undefined> {
    const row = await this.database.getFirst<PayloadRow>("SELECT payload_json FROM active_journey WHERE status IN ('active', 'paused', 'draft') ORDER BY updated_at_iso DESC LIMIT 1;");

    return row ? fromJson<ActiveJourney>(row.payload_json) : undefined;
  }

  async saveActiveJourney(journey: ActiveJourney): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO active_journey (id, user_id, campaign_id, route_slug, active_stage_slug, status, started_at_iso, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [journey.id, journey.userId, journey.campaignId, journey.routeSlug, journey.activeStageSlug ?? null, journey.status, journey.startedAtIso ?? null, journey.updatedAtIso, toJson(journey)],
    );
  }

  async saveSelectedCampaign(campaign: CampaignPlan): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO selected_campaign (id, title, route_slug, travel_mode, recommended_days, stage_slugs_json, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [campaign.id, campaign.title, campaign.routeSlug, campaign.travelMode, campaign.recommendedDays, toJson(campaign.stageSlugs), toJson(campaign)],
    );
  }

  async getSelectedCampaign(campaignId: string): Promise<CampaignPlan | undefined> {
    const row = await this.database.getFirst<PayloadRow>('SELECT payload_json FROM selected_campaign WHERE id = ?;', [campaignId]);

    return row ? fromJson<CampaignPlan>(row.payload_json) : undefined;
  }

  async getStageProgress(journeyId: string): Promise<StageProgress[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM stage_progress WHERE journey_id = ?;', [journeyId]);

    return rows.map((row) => fromJson<StageProgress>(row.payload_json));
  }

  async saveStageProgress(progress: StageProgress): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO stage_progress (journey_id, stage_slug, state, completed_at_iso, evidence_json, payload_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [progress.journeyId, progress.stageSlug, progress.state, progress.completedAtIso ?? null, progress.evidence ? toJson(progress.evidence) : null, toJson(progress)],
    );
  }
}
