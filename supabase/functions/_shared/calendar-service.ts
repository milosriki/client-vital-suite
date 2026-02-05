/**
 * CALENDAR TRUTH SERVICE
 *
 * Goal: meaningful availability.
 * Instead of "I have spots left", we say "I see a slot at 4pm."
 * This is the "Helpful" part of the bot.
 */

export const CalendarService = {
  // In a real app, this would fetch from HubSpot/Calendly API
  getNextSlots(): string[] {
    const today = new Date();
    const slots = [];

    // Generate 2 realistic slots for "Tomorrow" and "Day After"
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    // Mock logic: Always offer tomorrow Morning and day-after Evening
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    slots.push(`${days[tomorrow.getDay()]} at 9:00 AM`);
    slots.push(`${days[dayAfter.getDay()]} at 6:00 PM`);

    return slots;
  },

  checkAvailability(requestedTime: string): boolean {
    // Simple mock: If they ask for "Sunday", say we are closed.
    if (requestedTime.toLowerCase().includes("sunday")) {
      return false;
    }
    return true;
  },
};
