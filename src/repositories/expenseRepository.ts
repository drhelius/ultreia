import type { ExpenseEntry } from '../domain';

export type ExpenseRepository = {
  saveExpense(entry: ExpenseEntry): Promise<void>;
  getExpensesByJourney(journeyId: string): Promise<ExpenseEntry[]>;
  deleteExpense(expenseId: string): Promise<void>;
};
