import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CommandCenter from "@/pages/CommandCenter";
import { useDailyOps } from "@/hooks/useDailyOps";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock("@/hooks/useDailyOps", () => ({
  useDailyOps: jest.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("CommandCenter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the Daily Ops quick-view card with snapshot metrics", async () => {
    (useDailyOps as jest.Mock).mockReturnValue({
      data: {
        sessions_today: 14,
        packages_critical: 2,
        clients_decreasing: 5,
      },
      isLoading: false,
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        ad_spend: 0,
        leads_count: 0,
        deal_stats: { bookings: 0, closed_won: 0, revenue: 0 },
        campaign_funnel: [],
        setter_funnel: [],
        coach_performance: [],
        no_shows: [],
        cold_leads: [],
        churn_risk: [],
        upcoming_assessments: [],
        adset_funnel: [],
        creative_funnel: [],
      },
      error: null,
    });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CommandCenter />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("get_command_center_data", {
        p_days: 30,
      });
    });

    expect(screen.getByText("Daily Ops")).toBeDefined();
    expect(screen.getByText("Sessions Today")).toBeDefined();
    expect(screen.getByText("Packages Critical")).toBeDefined();
    expect(screen.getByText("Clients Decreasing")).toBeDefined();
    expect(screen.getByText("14")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("View full Daily Ops →")).toBeDefined();
  });
});
