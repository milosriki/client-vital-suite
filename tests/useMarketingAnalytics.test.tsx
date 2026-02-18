import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeepAnalysis, useMetaAds, useMoneyMap } from "../src/hooks/useMarketingAnalytics";
import { supabase } from "../src/integrations/supabase/client";
import { ReactNode } from "react";

// Mock Supabase client
jest.mock("../src/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDeepAnalysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch and calculate baseline comparison metrics", async () => {
    const mockData = [
      {
        id: "1",
        date: "2026-02-01",
        campaign_id: "camp1",
        spend: 1000,
        leads: 50,
        clicks: 100,
        impressions: 10000,
        conversions: 5,
        frequency: 2.5,
        ctr: 1.0,
        cpc: 10,
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useDeepAnalysis("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.baselineComparison).toBeDefined();
    expect(result.current.data?.baselineComparison.length).toBeGreaterThan(0);
    expect(result.current.data?.cohortAnalysis).toBeDefined();
  });

  it("should handle empty data gracefully", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useDeepAnalysis("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.baselineComparison).toBeDefined();
    expect(result.current.data?.cohortAnalysis).toBeDefined();
  });

  it("should handle errors from Supabase", async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useDeepAnalysis("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe("useMetaAds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch and aggregate Meta Ads metrics", async () => {
    const mockData = [
      {
        id: "1",
        date: "2026-02-01",
        campaign_id: "camp1",
        campaign_name: "Test Campaign",
        spend: 1000,
        leads: 50,
        clicks: 100,
        impressions: 10000,
        frequency: 2.5,
        ctr: 1.0,
        cpc: 10,
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMetaAds("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.metrics).toBeDefined();
    expect(result.current.data?.metrics.length).toBe(5);
    expect(result.current.data?.campaigns).toBeDefined();
  });

  it("should group campaigns correctly", async () => {
    const mockData = [
      {
        id: "1",
        date: "2026-02-01",
        campaign_id: "camp1",
        campaign_name: "Campaign A",
        spend: 1000,
        leads: 50,
        clicks: 100,
        impressions: 10000,
      },
      {
        id: "2",
        date: "2026-02-02",
        campaign_id: "camp1",
        campaign_name: "Campaign A",
        spend: 500,
        leads: 25,
        clicks: 50,
        impressions: 5000,
      },
      {
        id: "3",
        date: "2026-02-03",
        campaign_id: "camp2",
        campaign_name: "Campaign B",
        spend: 2000,
        leads: 100,
        clicks: 200,
        impressions: 20000,
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMetaAds("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.campaigns.length).toBe(2);
    const campaignA = result.current.data?.campaigns.find(c => c.campaign === "Campaign A");
    expect(campaignA?.spend).toBe(1500);
    expect(campaignA?.leads).toBe(75);
  });
});

describe("useMoneyMap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch and calculate ROI metrics", async () => {
    const mockAdsData = [
      {
        id: "1",
        date: "2026-02-01",
        campaign_id: "camp1",
        campaign_name: "Test Campaign",
        spend: 1000,
        leads: 50,
      },
    ];

    const mockDealsData = [
      {
        id: "deal1",
        contact_id: "contact1",
        created_at: "2026-02-01T00:00:00Z",
        deal_value: 5000,
        stage: "closedwon",
      },
    ];

    const mockTransactionsData = [
      {
        id: "txn1",
        contact_id: "contact1",
        created_at: "2026-02-01T00:00:00Z",
        amount: 500000, // $5000 in cents
        status: "succeeded",
      },
    ];

    const mockFrom = jest.fn((table: string) => {
      const mockSelect = {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockImplementation(() => {
              if (table === "facebook_ads_insights") {
                return Promise.resolve({ data: mockAdsData, error: null });
              } else if (table === "deals") {
                return Promise.resolve({ data: mockDealsData, error: null });
              } else if (table === "stripe_transactions") {
                return Promise.resolve({ data: mockTransactionsData, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          }),
        }),
      };
      return mockSelect;
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMoneyMap("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.metrics).toBeDefined();
    expect(result.current.data?.metrics.length).toBe(5);
    expect(result.current.data?.campaignROI).toBeDefined();
    expect(result.current.data?.totalROI).toBeGreaterThan(0);
  });

  it("should calculate CAC and LTV correctly", async () => {
    const mockAdsData = [
      {
        id: "1",
        date: "2026-02-01",
        campaign_id: "camp1",
        campaign_name: "Test Campaign",
        spend: 1000,
        leads: 100,
      },
    ];

    const mockDealsData = [
      {
        id: "deal1",
        contact_id: "contact1",
        created_at: "2026-02-01T00:00:00Z",
        deal_value: 10000,
        stage: "closedwon",
      },
    ];

    const mockTransactionsData = [
      {
        id: "txn1",
        contact_id: "contact1",
        created_at: "2026-02-01T00:00:00Z",
        amount: 1000000, // $10000 in cents
        status: "succeeded",
      },
    ];

    const mockFrom = jest.fn((table: string) => {
      const mockSelect = {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockImplementation(() => {
              if (table === "facebook_ads_insights") {
                return Promise.resolve({ data: mockAdsData, error: null });
              } else if (table === "deals") {
                return Promise.resolve({ data: mockDealsData, error: null });
              } else if (table === "stripe_transactions") {
                return Promise.resolve({ data: mockTransactionsData, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          }),
        }),
      };
      return mockSelect;
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMoneyMap("this_month"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // CAC should be spend/leads = 1000/100 = 10
    // ROI should be revenue/spend = 10000/1000 = 10
    expect(result.current.data?.totalROI).toBeCloseTo(10, 0);
    expect(result.current.data?.totalRevenue).toBeCloseTo(10000, 0);
  });
});
