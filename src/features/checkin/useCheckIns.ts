import { useCallback, useEffect, useState } from "react";
import {
  getCheckIns,
  subscribeToCheckIns,
  type CheckInRecord,
} from "./checkInService";

export function useCheckIns(): CheckInRecord[] {
  const [records, setRecords] = useState<CheckInRecord[]>([]);

  const loadRecords = useCallback(async () => {
    try {
      const data = await getCheckIns();
      setRecords(data);
    } catch (error) {
      console.error("Failed to load check-ins:", error);
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    void loadRecords();

    const unsubscribe = subscribeToCheckIns(() => {
      void loadRecords();
    });

    return unsubscribe;
  }, [loadRecords]);

  return records;
}