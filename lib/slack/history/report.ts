export type MonthCostInput = {
  month: string;
  total: number;
  processed: number;
  pending: number;
  reservedUsd: number;
};

/** A sample projection, not a provider quote or a promise that later text has the same cost. */
export function costProjection(rows: MonthCostInput[], budgetUsd: number, spentUsd: number) {
  return {
    budgetUsd,
    reservedUsd: spentUsd,
    remainingBudgetUsd: Math.max(0, budgetUsd - spentUsd),
    months: rows.map((row) => ({
      ...row,
      averageReservedUsdPerProcessedMessage: row.processed ? row.reservedUsd / row.processed : null,
      estimatedAdditionalUsd: row.processed
        ? (row.pending * row.reservedUsd) / row.processed
        : null,
      estimatedTotalUsd: row.processed
        ? row.reservedUsd + (row.pending * row.reservedUsd) / row.processed
        : null,
    })),
    estimatePolicy:
      'Observed reserved cost per processed message projected onto fetched pending messages only. Unsampled months, unavailable history and future retries are not estimated. Review representative examples; later text can cost more. Set an external provider hard budget.',
  };
}
