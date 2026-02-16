/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkflowStrategy from "@/pages/WorkflowStrategy";
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

  const mockSupabaseQuery = (
    tableName: string,
    data: any,
    error: any = null
  ) => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockGte = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data, error });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === tableName) {
        return {
          select: mockSelect,
          gte: mockGte,
          eq: mockEq,
          order: mockOrder,
          limit: mockLimit,
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    return { mockSelect, mockGte, mockEq, mockOrder, mockLimit };
  };

  it("should render the page title and description", async () => {
    mockSupabaseQuery("ai_execution_metrics", []);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    expect(screen.getByText("PTD Edge Functions Strategy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Step-by-step guide to review, fix, and optimize Supabase Edge Functions"
      )
    ).toBeInTheDocument();
  });

  it("should display workflow metrics correctly", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator should show with HIGH priority (66.7% error rate)
      expect(screen.getByText(/Health Calculator/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show execution count
    await waitFor(() => {
      expect(screen.getByText(/3 runs/)).toBeInTheDocument();
    });
  });

  it("should calculate error rates correctly", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator: 2 errors out of 3 = 66.7% error rate
      const text = document.body.textContent || "";
      expect(text).toMatch(/66\.7%/);
    }, { timeout: 3000 });
  });

  it("should prioritize workflows by error rate", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator should be HIGH priority (66.7% error rate)
      const badges = screen.getAllByText("HIGH");
      expect(badges.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should show critical issues alert when high-priority workflows exist", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

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
    mockSupabaseQuery("ai_execution_metrics", successData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("All Systems Operational")).toBeInTheDocument();
      expect(
        screen.getByText("No critical issues detected in the last 7 days.")
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should handle empty execution metrics data", async () => {
    mockSupabaseQuery("ai_execution_metrics", []);
    mockSupabaseQuery("agent_decisions", []);

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
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", mockStrategyRecommendationsData);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("AI Strategy Recommendations")).toBeInTheDocument();
      expect(screen.getByText("workflow_optimization")).toBeInTheDocument();
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should not show recommendations section when empty", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

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
    mockSupabaseQuery("ai_execution_metrics", null, testError);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Execution metrics query error:",
        testError
      );
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when execution metrics returns null data", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSupabaseQuery("ai_execution_metrics", null, null);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Execution metrics query error:",
        expect.any(Error)
      );
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when recommendations query fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testError = new Error("Database connection failed");
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", null, testError);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Strategy recommendations query error:",
        testError
      );
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when recommendations returns null data", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", null, null);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Strategy recommendations query error:",
        expect.any(Error)
      );
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it("should display implementation phases accordion", async () => {
    mockSupabaseQuery("ai_execution_metrics", []);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText("Implementation Phases")).toBeInTheDocument();
      expect(
        screen.getByText("Project Overview & Workflow Prioritization")
      ).toBeInTheDocument();
    });
  });

  it("should display critical configuration checklist", async () => {
    mockSupabaseQuery("ai_execution_metrics", []);
    mockSupabaseQuery("agent_decisions", []);

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
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(screen.getByText(/Latest Error:/)).toBeInTheDocument();
      expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should calculate average latency correctly", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator: (500 + 600 + 450) / 3 = 517ms avg
      const text = document.body.textContent || "";
      expect(text).toMatch(/517ms avg/);
    }, { timeout: 3000 });
  });

  it("should calculate total cost correctly", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      // health-calculator: 0.001 + 0.0015 + 0.0008 = 0.0033
      const text = document.body.textContent || "";
      expect(text).toMatch(/0\.0033/);
    }, { timeout: 3000 });
  });

  it("should display loading skeleton while fetching data", () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    // During initial render, should show skeleton
    expect(screen.queryByText("Loading execution metrics...")).toBeInTheDocument();
  });

  it("should show quick action guide", async () => {
    mockSupabaseQuery("ai_execution_metrics", []);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText('Quick Action Guide: Fix "Authorization Failed" Error')
      ).toBeInTheDocument();
    });
  });

  it("should display workflow count in description", async () => {
    mockSupabaseQuery("ai_execution_metrics", mockExecutionMetricsData);
    mockSupabaseQuery("agent_decisions", []);

    renderWithProviders(<WorkflowStrategy />);

    await waitFor(() => {
      expect(
        screen.getByText(/2 workflows analyzed over the last 7 days/)
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
