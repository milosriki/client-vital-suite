import { describe, it, expect } from "vitest";
import {
  calculateClientHealth,
  calculateIntegrationStatus,
} from "@/lib/ceo-calculations";

describe("CEO Logic Calculations", () => {
  describe("calculateClientHealth", () => {
    it("should return zeros when no date provided", () => {
      const result = calculateClientHealth([], "");
      expect(result.total).toBe(0);
      expect(result.atRiskRevenue).toBe(0);
    });

    it("should correctly aggregate health zones", () => {
      const mockData = [
        { health_zone: "Green", health_score: 90, package_value_aed: 1000 },
        { health_zone: "Red", health_score: 30, package_value_aed: 5000 },
        { health_zone: "Yellow", health_score: 60, package_value_aed: 3000 },
        { health_zone: "Purple", health_score: 95, package_value_aed: 2000 },
      ];

      const result = calculateClientHealth(mockData, "2024-01-01");

      expect(result.total).toBe(4);
      expect(result.green).toBe(1);
      expect(result.red).toBe(1);
      expect(result.yellow).toBe(1);
      expect(result.purple).toBe(1);
    });

    it("should calculate at-risk revenue (Red + Yellow only)", () => {
      const mockData = [
        { health_zone: "Green", package_value_aed: 1000 },
        { health_zone: "Red", package_value_aed: 5000 }, // At risk
        { health_zone: "Yellow", package_value_aed: 3000 }, // At risk
        { health_zone: "Purple", package_value_aed: 2000 },
      ];

      const result = calculateClientHealth(mockData, "2024-01-01");
      expect(result.atRiskRevenue).toBe(8000); // 5000 + 3000
    });

    it("should calculate average health score", () => {
      const mockData = [{ health_score: 100 }, { health_score: 50 }];

      const result = calculateClientHealth(mockData, "2024-01-01");
      expect(result.avgHealth).toBe(75);
    });
  });

  describe("calculateIntegrationStatus", () => {
    it("should determine connection status based on success logs", () => {
      const mockLogs = [
        {
          platform: "stripe",
          status: "success",
          started_at: "2024-01-01T10:00:00Z",
        },
        {
          platform: "hubspot",
          status: "failed",
          started_at: "2024-01-01T09:00:00Z",
        },
      ];
      const mockErrors: any[] = [];

      const result = calculateIntegrationStatus(mockLogs, mockErrors);

      expect(result.stripe.connected).toBe(true);
      expect(result.hubspot.connected).toBe(false);
      expect(result.stripe.lastSync).toBe("2024-01-01T10:00:00Z");
    });

    it("should count unresolved errors", () => {
      const mockLogs: any[] = [];
      const mockErrors = [
        { source: "stripe", error_type: "auth_failed" },
        { source: "stripe", error_type: "timeout" },
        { source: "facebook", error_type: "api_down" },
      ];

      const result = calculateIntegrationStatus(mockLogs, mockErrors);

      expect(result.stripe.errors).toBe(2);
      expect(result.facebook.errors).toBe(1);
      expect(result.hubspot.errors).toBe(0);
    });
  });
});
