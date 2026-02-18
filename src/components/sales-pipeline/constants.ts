import {
  Users,
  UserCheck,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { DEAL_STAGES, HUBSPOT_STAGE_IDS } from "@/constants/dealStages";

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  [DEAL_STAGES.DECISION_MAKER_BOUGHT_IN]: { label: "Called - Follow up", color: "bg-blue-500", icon: Phone },
  [DEAL_STAGES.QUALIFIED_TO_BUY]: { label: "Assessment Scheduled", color: "bg-indigo-500", icon: CalendarCheck },
  [HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING]: { label: "Assessment Booking", color: "bg-cyan-500", icon: Calendar },
  [HUBSPOT_STAGE_IDS.BOOKED]: { label: "Assessment Confirmed", color: "bg-teal-500", icon: CalendarCheck },
  [HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED]: { label: "Assessment Postponed", color: "bg-amber-500", icon: CalendarClock },
  [HUBSPOT_STAGE_IDS.ASSESSMENT_DONE]: { label: "Assessment Done", color: "bg-purple-500", icon: ClipboardCheck },
  [DEAL_STAGES.CONTRACT_SENT]: { label: "Waiting Decision", color: "bg-orange-500", icon: CalendarX },
  [DEAL_STAGES.CLOSED_WON]: { label: "Closed Won", color: "bg-green-500", icon: CheckCircle },
  [DEAL_STAGES.CLOSED_LOST]: { label: "Closed Lost", color: "bg-red-500", icon: XCircle },
};

export const CALL_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  initiated: { label: "Initiated", color: "bg-gray-500", icon: Phone },
  ringing: { label: "Ringing", color: "bg-blue-500", icon: PhoneCall },
  answered: { label: "Answered", color: "bg-green-500", icon: PhoneCall },
  completed: { label: "Completed", color: "bg-green-600", icon: CheckCircle },
  missed: { label: "Missed", color: "bg-red-500", icon: PhoneMissed },
  voicemail: { label: "Voicemail", color: "bg-amber-500", icon: PhoneOff },
  failed: { label: "Failed", color: "bg-red-600", icon: XCircle },
  busy: { label: "Busy", color: "bg-orange-500", icon: PhoneOff },
};

export const DAYS_FILTER_OPTIONS = [
  { value: "1", label: "Today (24h)" },
  { value: "2", label: "Last 2 days" },
  { value: "3", label: "Last 3 days" },
  { value: "5", label: "Last 5 days" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];
