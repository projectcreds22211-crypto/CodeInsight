import { Category } from '../enums/category.js';
import { Severity } from '../enums/severity.js';

export interface AnalyzerSummary {
  totalFindings: number;
  severityCounts: Record<Severity, number>;
  categoryCounts: Record<Category, number>;
}
