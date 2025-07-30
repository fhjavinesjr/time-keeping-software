import { useEffect, useState } from "react";

// Returns: fromDate and toDate in MM-dd-yyyy HH:mm:ss
export default function useCurrentMonthRange() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date, isStart: boolean) => {
      const month = String(date.getMonth() + 1).padStart(2, "0"); // MM
      const day = String(date.getDate()).padStart(2, "0"); // dd
      const year = date.getFullYear(); // yyyy
      const time = isStart ? "00:00:00" : "23:59:59"; // HH:mm:ss
      return `${month}-${day}-${year} ${time}`;
    };

    setFromDate(formatDate(startOfMonth, true)); // e.g., "07-01-2025 00:00:00"
    setToDate(formatDate(endOfMonth, false)); // e.g., "07-31-2025 23:59:59"
  }, []);

  return { fromDate, setFromDate, toDate, setToDate };
}
