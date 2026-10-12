import { useCallback, useEffect, useState } from "react";
import { getBusinessDate, shiftBusinessDate } from "../../utils/dateUtils";
import { getCheckIns, subscribeToCheckIns, type CheckInRecord } from "./checkInService";

export function useCheckIns(days: number, organizationId?: string) {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const today = getBusinessDate();
      const data = await getCheckIns(shiftBusinessDate(today, -(days - 1)), today, organizationId);
      setRecords(data);
    } catch (cause) {
      console.error("Failed to load check-ins:", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load analytics.");
    } finally { setLoading(false); }
  }, [days, organizationId]);
  useEffect(() => {
    void loadRecords();
    const unsubscribe = subscribeToCheckIns(() => { void loadRecords(); });
    return unsubscribe;
  }, [loadRecords]);
  return { records, loading, error, retry: loadRecords };
}
