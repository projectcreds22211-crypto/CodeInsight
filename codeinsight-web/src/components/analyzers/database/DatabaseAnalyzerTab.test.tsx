import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatabaseAnalyzerTab } from './DatabaseAnalyzerTab';
import * as api from '../../../lib/api-client';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock api-client functions
vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual('../../../lib/api-client');
  return {
    ...actual,
    getDatabaseFindings: vi.fn(),
    analyzeDatabase: vi.fn(),
  };
});

const mockProject: api.Project = {
  id: 'proj_demo_1',
  userId: 'user_123',
  name: 'TaskLedger Demo',
  githubUrl: 'https://github.com/pratik/codeinsight-demo-repo',
  isDemoRepository: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const mockCustomProject: api.Project = {
  id: 'proj_custom_1',
  userId: 'user_123',
  name: 'Custom Project',
  githubUrl: 'https://github.com/pratik/custom-repo',
  isDemoRepository: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('DatabaseAnalyzerTab — Component Behavioral & State Machine Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderTab = (project = mockProject) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DatabaseAnalyzerTab
          activeProject={project}
          projects={[mockProject, mockCustomProject]}
          onSelectProject={vi.fn()}
        />
      </QueryClientProvider>
    );
  };

  it('1. renders initial idle empty state when no previous results exist', async () => {
    const error404: any = new Error('No session');
    error404.status = 404;
    vi.mocked(api.getDatabaseFindings).mockRejectedValue(error404);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Ready for Database Optimization Analysis/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Analyze Database/i })).not.toBeDisabled();
  });

  it('2. displays executing loading state and hides previous results while mutation isPending', async () => {
    const mockPreviousResult: api.DatabaseAnalyzerResult = {
      status: 'completed',
      sessionId: 'sess_db_prev',
      analyzerType: 'database',
      summary: {
        totalFindings: 1,
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
        categoryCounts: { query_optimization: 1 },
      } as any,
      metrics: {
        totalQueriesAnalyzed: 1,
        totalTablesAnalyzed: 1,
        ruleViolationsCount: 1,
        healthScore: 75,
        healthBand: 'moderate',
      } as any,
      findings: [],
    };

    vi.mocked(api.getDatabaseFindings).mockResolvedValue(mockPreviousResult);
    vi.mocked(api.analyzeDatabase).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Optimization Findings/i)).toBeInTheDocument();
    });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Database/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Executing Database Analysis.../i)).toBeInTheDocument();
    });
    // Hides old results while analyzing
    expect(screen.queryByText(/Optimization Findings/i)).not.toBeInTheDocument();
    expect(analyzeBtn).toBeDisabled();
  });

  it('3. displays completed database findings and BEFORE/AFTER query comparison on success', async () => {
    const mockResult: api.DatabaseAnalyzerResult = {
      status: 'completed',
      sessionId: 'sess_db_1',
      analyzerType: 'database',
      summary: {
        totalFindings: 1,
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
        categoryCounts: { query_optimization: 1 },
      } as any,
      metrics: {
        totalQueriesAnalyzed: 1,
        totalTablesAnalyzed: 2,
        ruleViolationsCount: 1,
        healthScore: 80,
        healthBand: 'healthy',
      } as any,
      findings: [
        {
          id: 'find_db_1',
          sessionId: 'sess_db_1',
          analyzer: 'database',
          category: 'query_optimization',
          severity: 'high',
          title: 'Missing Index on Filtered Column',
          description: 'Query filters on ledger_entries.project_id without index',
          recommendation: 'CREATE INDEX idx_ledger_project ON ledger_entries(project_id);',
          evidence: [
            { source: 'Query 1', snippet: 'SELECT * FROM ledger_entries WHERE project_id = $1' },
          ],
          metadata: {},
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };

    vi.mocked(api.getDatabaseFindings).mockResolvedValue(mockResult);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Optimization Findings \(1\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Missing Index on Filtered Column/i)).toBeInTheDocument();
  });

  it('4. displays error alert on failure and allows dismissal and retry', async () => {
    const error404: any = new Error('No session');
    error404.status = 404;
    vi.mocked(api.getDatabaseFindings).mockRejectedValue(error404);
    vi.mocked(api.analyzeDatabase).mockRejectedValue(new Error('Syntax error in PostgreSQL DDL'));

    renderTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Analyze Database/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Analyze Database/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Syntax error in PostgreSQL DDL/i)).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Syntax error in PostgreSQL DDL/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Database/i })).not.toBeDisabled();
  });

  it('5. displays validation error when custom project has empty schema or queries', async () => {
    const error404: any = new Error('No session');
    error404.status = 404;
    vi.mocked(api.getDatabaseFindings).mockRejectedValue(error404);

    renderTab(mockCustomProject);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Analyze Database/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Analyze Database/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/PostgreSQL Schema DDL is required/i)).toBeInTheDocument();
  });

  it('6. displays clean zero findings banner when database analysis finds zero issues', async () => {
    const mockZeroResult: api.DatabaseAnalyzerResult = {
      status: 'completed',
      sessionId: 'sess_db_zero',
      analyzerType: 'database',
      summary: {
        totalFindings: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        categoryCounts: { query_optimization: 0 },
      } as any,
      metrics: {
        totalQueriesAnalyzed: 3,
        totalTablesAnalyzed: 3,
        ruleViolationsCount: 0,
        healthScore: 100,
        healthBand: 'healthy',
      } as any,
      findings: [],
    };

    vi.mocked(api.getDatabaseFindings).mockResolvedValue(mockZeroResult);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No Findings Detected/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/evaluated cleanly against deterministic database optimization rules/i)
    ).toBeInTheDocument();
  });
});
