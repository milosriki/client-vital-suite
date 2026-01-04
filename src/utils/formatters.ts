export const formatStatus = (status: string): string => {
  if (!status) return "New";
  
  const map: Record<string, string> = {
    "CONNECTED": "Connected",
    "ATTEMPTED": "Attempted",
    "LEFT_VOICEMAIL": "Left Voicemail",
    "BAD_TIMING": "Bad Timing",
    "WRONG_NUMBER": "Wrong Number",
    "DISQUALIFIED": "Disqualified",
    "QUALIFIED": "Qualified",
    "NEW": "New"
  };

  return map[status] || status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "CONNECTED": return "bg-green-100 text-green-800";
    case "QUALIFIED": return "bg-blue-100 text-blue-800";
    case "ATTEMPTED": return "bg-yellow-100 text-yellow-800";
    case "LEFT_VOICEMAIL": return "bg-orange-100 text-orange-800";
    case "DISQUALIFIED": return "bg-gray-100 text-gray-800";
    case "BAD_TIMING": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};
