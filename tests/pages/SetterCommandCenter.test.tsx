import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SetterCommandCenter from "@/pages/SetterCommandCenter";

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

const buildCallQuery = (result: QueryResult) => ({
  select: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue(result),
});

const buildContactQuery = (result: QueryResult) => ({
  select: jest.fn().mockReturnThis(),
  not: jest.fn().mockResolvedValue(result),
});

describe("SetterCommandCenter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders KPIs, leaderboard, and speed-to-lead data", async () => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const callRecords = [
      {
        id: "1",
        caller_number: "+1 (555) 000-1111",
        caller_name: "Ava",
        call_status: "completed",
        call_outcome: null,
        duration_seconds: 120,
        created_at: twoHoursAgo.toISOString(),
      },
      {
        id: "2",
        caller_number: "+1 (555) 000-1111",
        caller_name: "Ava",
        call_status: "missed",
        call_outcome: null,
        duration_seconds: 60,
        created_at: oneHourAgo.toISOString(),
      },
      {
        id: "3",
        caller_number: "+1 (555) 000-2222",
        caller_name: "Ben",
        call_status: "answered",
        call_outcome: "answered",
        duration_seconds: 30,
        created_at: now.toISOString(),
      },
      {
        id: "4",
        caller_number: "+1 (555) 000-3333",
        caller_name: "Ava",
        call_status: "completed",
        call_outcome: null,
        duration_seconds: 90,
        created_at: tenDaysAgo.toISOString(),
      },
    ];

    const contacts = [
      {
        id: "c1",
        first_name: "Olivia",
        last_name: "Lead",
        phone: "+1 555 000 1111",
        created_at: fourHoursAgo.toISOString(),
      },
      {
        id: "c2",
        first_name: "Noah",
        last_name: "Lead",
        phone: "+1 555 000 2222",
        created_at: thirtyMinutesAgo.toISOString(),
      },
    ];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "call_records") {
        return buildCallQuery({ data: callRecords, error: null });
      }
      if (table === "contacts") {
        return buildContactQuery({ data: contacts, error: null });
      }
      return buildCallQuery({ data: [], error: null });
    });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SetterCommandCenter />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("call_records");
      expect(supabase.from).toHaveBeenCalledWith("contacts");
    });

    await screen.findByText("Setter Command Center");
    expect(screen.getByText("Setter Command Center")).toBeDefined();
    expect(screen.getByText("Total Calls Today")).toBeDefined();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getByText("1:10")).toBeDefined();
    expect(screen.getAllByText("66.7%").length).toBeGreaterThan(0);
    expect(screen.getByText("1.5")).toBeDefined();

    expect(screen.getByText("Ava")).toBeDefined();
    expect(screen.getByText("Ben")).toBeDefined();
    expect(screen.getByText("1:30")).toBeDefined();

    expect(screen.getByText("Olivia Lead")).toBeDefined();
    expect(screen.getByText("Noah Lead")).toBeDefined();
    expect(screen.getByText("2h 0m")).toBeDefined();
    expect(screen.getByText("30m")).toBeDefined();
  });
});
