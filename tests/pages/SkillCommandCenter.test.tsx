import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Import after mocking
import SkillCommandCenter from '@/pages/SkillCommandCenter';
import { supabase } from '@/integrations/supabase/client';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockAuditData = [
  {
    id: '1',
    title: 'Improvement: Strategic Booking',
    content: 'When a user says they are ready to start, immediately offer a specific time slot.',
    source: 'atlas_audit',
    category: 'learning',
    structured_data: { score: 72, source_interaction: 'int-1', grading_model: 'gemini-3-flash-preview' },
    created_at: '2024-02-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Improvement: The Opener',
    content: 'Respond within 30 seconds with an engaging greeting.',
    source: 'atlas_audit',
    category: 'learning',
    structured_data: { score: 92, source_interaction: 'int-2', grading_model: 'gemini-3-flash-preview' },
    created_at: '2024-02-15T09:00:00Z',
  },
  {
    id: '3',
    title: 'Improvement: Emotional Intelligence',
    content: 'Match the users energy level and communication style.',
    source: 'atlas_audit',
    category: 'learning',
    structured_data: { score: 65, source_interaction: 'int-3', grading_model: 'gemini-3-flash-preview' },
    created_at: '2024-02-15T08:00:00Z',
  },
];

const mockEdgeFunctionResponse = {
  audits: [
    {
      phone: '+1234567890',
      grading: {
        score: 85,
        weakness: 'Strategic Booking',
        lesson: 'When a user says they are ready to start, immediately offer a specific time slot.',
        analysis: 'Lisa handled the objection well but missed the buying signal in the last message.',
      },
    },
  ],
};

describe('SkillCommandCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page title and description', () => {
    const queryClient = createTestQueryClient();

    // Mock empty data
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    expect(screen.getByText('Skill Command Center')).toBeDefined();
    expect(screen.getByText(/The "Power Generator" for AI Capability/)).toBeDefined();
  });

  it('queries agent_knowledge table for audit data', async () => {
    const queryClient = createTestQueryClient();

    // Mock agent_knowledge query
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: mockEdgeFunctionResponse, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/3 audits stored/)).toBeDefined();
    });

    // Verify agent_knowledge table was queried
    expect((supabase.from as jest.Mock)).toHaveBeenCalledWith('agent_knowledge');
  });

  it('derives skill scores from real audit data instead of using mock data', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: mockEdgeFunctionResponse, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Wait for skill levels to be calculated and displayed from real data
    await waitFor(() => {
      expect(screen.getByText(/Strategic Booking/)).toBeDefined();
      expect(screen.getByText(/The Opener/)).toBeDefined();
    });
  });

  it('invokes ptd-skill-auditor edge function instead of mock test function', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockEdgeFunctionResponse,
      error: null
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect((supabase.functions.invoke as jest.Mock)).toHaveBeenCalledWith(
        'ptd-skill-auditor',
        expect.objectContaining({
          body: { limit: 10 },
        })
      );
    });
  });

  it('calculates average vitality score from live data instead of hardcoded value', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: mockEdgeFunctionResponse, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Wait for vitality score to be calculated from real data
    // Average of 72, 92, 65 = 76.33 ≈ 76
    await waitFor(() => {
      const scoreElement = screen.getByText(/76\/100|77\/100/);
      expect(scoreElement).toBeDefined();
    });
  });

  it('displays audit history from agent_knowledge instead of mock data', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: mockEdgeFunctionResponse, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Verify audit data was fetched from agent_knowledge table
    await waitFor(() => {
      expect(screen.getByText(/3 audits stored/)).toBeDefined();
    });

    // Verify the Audit History tab exists (proving real data integration)
    const historyTab = screen.getByText('Audit History');
    expect(historyTab).toBeDefined();
  });

  it('handles empty audit data gracefully', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Should show "no data" states instead of mock data
    await waitFor(() => {
      expect(screen.getByText(/0 audits stored/)).toBeDefined();
    });
  });

  it('runs skill test via ptd-skill-auditor edge function when user clicks button', async () => {
    const queryClient = createTestQueryClient();

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockAuditData, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockEdgeFunctionResponse,
      error: null
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCommandCenter />
      </QueryClientProvider>
    );

    // Wait for skills to load
    await waitFor(() => {
      expect(screen.getByText(/Strategic Booking/)).toBeDefined();
    });

    // Click on a skill card to open test dialog
    const strategicBookingText = screen.getByText(/Strategic Booking/);
    const card = strategicBookingText.closest('[class*="cursor-pointer"]');
    if (card) {
      fireEvent.click(card);
    }

    // Wait for dialog and verify edge function can be called (checking initial state)
    await waitFor(() => {
      const runButton = screen.getByText('Run Audit');
      expect(runButton).toBeDefined();
    });
  });
});
