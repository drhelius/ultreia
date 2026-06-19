import type { JournalEntry } from '../domain';

export type JournalRepository = {
  saveEntry(entry: JournalEntry): Promise<void>;
  getEntry(entryId: string): Promise<JournalEntry | undefined>;
  getEntriesByJourney(journeyId: string): Promise<JournalEntry[]>;
};
