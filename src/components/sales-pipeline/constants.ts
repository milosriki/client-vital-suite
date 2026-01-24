import {
  Users,
  UserCheck,
  Calendar,
  CheckCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  XCircle,
} from "lucide-react";

export const STATUS_CONFIG = {
  lead: { label: "New Leads", color: "bg-blue-500", icon: Users },
  mql: { label: "MQL (Qualified)", color: "bg-amber-500", icon: UserCheck },
  opportunity: {
    label: "Opportunity (Assesment)",
    color: "bg-purple-500",
    icon: Calendar,
  },
  closed_won: { label: "Closed Won", color: "bg-green-500", icon: CheckCircle },
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
