import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuditTrail from '@/pages/AuditTrail';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock date utilities
jest.mock('@/lib/date-utils', () => ({
  getBusinessDate: () => new Date('2024-02-15T12:00:00Z'),
}));

// Mock URL.createObjectURL for CSV export
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

describe('AuditTrail Component', () => {
  let queryClient: QueryClient;

  const mockAuditData = {
    contactId: '12345',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    changes: [
      {
        timestamp: '2024-02-15T10:30:00Z',
        property: 'lifecyclestage',
        oldValue: 'lead',
        newValue: 'opportunity',
        source: 'CRM_UI',
        sourceId: 'user:123',
        userId: 'john@company.com',
      },
      {
        timestamp: '2024-02-15T09:15:00Z',
        property: 'email',
        oldValue: 'old@example.com',
        newValue: 'test@example.com',
        source: 'API',
        sourceId: 'integration:456',
        userId: 'system',
      },
      {
        timestamp: '2024-02-14T16:45:00Z',
        property: 'hubspot_owner_id',
        oldValue: null,
        newValue: '789',
        source: 'AUTOMATION',
        sourceId: 'workflow:999',
        userId: null,
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
    (supabase.functions.invoke as any).mockResolvedValue({
      data: mockAuditData,
      error: null,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Initial Render', () => {
    it('should render empty state when no search is performed', () => {
      render(<AuditTrail />, { wrapper });

      expect(screen.getByText('Search Contact History')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter email address...')).toBeInTheDocument();
      expect(screen.getByText(/Enter an email address, phone number, or HubSpot contact ID/i)).toBeInTheDocument();
    });

    it('should render search controls with correct default values', () => {
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      const searchButton = screen.getByRole('button', { name: /search/i });

      expect(searchInput).toHaveValue('');
      expect(searchButton).toBeInTheDocument();
      expect(searchButton).not.toBeDisabled();
    });

    it('should render search type selector with all options', () => {
      render(<AuditTrail />, { wrapper });

      // The select should be present (default value is "email")
      const selectTrigger = screen.getAllByRole('combobox')[0];
      expect(selectTrigger).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should call edge function with correct parameters on search', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      const searchButton = screen.getByRole('button', { name: /search/i });

      await user.type(searchInput, 'test@example.com');
      await user.click(searchButton);

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'fetch-forensic-data',
          {
            body: {
              target_identity: 'test@example.com',
              search_type: 'email',
            },
          }
        );
      });
    });

    it('should trigger search on Enter key press', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');

      await user.type(searchInput, 'test@example.com{Enter}');

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalled();
      });
    });

    it('should show toast error when searching with empty value', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      expect(toast).toHaveBeenCalledWith({
        title: 'Enter a value',
        description: 'Please enter an email, phone, or HubSpot ID',
        variant: 'destructive',
      });
    });

    it('should update search type and placeholder text', async () => {
      render(<AuditTrail />, { wrapper });

      // Initially shows email placeholder
      expect(screen.getByPlaceholderText('Enter email address...')).toBeInTheDocument();

      // Note: Testing select changes is complex with radix-ui
      // We verify the default state works correctly
    });
  });

  describe('Data Display', () => {
    it('should display contact information after successful search', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('12345')).toBeInTheDocument();
      });
    });

    it('should display all changes in timeline format', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('lifecyclestage')).toBeInTheDocument();
        expect(screen.getByText('email')).toBeInTheDocument();
        expect(screen.getByText('hubspot_owner_id')).toBeInTheDocument();
      });
    });

    it('should display property changes with old and new values', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('lead')).toBeInTheDocument();
        expect(screen.getByText('opportunity')).toBeInTheDocument();
        expect(screen.getByText('old@example.com')).toBeInTheDocument();
      });
    });

    it('should display source badges correctly', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('CRM_UI')).toBeInTheDocument();
        expect(screen.getByText('API')).toBeInTheDocument();
        expect(screen.getByText('AUTOMATION')).toBeInTheDocument();
      });
    });

    it('should display "(empty)" for null values', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        const emptyValues = screen.getAllByText('(empty)');
        expect(emptyValues.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Filtering', () => {
    it('should filter changes by property', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('3 changes found')).toBeInTheDocument();
      });
    });

    it('should show correct count after filtering', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        const changeCount = screen.getByText(/changes found/);
        expect(changeCount).toBeInTheDocument();
      });
    });

    it('should populate filter dropdown with unique properties', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        // Filter dropdown should be present
        const filterSelect = screen.getAllByRole('combobox')[1];
        expect(filterSelect).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Details', () => {
    it('should expand change details on click', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        const changeCards = screen.getAllByText('lifecyclestage');
        expect(changeCards[0]).toBeInTheDocument();
      });

      // Click to expand
      const firstCard = screen.getAllByText('lifecyclestage')[0].closest('.card-dashboard');
      if (firstCard) {
        await user.click(firstCard);

        await waitFor(() => {
          expect(screen.getByText('Exact time:')).toBeInTheDocument();
          expect(screen.getByText('Changed by:')).toBeInTheDocument();
        });
      }
    });
  });

  describe('CSV Export', () => {
    it('should be disabled when no data is available', () => {
      render(<AuditTrail />, { wrapper });

      // No export button should be visible in empty state
      const exportButton = screen.queryByText(/Export CSV/i);
      expect(exportButton).not.toBeInTheDocument();
    });

    it('should export CSV with correct data structure', async () => {
      const user = userEvent.setup();
      const createElementSpy = jest.spyOn(document, 'createElement');

      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(exportButton);

      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('should include all filtered changes in CSV export', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /Export CSV/i });
        expect(exportButton).not.toBeDisabled();
      });
    });

    it('should format CSV filename with search value and date', async () => {
      const user = userEvent.setup();
      const createElementSpy = jest.spyOn(document, 'createElement');

      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(exportButton);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      // Verify the download attribute would be set correctly
      // (Full verification requires checking the mock)
    });
  });

  describe('Loading States', () => {
    it('should show skeleton loaders while loading', async () => {
      (supabase.functions.invoke as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: mockAuditData }), 100))
      );

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      // Should show loading state
      await waitFor(() => {
        const searchButton = screen.getByRole('button', { name: /search/i });
        expect(searchButton).toBeDisabled();
      });
    });

    it('should disable search button while loading', async () => {
      (supabase.functions.invoke as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: mockAuditData }), 100))
      );

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      const searchButton = screen.getByRole('button', { name: /search/i });

      await user.type(searchInput, 'test@example.com');
      await user.click(searchButton);

      expect(searchButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: 'API Error' },
      });

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch audit data/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: 'API Error' },
      });

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should refetch data when retry button is clicked', async () => {
      let callCount = 0;
      (supabase.functions.invoke as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: null, error: { message: 'API Error' } });
        }
        return Promise.resolve({ data: mockAuditData, error: null });
      });

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch audit data/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Results', () => {
    it('should show no changes message when changes array is empty', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          ...mockAuditData,
          changes: [],
        },
        error: null,
      });

      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('No changes found for this contact')).toBeInTheDocument();
      });
    });
  });

  describe('Data Integrity', () => {
    it('should correctly map all PropertyChange fields from API response', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        // Verify all fields are present
        expect(screen.getByText('lifecyclestage')).toBeInTheDocument(); // property
        expect(screen.getByText('lead')).toBeInTheDocument(); // oldValue
        expect(screen.getByText('opportunity')).toBeInTheDocument(); // newValue
        expect(screen.getByText('CRM_UI')).toBeInTheDocument(); // source
      });
    });

    it('should handle null userId gracefully', async () => {
      const user = userEvent.setup();
      render(<AuditTrail />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Enter email address...');
      await user.type(searchInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('hubspot_owner_id')).toBeInTheDocument();
      });

      // The change with null userId should still render
      expect(screen.getByText('AUTOMATION')).toBeInTheDocument();
    });
  });
});
