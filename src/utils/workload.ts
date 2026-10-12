/** Sentiment contribution: light workload is positive; overwhelming is negative. */
export function normalizeWorkloadForSentiment(workload: number): number {
  return ((5 - workload) / 4) * 100;
}
