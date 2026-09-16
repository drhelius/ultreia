import type { Coordinates, DateIso, Evidence } from '../../core';

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
  kind?: 'journal' | 'incident';
  incidentType?: string;
  coordinates?: Coordinates;
  evidence?: Evidence;
};
