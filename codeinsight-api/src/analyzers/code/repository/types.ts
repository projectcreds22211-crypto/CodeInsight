/**
 * Result of GitHub repository URL validation
 */
export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Repository acquisition context passed into analyzer callback
 */
export interface AcquiredRepositoryContext {
  /** Path to temporary directory containing shallow cloned repository files */
  tempDir: string;
  /** Normalized GitHub repository URL (e.g., https://github.com/owner/repo.git) */
  normalizedUrl: string;
}

/**
 * Result of shallow clone repository acquisition operation
 */
export interface CloneAcquisitionResult {
  success: boolean;
  normalizedUrl?: string;
  tempDir?: string;
  error?: string;
}
