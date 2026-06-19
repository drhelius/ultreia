import type { BudgetProfile, ExpenseEntry } from '..';

export type BudgetSummary = {
  estimatedTotalEur: number;
  spentTotalEur: number;
  remainingEur: number;
  dailyTargetEur: number;
};

export const calculateBudgetSummary = ({
  budgetProfile,
  estimatedDays,
  expenses,
}: {
  budgetProfile: BudgetProfile;
  estimatedDays: number;
  expenses: ExpenseEntry[];
}): BudgetSummary => {
  const estimatedTotalEur = budgetProfile.dailyTargetEur * estimatedDays;
  const spentTotalEur = Number(expenses.reduce((sum, expense) => sum + expense.amountEur, 0).toFixed(2));

  return {
    estimatedTotalEur,
    spentTotalEur,
    remainingEur: Number((estimatedTotalEur - spentTotalEur).toFixed(2)),
    dailyTargetEur: budgetProfile.dailyTargetEur,
  };
};
