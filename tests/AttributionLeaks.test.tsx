import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AttributionLeaks from "../src/pages/AttributionLeaks";
import { supabase } from "../src/integrations/supabase/client";

// Mock the supabase client
jest.mock("../src/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe("AttributionLeaks - Leak Detector Tab", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const mockDataReconcilerResponse = {
    success: true,
    period: "this_month",
    financials: {
      total_revenue: 125000,
      attributed_revenue: 100000,
      organic_revenue: 25000,
      ad_spend: 30000,
      db_audit_total: 124500,
      db_audit_breakdown: {
        "Sales Pipeline::Closed Won": 80000,
        "Sales Pipeline::Negotiation": 30000,
        "Sales Pipeline::Proposal": 14500,
      },
      meta_revenue: 50000,
      hubspot_revenue: 50000,
      anytrack_revenue: 50000,
    },
    intelligence: {
      true_roas: 3.33,
      reported_roas: 2.8,
      roas_uplift_percent: 18.9,
      winning_campaigns: [],
    },
    recent_deals: [],
    discrepancies: {
      count: 3,
      items: [
        {
          type: "ATTRIBUTION_MISMATCH",
          deal_id: "DEAL-001",
          deal_name: "Acme Corp Deal",
          message: "HubSpot marked Organic, but Traffic Source indicates Paid Social",
          value: 5000,
        },
        {
          type: "ATTRIBUTION_MISMATCH",
          deal_id: "DEAL-002",
          deal_name: "TechStart Deal",
          message: "Revenue source discrepancy detected",
          value: 3000,
        },
      ],
    },
    revenue_by_source: [],
  };

  it("should calculate leak metrics from real data", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Verify Attributed Revenue metric
      expect(screen.getByText("Attributed Revenue")).toBeTruthy();
      expect(screen.getByText("$125.0K")).toBeTruthy();

      // Verify DB Audit Total metric
      expect(screen.getByText("DB Audit Total")).toBeTruthy();
      expect(screen.getByText("$124.5K")).toBeTruthy();

      // Verify Discrepancies count
      expect(screen.getByText("Discrepancies")).toBeTruthy();
      expect(screen.getByText("3")).toBeTruthy();

      // Verify Accuracy calculation
      expect(screen.getByText("Accuracy")).toBeTruthy();
      // Accuracy should be (124500 / 125000) * 100 = 99.60%
      expect(screen.getByText(/99\.60%/)).toBeTruthy();
    });
  });

  it("should display discrepancies in the table", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Verify discrepancy details are shown
      expect(screen.getByText("DEAL-001")).toBeTruthy();
      expect(screen.getByText("ATTRIBUTION_MISMATCH")).toBeTruthy();
      expect(
        screen.getByText("HubSpot marked Organic, but Traffic Source indicates Paid Social")
      ).toBeTruthy();
      expect(screen.getByText("$5000")).toBeTruthy();
    });
  });

  it("should handle zero discrepancies gracefully", async () => {
    const noDiscrepanciesResponse = {
      ...mockDataReconcilerResponse,
      discrepancies: {
        count: 0,
        items: [],
      },
      financials: {
        ...mockDataReconcilerResponse.financials,
        total_revenue: 124500,
        db_audit_total: 124500,
      },
    };

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: noDiscrepanciesResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Verify zero discrepancies
      expect(screen.getByText("Discrepancies")).toBeTruthy();
      expect(screen.getByText("0")).toBeTruthy();

      // Verify 100% accuracy
      expect(screen.getByText("100.00%")).toBeTruthy();
    });
  });

  it("should display alignment trend from pipeline breakdown", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Verify chart is rendered
      expect(screen.getByText("Alignment Trend (7d)")).toBeTruthy();
    });
  });

  it("should generate auto-alignment log from discrepancies", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Verify auto-alignment log is rendered
      expect(screen.getByText("Auto-Alignment Log")).toBeTruthy();
      expect(screen.getByText("DEAL-001")).toBeTruthy();
    });
  });

  it("should handle API errors gracefully", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "Network error" },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Should not crash, metrics should show default values
      const discrepanciesText = screen.queryByText("Discrepancies");
      expect(discrepanciesText).toBeTruthy();
    });
  });

  it("should refresh data when refresh button is clicked", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Click refresh button
    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    refreshButton.click();

    // Verify invoke was called again
    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    });
  });

  it("should use the correct date range parameter", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockDataReconcilerResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("data-reconciler", {
        body: { date_range: "this_month" },
      });
    });
  });

  it("should handle missing financials data", async () => {
    const incompleteResponse = {
      success: true,
      period: "this_month",
      discrepancies: {
        count: 0,
        items: [],
      },
    };

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: incompleteResponse,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AttributionLeaks />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.queryByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeTruthy();
    });

    // Switch to Leak Detector tab
    const leakDetectorTab = screen.getByRole("tab", { name: /leak detector/i });
    leakDetectorTab.click();

    await waitFor(() => {
      // Should show default values without crashing
      expect(screen.getByText("$0")).toBeTruthy();
      expect(screen.getByText("100.00%")).toBeTruthy();
    });
  });
});
