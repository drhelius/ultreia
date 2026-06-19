import type { LocalDatabase } from '../localDatabase';
import { SQLiteChatRepository } from './repositories/SQLiteChatRepository';
import { SQLiteDecisionStateRepository } from './repositories/SQLiteDecisionStateRepository';
import { SQLiteExpenseRepository } from './repositories/SQLiteExpenseRepository';
import { SQLiteJournalRepository } from './repositories/SQLiteJournalRepository';
import { SQLiteJourneyRepository } from './repositories/SQLiteJourneyRepository';
import { SQLiteProgressionRepository } from './repositories/SQLiteProgressionRepository';
import { SQLiteTrackingRepository } from './repositories/SQLiteTrackingRepository';
import { SQLiteUserProfileRepository } from './repositories/SQLiteUserProfileRepository';

export const createSQLiteRepositories = (database: LocalDatabase) => ({
  userProfileRepository: new SQLiteUserProfileRepository(database),
  journeyRepository: new SQLiteJourneyRepository(database),
  trackingRepository: new SQLiteTrackingRepository(database),
  decisionStateRepository: new SQLiteDecisionStateRepository(database),
  journalRepository: new SQLiteJournalRepository(database),
  expenseRepository: new SQLiteExpenseRepository(database),
  progressionRepository: new SQLiteProgressionRepository(database),
  chatRepository: new SQLiteChatRepository(database),
});

export type SQLiteRepositories = ReturnType<typeof createSQLiteRepositories>;
