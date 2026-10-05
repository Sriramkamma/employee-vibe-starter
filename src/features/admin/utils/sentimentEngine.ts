export type CheckInRecord = {
  date: string; // YYYY-MM-DD
  userId: string;
  mood: number; // 1-5
  energy: number; // 1-5
  workload: number; // 1-5
};

// VIBE's core requirement includes detection of sustained low sentiment across 4 consecutive working days.
// The project has 6 working days per week.
const WORKING_DAYS_PER_WEEK = 6;

// Convert a 1-5 scale to a 0-100 score for normalization
export function normalizeScore(value: number): number {
  if (value < 1) return 0;
  if (value > 5) return 100;
  return ((value - 1) / 4) * 100;
}

/**
 * Calculates a weighted sentiment score based on mood, energy, and workload.
 * Mood is primary, energy is secondary, workload is tertiary (inverted because high workload is stressful).
 * Example weightings (configurable):
 * Mood: 50%
 * Energy: 30%
 * Workload: 20% (inverted)
 */
export function calculateSentiment(mood: number, energy: number, workload: number): number {
  const normalizedMood = normalizeScore(mood);
  const normalizedEnergy = normalizeScore(energy);
  // Workload is inverted (1 comfortable -> 100 score, 5 overwhelming -> 0 score)
  const normalizedWorkload = 100 - normalizeScore(workload);

  const weightedScore = normalizedMood * 0.5 + normalizedEnergy * 0.3 + normalizedWorkload * 0.2;
  return Math.round(weightedScore);
}

/**
 * Checks if a user has sustained low sentiment for a given number of consecutive working days.
 * Assuming the records are sorted by date ascending.
 */
export function detectSustainedLowSentiment(
  records: CheckInRecord[],
  threshold: number = 60, // Scores below 60 are considered low
  consecutiveDaysRequired: number = 4
): boolean {
  let consecutiveLowDays = 0;

  for (const record of records) {
    const sentiment = calculateSentiment(record.mood, record.energy, record.workload);
    if (sentiment < threshold) {
      consecutiveLowDays++;
      if (consecutiveLowDays >= consecutiveDaysRequired) {
        return true;
      }
    } else {
      consecutiveLowDays = 0;
    }
  }

  return false;
}

/**
 * Detects sudden drop in sentiment.
 * Compares average of recent baseline to current score.
 */
export function detectSuddenDrop(
  baselineRecords: CheckInRecord[],
  currentRecord: CheckInRecord,
  dropThreshold: number = 20
): boolean {
  if (baselineRecords.length === 0) return false;

  const baselineScores = baselineRecords.map(r => calculateSentiment(r.mood, r.energy, r.workload));
  const avgBaseline = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length;

  const currentScore = calculateSentiment(currentRecord.mood, currentRecord.energy, currentRecord.workload);

  return (avgBaseline - currentScore) >= dropThreshold;
}
