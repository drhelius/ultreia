import type { DateIso } from '../../core';

export type JournalEntryStatus = 'draft' | 'saved' | 'discarded';

export type JournalEntry = {
  id: string;
  journeyId: string;
  stageSlug: string;
  dateIso: DateIso;
  status: JournalEntryStatus;
  title: string;
  body: string;
  updatedAtIso: DateIso;
};
