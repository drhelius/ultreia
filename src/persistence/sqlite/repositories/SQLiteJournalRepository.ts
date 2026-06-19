import type { JournalEntry } from '../../../domain';
import type { JournalRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteJournalRepository implements JournalRepository {
  constructor(private readonly database: LocalDatabase) {}

  async saveEntry(entry: JournalEntry): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO journal_entries (id, journey_id, stage_slug, date_iso, status, title, body, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [entry.id, entry.journeyId, entry.stageSlug, entry.dateIso, entry.status, entry.title, entry.body, entry.updatedAtIso, toJson(entry)],
    );
  }

  async getEntry(entryId: string): Promise<JournalEntry | undefined> {
    const row = await this.database.getFirst<PayloadRow>('SELECT payload_json FROM journal_entries WHERE id = ?;', [entryId]);

    return row ? fromJson<JournalEntry>(row.payload_json) : undefined;
  }

  async getEntriesByJourney(journeyId: string): Promise<JournalEntry[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM journal_entries WHERE journey_id = ? ORDER BY date_iso ASC;', [journeyId]);

    return rows.map((row) => fromJson<JournalEntry>(row.payload_json));
  }
}
