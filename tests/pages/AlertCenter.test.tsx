import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AlertCenter from "@/pages/AlertCenter";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

type QueryResult = { data: unknown[]; error: unknown | null };

const buildMockQuery = (result: QueryResult) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
  return chain;
};

describe("AlertCenter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page header", () => {
    (supabase.from as jest.Mock).mockReturnValue(
      buildMockQuery({ data: [], error: null }),
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertCenter />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Alert Center")).toBeDefined();
    expect(
      screen.getByText(/Monitor session depletion risks/i),
    ).toBeDefined();
  });

  it("queries session_depletion_alerts and renders rows", async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      buildMockQuery({
        data: [
          {
            id: "1",
            client_name: "Ava Client",
            client_phone: "+123456789",
            remaining_sessions: 2,
            last_coach: "Coach Z",
            priority: "CRITICAL",
            alert_status: "pending",
            created_at: "2025-02-01T12:00:00Z",
          },
        ],
        error: null,
      }),
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertCenter />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("session_depletion_alerts");
    });

    await screen.findByText("Ava Client");
    expect(screen.getByText("Coach Z")).toBeDefined();
    const phoneLink = screen.getByRole("link", { name: "+123456789" });
    expect(phoneLink.getAttribute("href")).toBe("tel:+123456789");
  });

  it("shows empty state when no alerts", async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      buildMockQuery({ data: [], error: null }),
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertCenter />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No alerts found/i)).toBeDefined();
    });
  });
});
