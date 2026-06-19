import type { TrackingRepository } from '../../../repositories';
import type { TrackingSample, TrackingSession } from '../../../domain';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteTrackingRepository implements TrackingRepository {
  constructor(private readonly database: LocalDatabase) {}

  async saveSession(session: TrackingSession): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO tracking_sessions (id, journey_id, stage_slug, status, started_at_iso, ended_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [session.id, session.journeyId, session.stageSlug, session.status, session.startedAtIso, session.endedAtIso ?? null, toJson(session)],
    );
  }

  async getActiveSession(journeyId: string): Promise<TrackingSession | undefined> {
    const row = await this.database.getFirst<PayloadRow>("SELECT payload_json FROM tracking_sessions WHERE journey_id = ? AND status IN ('active', 'paused') ORDER BY started_at_iso DESC LIMIT 1;", [journeyId]);

    return row ? fromJson<TrackingSession>(row.payload_json) : undefined;
  }

  async completeSession(sessionId: string, endedAtIso: string): Promise<void> {
    await this.database.run("UPDATE tracking_sessions SET status = 'completed', ended_at_iso = ? WHERE id = ?;", [endedAtIso, sessionId]);
  }

  async addSample(sample: TrackingSample): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO tracking_samples (id, session_id, recorded_at_iso, latitude, longitude, accuracy_meters, evidence_json, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [sample.id, sample.sessionId, sample.recordedAtIso, sample.coordinates.latitude, sample.coordinates.longitude, sample.accuracyMeters ?? null, toJson(sample.evidence), toJson(sample)],
    );
  }

  async getSamples(sessionId: string): Promise<TrackingSample[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM tracking_samples WHERE session_id = ? ORDER BY recorded_at_iso ASC;', [sessionId]);

    return rows.map((row) => fromJson<TrackingSample>(row.payload_json));
  }
}
