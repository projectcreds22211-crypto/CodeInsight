import { AnalyzerType } from '../enums/analyzer-type.js';
import { AnalyzerResult } from '../models/analyzer-result.js';
import { Result } from '../utils/result.js';

export interface Analyzer<TInput, TResult extends AnalyzerResult = AnalyzerResult> {
  readonly id: AnalyzerType;
  readonly displayName: string;
  validateInput(input: TInput): Result<void>;
  analyze(input: TInput): Promise<TResult>;
}
