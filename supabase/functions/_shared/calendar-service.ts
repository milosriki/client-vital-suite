/**
 * CALENDAR TRUTH SERVICE
 *
 * Goal: meaningful availability.
 * Instead of "I have spots left", we say "I see a slot at 4pm."
 * This is the "Helpful" part of the bot.
 */

export const CalendarService = {
  // SMART MOCK: Generates valid slots for the next 3 days (excluding past times)
  getNextSlots(): string[] {
    const slots: string[] = [];
    const now = new Date();
    const options = { timeZone: "Asia/Dubai", hour: "numeric", hour12: false };

    // Generate for next 3 days
    for (let i = 1; i <= 3; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const isWeekend = dayName === "Sunday" || dayName === "Saturday";

      // Trainers work weekends too, but maybe different hours?
      // Let's assume 8am - 8pm daily.

      // Morning Slot (08:00 - 10:00)
      slots.push(`${dayName} at 9:00 AM`);

      // Evening Slot (17:00 - 19:00)
      slots.push(`${dayName} at 6:00 PM`);
    }

    return slots.slice(0, 2); // Return top 2 options ONLY (Scarcity)
  },

  checkAvailability(requestedTime: string): boolean {
    const lower = requestedTime.toLowerCase();
    // Simulate "booked" for Friday mornings
    if (lower.includes("friday") && lower.includes("morning")) {
      return false;
    }
    return true;
  },
};
