import { subDays } from "date-fns";

export const getFollowUpInsights = (
  leads: any[],
  contacts: any[],
  calls: any[],
  deals: any[],
  daysLabel: string,
) => {
  const insights: {
    type: "urgent" | "warning" | "info";
    message: string;
    count: number;
  }[] = [];

  // Leads needing follow-up
  const followUpLeads = leads.filter((l) => l.status === "follow_up");
  if (followUpLeads.length > 0) {
    insights.push({
      type: "urgent",
      message: `${followUpLeads.length} leads marked for follow-up need action`,
      count: followUpLeads.length,
    });
  }

  // No-show appointments
  const noShows = leads.filter((l) => l.status === "no_show");
  if (noShows.length > 0) {
    insights.push({
      type: "urgent",
      message: `${noShows.length} no-shows to reschedule`,
      count: noShows.length,
    });
  }

  // Missed calls
  const missedCalls = calls.filter((c: any) => c.call_status === "missed");
  if (missedCalls.length > 0) {
    insights.push({
      type: "warning",
      message: `${missedCalls.length} missed calls to return`,
      count: missedCalls.length,
    });
  }

  // New leads not contacted
  const newLeads = leads.filter((l) => l.status === "new");
  if (newLeads.length > 0) {
    insights.push({
      type: "warning",
      message: `${newLeads.length} new leads awaiting first contact`,
      count: newLeads.length,
    });
  }

  // Pending deals
  const pendingDeals = deals.filter((d) => d.status === "pending");
  if (pendingDeals.length > 0) {
    const pendingValue = pendingDeals.reduce(
      (sum, d) => sum + (d.deal_value || 0),
      0,
    );
    insights.push({
      type: "info",
      message: `${pendingDeals.length} pending deals worth ${pendingValue.toLocaleString("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 })}`,
      count: pendingDeals.length,
    });
  }

  // Unworked contacts
  const unworkedContacts = contacts.filter((c) => c.contact_unworked === true);
  if (unworkedContacts.length > 0) {
    insights.push({
      type: "warning",
      message: `${unworkedContacts.length} contacts marked as unworked`,
      count: unworkedContacts.length,
    });
  }

  // Appointments set but not held
  const appointmentSet = leads.filter((l) => l.status === "appointment_set");
  if (appointmentSet.length > 0) {
    insights.push({
      type: "info",
      message: `${appointmentSet.length} appointments set - prepare for calls`,
      count: appointmentSet.length,
    });
  }

  // Forgotten Leads (In funnel but no activity in 48h)
  const staleLeads = leads.filter(
    (l) =>
      l.funnel_stage !== "CLOSED_WON" &&
      new Date(l.updated_at || l.created_at) < subDays(new Date(), 2),
  );
  if (staleLeads.length > 0) {
    insights.push({
      type: "urgent",
      message: `${staleLeads.length} forgotten leads (no update in 48h)`,
      count: staleLeads.length,
    });
  }

  return insights;
};
