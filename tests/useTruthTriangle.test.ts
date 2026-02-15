import { useTruthTriangle, TruthTriangleData } from "@/hooks/useTruthTriangle";

// Mock Supabase client
jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock TanStack Query
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

describe("useTruthTriangle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should configure query correctly", () => {
    const mockData: TruthTriangleData = {
      month: "2026-02",
      meta_ad_spend: 50000,
      hubspot_deal_value: 200000,
      stripe_gross_revenue: 180000,
      meta_reported_revenue: 150000,
      hubspot_deal_count: 15,
      gap_stripe_hubspot: 20000,
      true_roas_cash: 3.6,
      pipeline_roas_booked: 4.0,
    };

    (useQuery as jest.Mock).mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      error: null,
    });

    const result = useTruthTriangle();

    expect(useQuery).toHaveBeenCalledWith({
      queryKey: ["truth-triangle"],
      queryFn: expect.any(Function),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });

    expect(result.data).toEqual(mockData);
  });

  it("should transform null values to defaults", async () => {
    const mockData = {
      month: null,
      meta_ad_spend: null,
      hubspot_deal_value: null,
      stripe_gross_revenue: null,
      meta_reported_revenue: null,
      hubspot_deal_count: null,
      gap_stripe_hubspot: null,
      true_roas_cash: null,
      pipeline_roas_booked: null,
    };

    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
    });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockReturnValue({
      single: mockSingle,
    });

    // Get the query function that would be called
    (useQuery as jest.Mock).mockImplementation((config) => {
      return {
        data: null,
        isLoading: false,
        queryFn: config.queryFn,
      };
    });

    useTruthTriangle();
    const queryConfig = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryConfig.queryFn();

    expect(result).toEqual({
      month: "",
      meta_ad_spend: 0,
      hubspot_deal_value: 0,
      stripe_gross_revenue: 0,
      meta_reported_revenue: 0,
      hubspot_deal_count: 0,
      gap_stripe_hubspot: 0,
      true_roas_cash: 0,
      pipeline_roas_booked: 0,
    });
  });

  it("should query view_truth_triangle with correct params", async () => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: {
        month: "2026-02",
        meta_ad_spend: 10000,
        hubspot_deal_value: 50000,
        stripe_gross_revenue: 48000,
        meta_reported_revenue: 40000,
        hubspot_deal_count: 5,
        gap_stripe_hubspot: 2000,
        true_roas_cash: 4.8,
        pipeline_roas_booked: 5.0,
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
    });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockReturnValue({
      single: mockSingle,
    });

    (useQuery as jest.Mock).mockImplementation((config) => {
      return {
        data: null,
        queryFn: config.queryFn,
      };
    });

    useTruthTriangle();
    const queryConfig = (useQuery as jest.Mock).mock.calls[0][0];
    await queryConfig.queryFn();

    expect(supabase.from).toHaveBeenCalledWith("view_truth_triangle");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("month", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockSingle).toHaveBeenCalled();
  });
});
