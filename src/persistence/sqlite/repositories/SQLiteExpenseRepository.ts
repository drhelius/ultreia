import type { ExpenseEntry } from '../../../domain';
import type { ExpenseRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

export class SQLiteExpenseRepository implements ExpenseRepository {
  constructor(private readonly database: LocalDatabase) {}

  async saveExpense(entry: ExpenseEntry): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO expense_entries (id, journey_id, stage_slug, category, amount_eur, spent_at_iso, note, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [entry.id, entry.journeyId, entry.stageSlug ?? null, entry.category, entry.amountEur, entry.spentAtIso, entry.note ?? null, toJson(entry)],
    );
  }

  async getExpensesByJourney(journeyId: string): Promise<ExpenseEntry[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM expense_entries WHERE journey_id = ? ORDER BY spent_at_iso ASC;', [journeyId]);

    return rows.map((row) => fromJson<ExpenseEntry>(row.payload_json));
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.database.run('DELETE FROM expense_entries WHERE id = ?;', [expenseId]);
  }
}
