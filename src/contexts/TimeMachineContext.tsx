import React, { createContext, useContext, useState, useEffect } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

export type DateRange = {
  from: Date;
  to: Date;
};

// Default: Last 30 Days
const DEFAULT_RANGE: DateRange = {
  from: subDays(new Date(), 30),
  to: new Date(),
};

type TimeMachineContextType = {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  label: string; // e.g. "Last 30 Days"
};

const TimeMachineContext = createContext<TimeMachineContextType | undefined>(
  undefined,
);

export const TimeMachineProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Try to load from localStorage
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    try {
      const saved = localStorage.getItem("vital_time_machine");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          from: new Date(parsed.from),
          to: new Date(parsed.to),
        };
      }
    } catch (e) {
      console.error("Failed to load time machine state", e);
    }
    return DEFAULT_RANGE;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("vital_time_machine", JSON.stringify(dateRange));
    } catch (e) {
      console.error("Failed to save time machine state", e);
    }
  }, [dateRange]);

  // Helper to generate a label
  const label = `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;

  return (
    <TimeMachineContext.Provider value={{ dateRange, setDateRange, label }}>
      {children}
    </TimeMachineContext.Provider>
  );
};

export const useTimeMachine = () => {
  const context = useContext(TimeMachineContext);
  if (context === undefined) {
    throw new Error("useTimeMachine must be used within a TimeMachineProvider");
  }
  return context;
};
