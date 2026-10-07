export type Department = {
  id: string;
  name: string;
  employeeCount: number;
  currentSentiment: number;
  sentimentTrend: "up" | "down" | "flat";
  sentimentChange: number; // percentage points
};

export type SignalType =
  | "sustained_low_sentiment"
  | "sudden_sentiment_drop"
  | "high_workload"
  | "low_energy"
  | "response_anomaly"
  | "low_sentiment"
  | "leadership_followup";

export type SignalSeverity = "critical" | "high" | "medium" | "low";

export type SignalStatus = "new" | "acknowledged" | "in_review" | "resolved" | "dismissed";

export type Signal = {
  id: string;
  type: SignalType;
  severity: SignalSeverity;
  dateDetected: string; // ISO date
  affectedScope: "employee" | "team" | "department" | "organization";
  targetId: string;
  targetName: string;
  evidence: string;
  status: SignalStatus;
  recommendedAction: string;
};

export type TrendDataPoint = {
  date: string;
  sentiment: number;
  mood: number;
  energy: number;
  workload: number;
  responseRate: number | null;
};
