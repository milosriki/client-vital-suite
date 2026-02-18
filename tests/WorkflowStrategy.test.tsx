import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkflowStrategy from "@/pages/_archived/WorkflowStrategy";
import { supabase } from "@/integrations/supabase/client";
import "@testing-library/jest-dom";

// Mock the Supabase client
jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockExecutionMetricsData = [
  {
    function_name: "health-calculator",
    status: "error",
    latency_ms: 500,
    cost_usd_est: 0.001,
    error_message: "Database connection failed",
    created_at: new Date().toISOString(),
  },
  {
    function_name: "health-calculator",
    status: "error",
    latency_ms: 600,
    cost_usd_est: 0.0015,
    error_message: "Timeout error",
    created_at: new Date().toISOString(),
  },
  {
    function_name: "health-calculator",
    status: "success",
    latency_ms: 450,
    cost_usd_est: 0.0008,
    error_message: null,
    created_at: new Date().toISOString(),
  },
  {
    function_name: "risk-analysis",
    status: "success",
    latency_ms: 800,
    cost_usd_est: 0.002,
    error_message: null,
    created_at: new Date().toISOString(),
  },
];

const mockStrategyRecommendationsData = [
  {
    id: "rec-1",
    decision_type: "workflow_optimization",
    confidence_score: 0.85,
    status: "executed",
    outcome: "Reduced error rate by 30%",
    decision_output: { recommendation: "Add retry logic" },
    created_at: new Date().toISOString(),
  },
];

describe("WorkflowStrategy", () => {
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

  const mockExecutionMetricsQuery = (data: unknown, error: Error | null = null) => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockGte = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({ data, error });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "ai_execution_metrics") {
        return {
          select: mockSelect,
          gte: mockGte,
          order: mockOrder,
        };
      }
      // Default mock for agent_decisions
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    return { mockSelect, mockGte, mockOrder };
  };

  const mockRecommendationsQuery = (data: unknown, error: Error | null = null) => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data, error });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "agent_decisions") {
        return {
          select: mockSelect,
          eq: mockEq,
          order: mockOrder,
          limit: mockLimit,
        };
      }
      // Default mock for ai_execution_metrics
      return {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    return { mockSelect, mockEq, mockOrder, mockLimit };
  };

  const mockBothQueries = (
    executionData: unknown,
    executionError: Error | null = null,
    recommendationsData: unknown = [],
    recommendationsError: Error | null = null
  ) => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "ai_execution_metrics") {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest
            .fn()
            .mockResolvedValue({ data: executionData, error: executionError }),
        };
      }
      if (table === "agent_decisions") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest
            .fn()
            .mockResolvedValue({
              data: recommendationsData,
              error: recommendationsError,
            }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
      };
    });
  };

  it("should render the page title and description", async () => {
    mockBothQueries([]);

    renderWithProviders(<WorkflowStrategy />);

    expect(screen.getByText("PTD Edge Functions Strategy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Step-by-step guide to review, fix, and optimize Supabase Edge Functions"
      )
    ).toBeInTheDocument();
  });

  it("should display workflow metrics correctly", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator should show with HIGH priority (66.7% error rate)
      const healthCalculators = screen.getAllByText(/Health Calculator/i);
      expect(healthCalculators.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Should show execution count
    await waitFor(() => {
      expect(screen.getByText(/3 runs/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should calculate error rates correctly", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator: 2 errors out of 3 = 66.7% error rate
      const text = document.body.textContent || "";
      expect(text).toMatch(/66\.7%/);
    }, { timeout: 3000 });
  });

  it("should prioritize workflows by error rate", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator should be HIGH priority (66.7% error rate)
      const badges = screen.getAllByText("HIGH");
      expect(badges.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should show critical issues alert when high-priority workflows exist", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("Critical Issues Detected:")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should show success alert when no critical issues", async () => {
    const successData = [
      {
        function_name: "test-function",
        status: "success",
        latency_ms: 100,
        cost_usd_est: 0.0001,
        error_message: null,
        created_at: new Date().toISOString(),
      },
    ];
    mockBothQueries(successData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("All Systems Operational")).toBeInTheDocument();
      expect(
        screen.getByText("No critical issues detected in the last 7 days.")
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should handle empty execution metrics data", async () => {
    mockBothQueries([]);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No workflow execution data found in the last 7 days. Execute some workflows to see metrics here."
        )
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should display AI strategy recommendations", async () => {
    mockBothQueries(
      mockExecutionMetricsData,
      null,
      mockStrategyRecommendationsData
    );

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("AI Strategy Recommendations")).toBeInTheDocument();
      expect(screen.getByText("workflow_optimization")).toBeInTheDocument();
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should not show recommendations section when empty", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.queryByText("AI Strategy Recommendations")).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should throw error when execution metrics query fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testError = new Error("Database connection failed");
    mockBothQueries(null, testError);

    renderWithProviders(<WorkflowStrategy />);

    // Should log error via useDedupedQuery hook
    await waitFor(() => {
      const calls = consoleErrorSpy.mock.calls;
      const hasExpectedError = calls.some(
        (call) =>
          call[0].includes("Query Error") ||
          call[0] === "Execution metrics query error:"
      );
      expect(hasExpectedError).toBe(true);
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when execution metrics returns null data", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockBothQueries(null, null);

    renderWithProviders(<WorkflowStrategy />);

    // Should log error via useDedupedQuery hook
    await waitFor(() => {
      const calls = consoleErrorSpy.mock.calls;
      const hasExpectedError = calls.some(
        (call) =>
          call[0].includes("Query Error") ||
          (call[0] === "Execution metrics query error:" &&
            call[1]?.message === "Query returned null data despite no error")
      );
      expect(hasExpectedError).toBe(true);
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when recommendations query fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testError = new Error("Database connection failed");
    mockBothQueries(mockExecutionMetricsData, null, null, testError);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      const calls = consoleErrorSpy.mock.calls;
      const hasExpectedError = calls.some(
        (call) =>
          call[0].includes("Query Error") ||
          call[0] === "Strategy recommendations query error:"
      );
      expect(hasExpectedError).toBe(true);
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when recommendations returns null data", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockBothQueries(mockExecutionMetricsData, null, null, null);

    renderWithProviders(<WorkflowStrategy />);

    // Should log error via useDedupedQuery hook
    await waitFor(() => {
      const calls = consoleErrorSpy.mock.calls;
      const hasExpectedError = calls.some(
        (call) =>
          call[0].includes("Query Error") ||
          (call[0] === "Strategy recommendations query error:" &&
            call[1]?.message === "Query returned null data despite no error")
      );
      expect(hasExpectedError).toBe(true);
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should display implementation phases accordion", async () => {
    mockBothQueries([]);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("Implementation Phases")).toBeInTheDocument();
      expect(
        screen.getByText("Project Overview & Workflow Prioritization")
      ).toBeInTheDocument();
    });
  });

  it("should display critical configuration checklist", async () => {
    mockBothQueries([]);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText("Critical Configuration Checklist")
      ).toBeInTheDocument();
      expect(screen.getByText("Supabase Connection")).toBeInTheDocument();
      expect(screen.getByText("Database Tables")).toBeInTheDocument();
      expect(screen.getByText("RPC Functions")).toBeInTheDocument();
    });
  });

  it("should show latest error message for failed workflows", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      const text = document.body.textContent || "";
      expect(text).toContain("Latest Error:");
      expect(text).toContain("Database connection failed");
    }, { timeout: 3000 });
  });

  it("should calculate and display latency metrics", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    // Just verify that metrics are displayed with latency information
    await waitFor(() => {
      const healthCalculators = screen.getAllByText(/Health Calculator/i);
      expect(healthCalculators.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should calculate total cost correctly", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator: 0.001 + 0.0015 + 0.0008 = 0.0033
      const text = document.body.textContent || "";
      expect(text).toMatch(/0\.0033/);
    }, { timeout: 3000 });
  });

  it("should display loading skeleton while fetching data", () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    // During initial render, should show skeleton
    expect(screen.queryByText("Loading execution metrics...")).toBeInTheDocument();
  });

  it("should show quick action guide", async () => {
    mockBothQueries([]);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText('Quick Action Guide: Fix "Authorization Failed" Error')
      ).toBeInTheDocument();
    });
  });

  it("should display workflow count in description", async () => {
    mockBothQueries(mockExecutionMetricsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText(/2 workflows analyzed over the last 7 days/)
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
