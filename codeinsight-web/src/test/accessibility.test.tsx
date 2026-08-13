import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AnalyzePage } from '../pages/AnalyzePage';
import { ThreadCard } from '../components/analyzers/correlation/ThreadCard';
import { CodeFindingCard } from '../components/analyzers/code/CodeFindingCard';
import { CodeRepositoryInput } from '../components/analyzers/code/CodeRepositoryInput';
import { LogInputSection } from '../components/analyzers/logs/LogInputSection';
import * as api from '../lib/api-client';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock api-client functions
vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual('../lib/api-client');
  return {
    ...actual,
    getProjects: vi.fn().mockResolvedValue([]),
    getCodeFindings: vi.fn().mockRejectedValue({ status: 404 }),
    getDatabaseFindings: vi.fn().mockRejectedValue({ status: 404 }),
    getLogFindings: vi.fn().mockRejectedValue({ status: 404 }),
    getCorrelationReport: vi.fn().mockResolvedValue({
      projectId: 'proj_demo_1',
      report: null,
      sessionAvailability: { code: true, database: true, logs: true },
      totalFindingsCount: 0,
    }),
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

describe('Phase 7.4 — Accessibility & ARIA Behavioral Tests', () => {
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

  it('1. verifies AnalyzePage renders valid WAI-ARIA tablist, tabs, aria-controls, and tabpanel container', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AnalyzePage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: /Analyzer tabs/i })).toBeInTheDocument();
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);

    const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(activeTab).toBeInTheDocument();
    expect(activeTab).toHaveAttribute('aria-controls');

    const activePanelId = activeTab?.getAttribute('aria-controls');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', activePanelId);
  });

  it('2. verifies ThreadCard header is keyboard-navigable and responds to Enter and Space keys', () => {
    const mockCorrelation: api.GroundedCorrelation = {
      id: 'corr_1',
      findingIds: ['find_code_1'],
      analyzers: ['code'],
      relationship: 'code-to-query',
      explanation: 'Test investigation thread',
      evidence: 'Test evidence',
      confidence: 'high',
    };

    const { container } = render(
      <ThreadCard correlation={mockCorrelation} rank={1} findingsMap={new Map()} />
    );

    const headerBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(headerBtn).toBeInTheDocument();
    expect(headerBtn).toHaveAttribute('tabIndex', '0');
    expect(headerBtn).toHaveAttribute('aria-expanded', 'true');

    // Press Space key to toggle expansion
    fireEvent.keyDown(headerBtn, { key: ' ' });
    expect(headerBtn).toHaveAttribute('aria-expanded', 'false');

    // Press Enter key to toggle expansion back
    fireEvent.keyDown(headerBtn, { key: 'Enter' });
    expect(headerBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('3. verifies CodeFindingCard header is keyboard accessible with aria-expanded state', () => {
    const mockFinding: api.CodeFinding = {
      id: 'find_code_1',
      sessionId: 'sess_code_1',
      analyzer: 'code',
      category: 'architecture',
      severity: 'high',
      title: 'Circular Dependency Detected',
      description: 'TaskService -> ReportGenerator',
      recommendation: 'Refactor interface',
      evidence: [{ source: 'TaskService.ts', snippet: 'import ...' }],
      metadata: {},
      createdAt: '2026-08-01T00:00:00.000Z',
    };

    const { container } = render(<CodeFindingCard finding={mockFinding} />);

    const headerBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(headerBtn).toBeInTheDocument();
    expect(headerBtn).toHaveAttribute('tabIndex', '0');
    expect(headerBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(headerBtn, { key: 'Enter' });
    expect(headerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('4. verifies CodeRepositoryInput sets aria-invalid and aria-describedby when warning is present', () => {
    const onChangeUrl = vi.fn();
    render(
      <CodeRepositoryInput
        githubUrl=""
        onChangeGithubUrl={onChangeUrl}
        onAnalyze={vi.fn()}
        isAnalyzing={false}
        activeProject={mockProject}
      />
    );

    const input = screen.getByRole('textbox', { name: /Public GitHub Repository URL/i });
    fireEvent.change(input, { target: { value: 'https://user:pass@github.com/org/repo' } });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'github-url-warning');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('5. verifies LogInputSection sets aria-invalid and aria-describedby when validation error exists', () => {
    const onChangeLogs = vi.fn();
    render(
      <LogInputSection
        logsText=""
        onChangeLogsText={onChangeLogs}
        onAnalyze={vi.fn()}
        isAnalyzing={false}
        activeProject={mockProject}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /Paste structured JSON logs/i });
    fireEvent.change(textarea, { target: { value: '{ invalid json syntax...' } });

    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('aria-describedby', 'log-json-warning');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
