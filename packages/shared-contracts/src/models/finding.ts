import { AnalyzerType } from '../enums/analyzer-type.js';
import { Category } from '../enums/category.js';
import { Severity } from '../enums/severity.js';
import { Evidence } from './evidence.js';

export interface Finding {
  id: string;
  sessionId: string;
  analyzer: AnalyzerType;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  evidence: Evidence[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}
