import { AnalyzerType } from '../enums/analyzer-type.js';
import { AnalyzerMetrics } from './analyzer-metrics.js';
import { AnalyzerSummary } from './analyzer-summary.js';
import { Finding } from './finding.js';

export type AnalyzerStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalyzerResult<TMetadata = Record<string, unknown>> {
  sessionId: string;
  analyzerType: AnalyzerType;
  status: AnalyzerStatus;
  findings: Finding[];
  summary: AnalyzerSummary;
  metrics: AnalyzerMetrics;
  customData?: TMetadata;
}
