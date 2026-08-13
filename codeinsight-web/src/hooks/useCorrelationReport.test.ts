import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunCorrelationStream } from './useCorrelationReport';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock EventSource implementation
class MockEventSource {
  static activeInstances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.activeInstances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  close() {
    this.closed = true;
    MockEventSource.activeInstances = MockEventSource.activeInstances.filter(
      (instance) => instance !== this
    );
  }

  emit(type: string, data?: any) {
    if (this.closed) return;
    const event = { data: data ? JSON.stringify(data) : undefined } as MessageEvent;
    const callbacks = this.listeners[type] || [];
    for (const cb of callbacks) {
      if (typeof cb === 'function') {
        cb(event);
      } else if (cb && 'handleEvent' in cb) {
        cb.handleEvent(event);
      }
    }
  }
}

describe('useRunCorrelationStream Hook — SSE Lifecycle & State Machine', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    MockEventSource.activeInstances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('1. initializes in idle stage with zero active streams', () => {
    const { result } = renderHook(() => useRunCorrelationStream('proj_123'), { wrapper });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.stage).toBe('idle');
    expect(result.current.progressMessage).toBe('');
    expect(result.current.streamError).toBeNull();
    expect(result.current.discoveredCorrelations).toEqual([]);
    expect(MockEventSource.activeInstances.length).toBe(0);
  });

  it('2. transitions stage connecting -> connected -> started -> tool_call -> reasoning -> completed', async () => {
    const { result } = renderHook(() => useRunCorrelationStream('proj_123'), { wrapper });

    await act(async () => {
      result.current.startStream();
    });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.stage).toBe('connecting');
    expect(MockEventSource.activeInstances.length).toBe(1);

    const es = MockEventSource.activeInstances[0];

    act(() => {
      es.emit('connection');
    });
    expect(result.current.stage).toBe('connected');

    act(() => {
      es.emit('started');
    });
    expect(result.current.stage).toBe('started');

    act(() => {
      es.emit('tool_call', { tool: 'get_code_findings' });
    });
    expect(result.current.stage).toBe('tool_call');
    expect(result.current.progressMessage).toContain('Querying code findings');

    act(() => {
      es.emit('reasoning');
    });
    expect(result.current.stage).toBe('reasoning');

    act(() => {
      es.emit('correlation', {
        correlation: {
          id: 'corr_1',
          relationship: 'code-to-query',
          title: 'Unindexed Query in TaskService',
          description: 'High latency query called from circular module',
          referencedFindingIds: ['code_1', 'db_1'],
          evidence: 'Code line 42 invoking slow query',
          confidence: 'high',
        },
      });
    });
    expect(result.current.discoveredCorrelations.length).toBe(1);

    act(() => {
      es.emit('completed', { reportId: 'rep_789' });
    });
    expect(result.current.stage).toBe('completed');
    expect(result.current.isStreaming).toBe(false);
    expect(es.closed).toBe(true);
    expect(MockEventSource.activeInstances.length).toBe(0);
  });

  it('3. enforces single active EventSource (closing EventSource A when startStream is called twice)', async () => {
    const { result } = renderHook(() => useRunCorrelationStream('proj_123'), { wrapper });

    await act(async () => {
      result.current.startStream();
    });

    expect(MockEventSource.activeInstances.length).toBe(1);
    const firstES = MockEventSource.activeInstances[0];
    expect(firstES.closed).toBe(false);

    // Call startStream a second time rapid-fire
    await act(async () => {
      result.current.startStream('custom focus query');
    });

    expect(firstES.closed).toBe(true);
    expect(MockEventSource.activeInstances.length).toBe(1);
    const secondES = MockEventSource.activeInstances[0];
    expect(secondES).not.toBe(firstES);
    expect(secondES.closed).toBe(false);
  });

  it('4. closes EventSource on error and sets streamError', async () => {
    const { result } = renderHook(() => useRunCorrelationStream('proj_123'), { wrapper });

    await act(async () => {
      result.current.startStream();
    });

    const es = MockEventSource.activeInstances[0];

    act(() => {
      es.emit('error', { message: 'Connection reset by server' });
    });

    expect(result.current.stage).toBe('error');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError).toBe('Connection reset by server');
    expect(es.closed).toBe(true);
    expect(MockEventSource.activeInstances.length).toBe(0);
  });

  it('5. closes active EventSource on component unmount (teardown cleanup)', async () => {
    const { result, unmount } = renderHook(() => useRunCorrelationStream('proj_123'), { wrapper });

    await act(async () => {
      result.current.startStream();
    });

    expect(MockEventSource.activeInstances.length).toBe(1);
    const es = MockEventSource.activeInstances[0];

    unmount();

    expect(es.closed).toBe(true);
    expect(MockEventSource.activeInstances.length).toBe(0);
  });
});
