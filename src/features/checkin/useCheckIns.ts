import { useCallback, useEffect, useState } from "react";
import { getBusinessDate, shiftBusinessDate } from "../../utils/dateUtils";
import {
  getCheckIns,
  subscribeToCheckIns,
  type CheckInRecord,
} from "./checkInService";

export function useCheckIns(days = 30): CheckInRecord[] {
  const [records, setRecords] = useState<CheckInRecord[]>([]);

  const loadRecords = useCallback(async () => {
    try {
      const today = getBusinessDate();
      const data = await getCheckIns(shiftBusinessDate(today, -(days - 1)), today);
      setRecords(data);
    } catch (error) {
      console.error("Failed to load check-ins:", error);
      setRecords([]);
    }
  }, [days]);

  useEffect(() => {
    void loadRecords();

    const unsubscribe = subscribeToCheckIns(() => {
      void loadRecords();
    });

    return unsubscribe;
  }, [loadRecords]);

  return records;
}
