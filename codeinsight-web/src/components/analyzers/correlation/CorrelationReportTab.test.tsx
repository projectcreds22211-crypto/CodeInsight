import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorrelationReportTab } from './CorrelationReportTab';
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
    getCorrelationReport: vi.fn(),
    getCodeFindings: vi.fn().mockResolvedValue({ findings: [] }),
    getDatabaseFindings: vi.fn().mockResolvedValue({ findings: [] }),
    getLogFindings: vi.fn().mockResolvedValue({ findings: [] }),
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

describe('CorrelationReportTab — Component Behavioral & State Machine Tests', () => {
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

  const renderTab = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CorrelationReportTab
          activeProject={mockProject}
          projects={[mockProject]}
          onSelectProject={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      </QueryClientProvider>
    );
  };

  it('1. renders initial intentional empty state when no correlation report exists', async () => {
    vi.mocked(api.getCorrelationReport).mockResolvedValue({
      projectId: 'proj_demo_1',
      report: null,
      sessionAvailability: { code: true, database: true, logs: true },
      totalFindingsCount: 5,
    });

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No Investigation Thread Available/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Run Correlation Engine/i })).not.toBeDisabled();
  });

  it('2. displays report skeleton loading state while report query is fetching', async () => {
    vi.mocked(api.getCorrelationReport).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderTab();

    expect(
      screen.getByText(/Loading unified correlation report & investigation threads/i)
    ).toBeInTheDocument();
  });

  it('3. renders persisted correlation report, executive synthesis, and Thread cards on load', async () => {
    const mockReportResponse: api.CorrelationReportResponse = {
      projectId: 'proj_demo_1',
      sessionAvailability: { code: true, database: true, logs: true },
      totalFindingsCount: 8,
      report: {
        id: 'rep_123',
        sessionId: 'sess_corr_1',
        summary:
          'Root cause identified: Circular dependency in TaskService coupled with unindexed query caused connection pool exhaustion.',
        actionPlan: [
          {
            id: 'corr_1',
            findingIds: ['find_code_1', 'find_db_1'],
            analyzers: ['code', 'database'],
            relationship: 'code-to-query',
            explanation: 'TaskService calls report generator which runs unindexed billing query.',
            evidence: 'TaskService.ts line 45 invoking SELECT * FROM ledger_entries',
            confidence: 'high',
          },
        ],
        generatedAt: '2026-08-01T12:00:00.000Z',
      },
    };

    vi.mocked(api.getCorrelationReport).mockResolvedValue(mockReportResponse);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Executive Synthesis Summary/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Root cause identified: Circular dependency in TaskService/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The Thread — Grounded Investigation Chains \(1\)/i)
    ).toBeInTheDocument();
  });

  it('4. renders Partial System Analysis callout banner when only Code and Logs analyzers are active', async () => {
    vi.mocked(api.getCorrelationReport).mockResolvedValue({
      projectId: 'proj_demo_1',
      report: null,
      sessionAvailability: { code: true, database: false, logs: true },
      totalFindingsCount: 4,
    });

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Partial System Analysis:/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Correlation is based on Code \+ Logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Unrun analyzers: Database/i)).toBeInTheDocument();
  });

  it('5. renders clean zero correlations card when report actionPlan is empty', async () => {
    const mockZeroReportResponse: api.CorrelationReportResponse = {
      projectId: 'proj_demo_1',
      sessionAvailability: { code: true, database: true, logs: true },
      totalFindingsCount: 3,
      report: {
        id: 'rep_zero',
        sessionId: 'sess_corr_zero',
        summary:
          'All findings across Code, Database, and Log analyzers appear isolated without cross-layer interaction.',
        actionPlan: [],
        generatedAt: '2026-08-01T12:00:00.000Z',
      },
    };

    vi.mocked(api.getCorrelationReport).mockResolvedValue(mockZeroReportResponse);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No Cross-Layer Systemic Issues Discovered/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Analyzer signals across Code, Database, and Operational Logs appear isolated/i
      )
    ).toBeInTheDocument();
  });
});
