import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { LocationService } from "../location-service.ts";

export async function executeLocationTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "location_control": {
      const { action, address, destination } = input;
      const locationService = new LocationService();

      if (action === "validate") {
        const result = await locationService.validateAddress(address);
        return JSON.stringify(result, null, 2);
      }
      if (action === "check_distance") {
        if (!destination) return "Destination required for distance check";
        const result = await locationService.checkDistance(
          address,
          destination,
        );
        return JSON.stringify(result, null, 2);
      }
      return "Unknown location action";
    }

    default:
      return `Tool ${toolName} not handled by Location executor.`;
  }
}
