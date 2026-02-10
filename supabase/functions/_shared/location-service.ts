import { corsHeaders } from "./error-handler.ts";

export class LocationService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
  }

  /**
   * Validates an address and returns formatted details + lat/lng.
   */
  async validateAddress(address: string): Promise<any> {
    if (!this.apiKey) return { error: "Google Maps API Key missing" };

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        return {
          valid: true,
          formatted_address: result.formatted_address,
          location: result.geometry.location,
          place_id: result.place_id,
          partial_match: result.partial_match || false,
        };
      }
      return { valid: false, reason: data.status };
    } catch (e) {
      console.error("Geocoding error:", e);
      return { valid: false, error: e.message };
    }
  }

  /**
   * Calculates distance between a client and a coach (or standard location).
   */
  async checkDistance(origin: string, destination: string): Promise<any> {
    if (!this.apiKey) return { error: "Google Maps API Key missing" };

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.rows[0].elements[0].status === "OK") {
        const element = data.rows[0].elements[0];
        return {
          distance_text: element.distance.text,
          distance_value: element.distance.value, // meters
          duration_text: element.duration.text,
          duration_value: element.duration.value, // seconds
          origin_address: data.origin_addresses[0],
          destination_address: data.destination_addresses[0],
        };
      }
      return { error: "Could not calculate distance", raw: data };
    } catch (e) {
      console.error("Distance Matrix error:", e);
      return { error: e.message };
    }
  }
}
