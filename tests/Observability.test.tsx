/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import Observability from "@/pages/Observability";
import { supabase } from "@/integrations/supabase/client";
import "@testing-library/jest-dom";

// Mock the Supabase client
jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock the date-utils module
jest.mock("@/lib/date-utils", () => ({
  getBusinessDate: jest.fn(() => new Date("2024-01-15T12:00:00Z")),
}));

// Mock the accessibility hook
jest.mock("@/lib/accessibility", () => ({
  useAnnounce: jest.fn(() => jest.fn()),
}));

const mockMetricsData = [
  {
    id: "1",
    correlation_id: "corr-1",
    function_name: "test-function-1",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    latency_ms: 500,
    tokens_in: 100,
    tokens_out: 200,
    cost_usd_est: "0.0001",
    status: "success",
    error_message: null,
    created_at: new Date().toISOString(),
    tags: ["tag1"],
  },
  {
    id: "2",
    correlation_id: "corr-2",
    function_name: "test-function-2",
    provider: "gemini",
    model: "gemini-2-flash",
    latency_ms: 1000,
    tokens_in: 150,
    tokens_out: 250,
    cost_usd_est: "0.0002",
    status: "error",
    error_message: "Test error",
    created_at: new Date().toISOString(),
    tags: ["tag2"],
  },
  {
    id: "3",
    correlation_id: "corr-3",
    function_name: "test-function-1",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    latency_ms: 600,
    tokens_in: 120,
    tokens_out: 180,
    cost_usd_est: "0.00015",
    status: "success",
    error_message: null,
    created_at: new Date().toISOString(),
    tags: null,
  },
];

describe("Observability", () => {
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

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    );
  };

  const mockSupabaseQuery = (data: any, error: any = null) => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockGte = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data, error });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      gte: mockGte,
      order: mockOrder,
      limit: mockLimit,
    });

    return { mockSelect, mockGte, mockOrder, mockLimit };
  };

  it("should render the page title and description", async () => {
    mockSupabaseQuery([]);
    renderWithProviders(<Observability />);

    expect(screen.getByText("AI Observability")).toBeInTheDocument();
    expect(
      screen.getByText("Monitor AI function executions, costs, and performance")
    ).toBeInTheDocument();
  });

  it("should display stats cards with correct values", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("Total Executions")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument(); // totalCalls
    });

    // Success rate: 2 successful out of 3 = 66.7%
    await waitFor(() => {
      expect(screen.getByText("Success Rate")).toBeInTheDocument();
      expect(screen.getByText("66.7%")).toBeInTheDocument();
    });

    // Avg latency: (500 + 1000 + 600) / 3 = 700ms
    await waitFor(() => {
      expect(screen.getByText("Avg Latency")).toBeInTheDocument();
      expect(screen.getByText("700ms")).toBeInTheDocument();
    });

    // Total cost: 0.0001 + 0.0002 + 0.00015 = 0.00045 (displays as $0.0004)
    await waitFor(() => {
      expect(screen.getByText("Total Cost")).toBeInTheDocument();
      const costElements = screen.getAllByText("$0.0004");
      expect(costElements.length).toBeGreaterThan(0);
    });
  });

  it("should display 'By Function' breakdown correctly", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("By Function")).toBeInTheDocument();
      // test-function-1 appears twice in the data
      const functionName = screen.getByText("test-function-1");
      expect(functionName).toBeInTheDocument();
      // Check for call counts
      expect(screen.getByText(/2 calls/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should display 'By AI Provider' breakdown correctly", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("By AI Provider")).toBeInTheDocument();
      // All metrics use "gemini" provider (capitalized as "Gemini")
      const providerName = screen.getByText("Gemini");
      expect(providerName).toBeInTheDocument();
      // Check for 3 calls
      expect(screen.getByText("3 calls")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should display recent executions with correct status badges", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("Recent Executions")).toBeInTheDocument();
    });

    // Should show success badges (2 successful executions)
    await waitFor(() => {
      const successBadges = screen.getAllByText("Success");
      expect(successBadges.length).toBeGreaterThanOrEqual(2);
    });

    // Should show error badge (1 failed execution)
    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
    });
  });

  it("should handle empty data gracefully", async () => {
    mockSupabaseQuery([]);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("No executions recorded yet")).toBeInTheDocument();
      expect(
        screen.getByText("AI functions will appear here once they run")
      ).toBeInTheDocument();
    });

    // Stats should show zeros
    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument(); // totalCalls
      expect(screen.getByText("0.0%")).toBeInTheDocument(); // successRate
      expect(screen.getByText("0ms")).toBeInTheDocument(); // avgLatency
      expect(screen.getByText("$0.0000")).toBeInTheDocument(); // totalCost
    });
  });

  it("should handle query errors and log to console", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testError = new Error("Database query failed");
    mockSupabaseQuery(null, testError);

    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to fetch metrics:",
        testError
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("should handle null data response after successful query", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Mock query that returns null data but no error (edge case)
    const mockSelect = jest.fn().mockReturnThis();
    const mockGte = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      gte: mockGte,
      order: mockOrder,
      limit: mockLimit,
    });

    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to fetch metrics:",
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("should allow changing time range", async () => {
    mockSupabaseQuery(mockMetricsData);
    const user = userEvent.setup();
    renderWithProviders(<Observability />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // Clear the mock call history
    jest.clearAllMocks();

    // Mock for the new query
    mockSupabaseQuery(mockMetricsData);

    // Click on 1h tab
    const oneHourTab = screen.getByRole("tab", { name: "1h" });
    await user.click(oneHourTab);

    // Should trigger a new query with updated time range
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("ai_execution_metrics");
    });
  });

  it("should allow refreshing data", async () => {
    mockSupabaseQuery(mockMetricsData);
    const user = userEvent.setup();
    renderWithProviders(<Observability />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // Clear the mock call history
    jest.clearAllMocks();

    // Click refresh button
    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    await user.click(refreshButton);

    // Should trigger a new query
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("ai_execution_metrics");
    });
  });

  it("should show error indicator for failed executions", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      // The error message should be in the title attribute of AlertTriangle icon
      const alertIcons = document.querySelectorAll('[title="Test error"]');
      expect(alertIcons.length).toBeGreaterThan(0);
    });
  });

  it("should show 'No data yet' when stats are empty for By Function", async () => {
    mockSupabaseQuery([]);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("No data yet")).toBeInTheDocument();
    });
  });

  it("should show 'No provider data yet' when stats are empty for By Provider", async () => {
    mockSupabaseQuery([]);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("No provider data yet")).toBeInTheDocument();
    });
  });

  it("should display LangSmith external link", () => {
    mockSupabaseQuery([]);
    renderWithProviders(<Observability />);

    const langsmithLink = screen.getByRole("link", { name: /langsmith/i });
    expect(langsmithLink).toHaveAttribute("href", "https://smith.langchain.com");
    expect(langsmithLink).toHaveAttribute("target", "_blank");
    expect(langsmithLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should format cost values with 4 decimal places in stats", async () => {
    const dataWithSmallCost = [
      {
        ...mockMetricsData[0],
        cost_usd_est: "0.000123",
      },
    ];
    mockSupabaseQuery(dataWithSmallCost);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      const costElements = screen.getAllByText("$0.0001");
      expect(costElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should format cost values with 6 decimal places in execution list", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("$0.000100")).toBeInTheDocument();
    });
  });

  it("should calculate aggregated stats correctly for multiple calls to same function", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      // test-function-1 has 2 calls with latencies 500 and 600
      // Average should be 550ms
      expect(screen.getByText("test-function-1")).toBeInTheDocument();
      expect(screen.getByText(/2 calls/)).toBeInTheDocument();
      // The average latency (550ms) should appear in the function breakdown
      const text = document.body.textContent || "";
      expect(text).toContain("550");
    }, { timeout: 3000 });
  });

  it("should handle timeout status with appropriate badge", async () => {
    const dataWithTimeout = [
      {
        ...mockMetricsData[0],
        status: "timeout",
      },
    ];
    mockSupabaseQuery(dataWithTimeout);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      expect(screen.getByText("Timeout")).toBeInTheDocument();
    });
  });

  it("should show token counts in execution list", async () => {
    mockSupabaseQuery(mockMetricsData);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      // Should show token information in the recent executions list
      const text = document.body.textContent || "";
      expect(text).toMatch(/100.*200.*tokens/);
    });
  });

  it("should limit recent executions to 50 items", async () => {
    const manyMetrics = Array.from({ length: 100 }, (_, i) => ({
      ...mockMetricsData[0],
      id: `metric-${i}`,
      correlation_id: `corr-${i}`,
    }));
    mockSupabaseQuery(manyMetrics);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      // Should only show 50 executions
      const executionItems = document.querySelectorAll(
        '[class*="bg-muted/30"]'
      );
      expect(executionItems.length).toBeLessThanOrEqual(50);
    });
  });

  it("should truncate long function names in execution list", async () => {
    const dataWithLongName = [
      {
        ...mockMetricsData[0],
        function_name: "very-long-function-name-that-should-be-truncated-in-the-ui",
      },
    ];
    mockSupabaseQuery(dataWithLongName);
    renderWithProviders(<Observability />);

    await waitFor(() => {
      const functionNameElement = screen.getByText(
        "very-long-function-name-that-should-be-truncated-in-the-ui"
      );
      expect(functionNameElement).toBeInTheDocument();
    });

    // Check that the element has the truncate class
    const functionNameElement = screen.getByText(
      "very-long-function-name-that-should-be-truncated-in-the-ui"
    );
    expect(functionNameElement).toHaveClass("truncate");
  });
});
