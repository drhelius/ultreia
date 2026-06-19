import type { DateIso } from '../../core';
import type { ContentStatus } from '../camino';
import type { BudgetMode } from '../user';

export type BudgetProfile = {
  id: string;
  mode: BudgetMode;
  dailyTargetEur: number;
  contentStatus: ContentStatus;
};

export type ExpenseCategory = 'alojamiento' | 'comida' | 'extras' | 'transporte' | 'lavanderia' | 'farmacia' | 'donativo' | 'monumento' | 'bici';

export type ExpenseEntry = {
  id: string;
  journeyId: string;
  stageSlug?: string;
  category: ExpenseCategory;
  amountEur: number;
  spentAtIso: DateIso;
  note?: string;
};
