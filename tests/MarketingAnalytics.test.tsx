import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MarketingAnalytics from "../src/pages/MarketingAnalytics";
import { supabase } from "../src/integrations/supabase/client";
import userEvent from "@testing-library/user-event";

// Mock Supabase client
jest.mock("../src/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock hooks
jest.mock("../src/hooks/useMarketingAnalytics", () => ({
  useDeepAnalysis: jest.fn(() => ({
    data: {
      baselineComparison: [
        { metric: "CPL", current: 15, baseline: 18, variance: -16.67, status: "improving" },
      ],
      cohortAnalysis: [
        { month: "Feb 2026", leads: 100, conv: 5.0, revenue: 10000, roas: 5.0, cac: 100, trend: "+5%" },
      ],
    },
    isLoading: false,
    refetch: jest.fn(),
  })),
  useMetaAds: jest.fn(() => ({
    data: {
      metrics: [
        { label: "Impressions", value: "1.0M", delta: { value: 10, type: "positive" }, icon: "BarChart3" },
      ],
      campaigns: [
        { campaign: "Test Campaign", status: "Active", spend: 1000, leads: 50, cpl: 20, roas: 5 },
      ],
    },
    isLoading: false,
    refetch: jest.fn(),
  })),
  useMoneyMap: jest.fn(() => ({
    data: {
      metrics: [
        { label: "Total ROI", value: "5.0x", delta: { value: 1.0, type: "positive" }, icon: "TrendingUp" },
      ],
      campaignROI: [
        { campaign: "Test Campaign", spend: 1000, revenue: 5000, roi: 5.0, cac: 20, ltv: 100, margin: 4000 },
      ],
    },
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("MarketingAnalytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the business-intelligence-dashboard function
    (supabase.functions.invoke as any).mockResolvedValue({
      data: {
        zone_a: {
          metrics: {
            ad_spend: 10000,
            new_leads: 500,
            cpl: 20,
            true_roas: 5.0,
            cac: 2000,
          },
        },
        charts: {
          spend_vs_revenue: [
            { day: "Day 1", spend: 100, revenue: 500, target: 400 },
          ],
        },
        campaigns: [
          { name: "Campaign 1", spend: 1000, roas: 5.0 },
        ],
      },
      error: null,
    });
  });

  it("should render the component with header", async () => {
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Marketing Analytics")).toBeInTheDocument();
    });
  });

  it("should render all tabs", async () => {
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("Deep Analysis")).toBeInTheDocument();
      expect(screen.getByText("Meta Ads")).toBeInTheDocument();
      expect(screen.getByText("Money Map")).toBeInTheDocument();
    });
  });

  it("should display overview metrics", async () => {
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Ad Spend")).toBeInTheDocument();
      expect(screen.getByText("Leads")).toBeInTheDocument();
      expect(screen.getByText("CPL")).toBeInTheDocument();
      expect(screen.getByText("ROAS")).toBeInTheDocument();
      expect(screen.getByText("CAC")).toBeInTheDocument();
    });
  });

  it("should switch to Deep Analysis tab", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const deepAnalysisTab = screen.getByText("Deep Analysis");
    await user.click(deepAnalysisTab);

    await waitFor(() => {
      expect(screen.getByText("Historical Baseline Comparison (12 Months)")).toBeInTheDocument();
    });
  });

  it("should switch to Meta Ads tab", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const metaAdsTab = screen.getByText("Meta Ads");
    await user.click(metaAdsTab);

    await waitFor(() => {
      expect(screen.getByText("Campaign Performance")).toBeInTheDocument();
    });
  });

  it("should switch to Money Map tab", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const moneyMapTab = screen.getByText("Money Map");
    await user.click(moneyMapTab);

    await waitFor(() => {
      expect(screen.getByText("Campaign ROI Breakdown")).toBeInTheDocument();
    });
  });

  it("should call refetch when refresh button is clicked", async () => {
    const user = userEvent.setup();
    const mockInvoke = jest.fn().mockResolvedValue({
      data: { zone_a: { metrics: {} } },
      error: null,
    });
    (supabase.functions.invoke as any).mockImplementation(mockInvoke);

    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    await user.click(refreshButton);

    // Wait for the query to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("business-intelligence-dashboard", {
        body: { range: "this_month" },
      });
    });
  });

  it("should handle loading state", () => {
    // Mock loading state
    (supabase.functions.invoke as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    // Component should render without crashing during loading
    expect(screen.getByText("Marketing Analytics")).toBeInTheDocument();
  });

  it("should display real data when available", async () => {
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check if overview metrics are displayed with real data
      expect(screen.getByText("$10,000")).toBeInTheDocument(); // Ad Spend
      expect(screen.getByText("500")).toBeInTheDocument(); // Leads
    });
  });

  it("should render Deep Analysis table with baseline comparison", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const deepAnalysisTab = screen.getByText("Deep Analysis");
    await user.click(deepAnalysisTab);

    await waitFor(() => {
      expect(screen.getByText("CPL")).toBeInTheDocument();
      expect(screen.getByText("Historical Baseline Comparison (12 Months)")).toBeInTheDocument();
    });
  });

  it("should render Meta Ads campaigns table", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const metaAdsTab = screen.getByText("Meta Ads");
    await user.click(metaAdsTab);

    await waitFor(() => {
      expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    });
  });

  it("should render Money Map ROI breakdown table", async () => {
    const user = userEvent.setup();
    render(<MarketingAnalytics />, { wrapper: createWrapper() });

    const moneyMapTab = screen.getByText("Money Map");
    await user.click(moneyMapTab);

    await waitFor(() => {
      expect(screen.getByText("Campaign ROI Breakdown")).toBeInTheDocument();
      expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    });
  });
});
