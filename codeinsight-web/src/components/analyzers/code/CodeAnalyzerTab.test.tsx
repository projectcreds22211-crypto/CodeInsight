import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CodeAnalyzerTab } from './CodeAnalyzerTab';
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
    getCodeFindings: vi.fn(),
    analyzeCode: vi.fn(),
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

describe('CodeAnalyzerTab — Component Behavioral & State Machine Tests', () => {
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
        <CodeAnalyzerTab
          activeProject={mockProject}
          projects={[mockProject]}
          onSelectProject={vi.fn()}
        />
      </QueryClientProvider>
    );
  };

  it('1. renders initial empty state when no analysis session exists (404 response)', async () => {
    const error404: any = new Error('No analysis session found');
    error404.status = 404;
    vi.mocked(api.getCodeFindings).mockRejectedValue(error404);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No Code Analysis Run Yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Analyze Code/i })).not.toBeDisabled();
  });

  it('2. displays restoration skeleton while fetching existing findings', async () => {
    vi.mocked(api.getCodeFindings).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderTab();

    expect(
      screen.getByText(/Restoring latest completed code analysis session/i)
    ).toBeInTheDocument();
  });

  it('3. displays active analyzing state and disables analyze button during execution', async () => {
    const error404: any = new Error('No session');
    error404.status = 404;
    vi.mocked(api.getCodeFindings).mockRejectedValue(error404);
    vi.mocked(api.analyzeCode).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Analyze Code/i })).toBeInTheDocument();
    });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Code/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Analyzing Repository/i)).toBeInTheDocument();
    });
    expect(analyzeBtn).toBeDisabled();
  });

  it('4. displays completed code findings overview and cycle cards upon successful run', async () => {
    const mockResult: api.CodeAnalyzerResult = {
      status: 'completed',
      sessionId: 'sess_code_1',
      analyzerType: 'code',
      summary: {
        totalFindings: 1,
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
        categoryCounts: { architecture: 1, tech_debt: 0 },
      } as any,
      metrics: {
        totalFiles: 15,
        totalLinesOfCode: 1200,
        dependencyNodesCount: 15,
        dependencyEdgesCount: 18,
        circularDependenciesCount: 1,
        codeSmellsCount: 2,
        techDebtScore: 42,
        techDebtBand: 'moderate',
        componentPenalties: {
          cycles: 30,
          longFunctions: 5,
          duplicateLogic: 0,
          unusedExports: 5,
          commentDebt: 2,
          testFileRatio: 0,
        },
      } as any,
      findings: [
        {
          id: 'find_cycle_1',
          sessionId: 'sess_code_1',
          analyzer: 'code',
          category: 'architecture',
          severity: 'high',
          title: 'Circular Dependency Chain Detected',
          description: 'TaskService -> ReportGenerator -> LedgerService -> TaskService',
          recommendation: 'Break cycle with interface extraction',
          evidence: [{ source: 'TaskService.ts', snippet: 'TaskService -> ReportGenerator' }],
          metadata: {},
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };

    vi.mocked(api.getCodeFindings).mockResolvedValue(mockResult);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Circular Dependencies \(1\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/TaskService -> ReportGenerator/i)).toBeInTheDocument();
    expect(screen.getByText(/Tech Debt Score/i)).toBeInTheDocument();
  });

  it('5. renders error banner with role="alert" on failure and enables retry', async () => {
    const error404: any = new Error('No session');
    error404.status = 404;
    vi.mocked(api.getCodeFindings).mockRejectedValue(error404);
    vi.mocked(api.analyzeCode).mockRejectedValue(
      new Error('Failed to acquire git repository shallow clone')
    );

    renderTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Analyze Code/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Analyze Code/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Repository acquisition failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Code/i })).not.toBeDisabled();
  });

  it('6. renders clean pass banner when analysis yields zero findings', async () => {
    const mockZeroResult: api.CodeAnalyzerResult = {
      status: 'completed',
      sessionId: 'sess_code_zero',
      analyzerType: 'code',
      summary: {
        totalFindings: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        categoryCounts: { architecture: 0, tech_debt: 0 },
      } as any,
      metrics: {
        totalFiles: 10,
        totalLinesOfCode: 500,
        dependencyNodesCount: 10,
        dependencyEdgesCount: 12,
        circularDependenciesCount: 0,
        codeSmellsCount: 0,
        techDebtScore: 0,
        techDebtBand: 'healthy',
        componentPenalties: {
          cycles: 0,
          longFunctions: 0,
          duplicateLogic: 0,
          unusedExports: 0,
          commentDebt: 0,
          testFileRatio: 0,
        },
      } as any,
      findings: [],
    };

    vi.mocked(api.getCodeFindings).mockResolvedValue(mockZeroResult);

    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Zero code smells detected!/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/pass all static AST heuristics cleanly/i)).toBeInTheDocument();
  });
});
