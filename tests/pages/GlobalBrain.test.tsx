import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
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

// Mock BrainVisualizer component
jest.mock('@/components/BrainVisualizer', () => ({
  BrainVisualizer: () => <div>BrainVisualizer Mock</div>,
}));

// Mock API config
jest.mock('@/config/api', () => ({
  getApiUrl: (endpoint: string) => `https://test.supabase.co/functions/v1${endpoint}`,
}));

// Import after mocking
import GlobalBrain from '@/pages/GlobalBrain';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockMemories = [
  {
    id: 'mem-1',
    query: 'What is the company revenue goal?',
    response: 'The company aims for $1M ARR in 2026',
    thread_id: 'thread-1',
    agent_name: 'global-brain-ui',
    agent_type: 'manual',
    role: 'user',
    created_at: '2024-02-15T10:00:00Z',
    knowledge_extracted: { source: 'global-brain-ui', manual: true },
  },
  {
    id: 'mem-2',
    query: 'What are our core values?',
    response: 'Excellence, Integrity, Innovation',
    thread_id: 'thread-2',
    agent_name: 'global-brain-ui',
    agent_type: 'manual',
    role: 'user',
    created_at: '2024-02-15T09:00:00Z',
    knowledge_extracted: { source: 'global-brain-ui', manual: true },
  },
];

describe('GlobalBrain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders the page title and description', () => {
    const queryClient = createTestQueryClient();

    // Mock empty stats response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: false }),
    });

    // Mock empty memories response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: false }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    expect(screen.getByText('Global Brain')).toBeDefined();
    expect(screen.getByText(/Company-wide AI memory/)).toBeDefined();
  });

  it('loads and displays brain statistics', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        ok: true,
        stats: {
          total_memories: 42,
          total_facts: 128,
          total_patterns: 15,
        },
      }),
    });

    // Mock empty memories response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: true, memories: [] }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/42 memories/)).toBeDefined();
      expect(screen.getByText(/128 facts/)).toBeDefined();
      expect(screen.getByText(/15 patterns/)).toBeDefined();
    });
  });

  it('loads and displays recent memories', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: false }),
    });

    // Mock memories response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        ok: true,
        memories: mockMemories,
      }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/What is the company revenue/)).toBeDefined();
      expect(screen.getByText(/What are our core values/)).toBeDefined();
    });
  });

  it('inserts new memory via Supabase client when form is submitted', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock Supabase insert
    const mockInsert = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'new-mem-1',
        query: 'test key',
        response: 'test value',
        thread_id: 'thread-new',
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Fill in the form
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/);
    const submitButton = screen.getByText('Store in Global Memory');

    fireEvent.change(keyInput, { target: { value: 'test key' } });
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });
    fireEvent.click(submitButton);

    // Verify Supabase insert was called with correct data
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('agent_memory');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test key',
          response: 'test value',
          agent_name: 'global-brain-ui',
          agent_type: 'manual',
          role: 'user',
          knowledge_extracted: expect.objectContaining({
            source: 'global-brain-ui',
            manual: true,
          }),
        })
      );
    });

    // Verify success toast was shown
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('test key'));
  });

  it('shows loading state while inserting memory', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock Supabase insert with delay
    const mockInsert = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { id: 'new-mem-1' },
                error: null,
              }),
            100
          )
        )
    );

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Fill in the form
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/);
    const submitButton = screen.getByText('Store in Global Memory');

    fireEvent.change(keyInput, { target: { value: 'test key' } });
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });
    fireEvent.click(submitButton);

    // Verify loading state is shown
    await waitFor(() => {
      expect(screen.getByText('Storing...')).toBeDefined();
    });
  });

  it('handles insert errors gracefully', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock Supabase insert error
    const mockInsert = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Fill in the form
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/);
    const submitButton = screen.getByText('Store in Global Memory');

    fireEvent.change(keyInput, { target: { value: 'test key' } });
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });
    fireEvent.click(submitButton);

    // Verify error toast was shown
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Database connection failed'));
    });
  });

  it('validates that key and value are required', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Verify submit button is disabled when form is empty
    const submitButton = screen.getByText('Store in Global Memory') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    // Fill in only key (missing value)
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    fireEvent.change(keyInput, { target: { value: 'test key' } });

    // Button should still be disabled
    expect(submitButton.disabled).toBe(true);

    // Verify Supabase insert was NOT called
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('clears form after successful submission', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock Supabase insert
    const mockInsert = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'new-mem-1' },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Fill in the form
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/) as HTMLInputElement;
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/) as HTMLTextAreaElement;
    const submitButton = screen.getByText('Store in Global Memory');

    fireEvent.change(keyInput, { target: { value: 'test key' } });
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });
    fireEvent.click(submitButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    // Verify form was cleared
    expect(keyInput.value).toBe('');
    expect(valueTextarea.value).toBe('');
  });

  it('refreshes memories after successful submission', async () => {
    const queryClient = createTestQueryClient();

    // Mock initial stats response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock initial memories response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: true, memories: [] }),
    });

    // Mock Supabase insert
    const mockInsert = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'new-mem-1' },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    // Mock refresh responses
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: true, memories: mockMemories }),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ ok: true, stats: { total_memories: 43 } }),
    });

    // Fill in and submit the form
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/);
    const submitButton = screen.getByText('Store in Global Memory');

    fireEvent.change(keyInput, { target: { value: 'test key' } });
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });
    fireEvent.click(submitButton);

    // Verify memories were refreshed after submission
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial 2 + refresh 2
    });
  });

  it('disables submit button when form is invalid', async () => {
    const queryClient = createTestQueryClient();

    // Mock stats response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, memories: [] }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GlobalBrain />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Global Brain')).toBeDefined();
    });

    const submitButton = screen.getByText('Store in Global Memory') as HTMLButtonElement;

    // Button should be disabled initially (empty form)
    expect(submitButton.disabled).toBe(true);

    // Fill in only key
    const keyInput = screen.getByPlaceholderText(/Key \(e.g., company_rule_1\)/);
    fireEvent.change(keyInput, { target: { value: 'test key' } });

    // Button should still be disabled (missing value)
    expect(submitButton.disabled).toBe(true);

    // Fill in value
    const valueTextarea = screen.getByPlaceholderText(/Value or fact to remember/);
    fireEvent.change(valueTextarea, { target: { value: 'test value' } });

    // Button should now be enabled
    expect(submitButton.disabled).toBe(false);
  });
});
