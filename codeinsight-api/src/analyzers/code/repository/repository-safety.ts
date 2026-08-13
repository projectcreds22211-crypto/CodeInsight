import fs from 'node:fs';
import path from 'node:path';
import { SAFETY_LIMITS } from '../../../config/safety-limits.js';

export interface RepositorySafetyInspectionResult {
  totalFilesScanned: number;
  totalSourceBytes: number;
  largestFileBytes: number;
}

export class RepositorySizeError extends Error {
  public readonly code = 'REPOSITORY_TOO_LARGE';
  public readonly statusCode = 413;
  public readonly limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalSourceBytes: number;
  };

  constructor(message: string) {
    super(message);
    this.name = 'RepositorySizeError';
    this.limits = {
      maxFiles: SAFETY_LIMITS.repository.maxFiles,
      maxFileBytes: SAFETY_LIMITS.repository.maxFileBytes,
      maxTotalSourceBytes: SAFETY_LIMITS.repository.maxTotalSourceBytes,
    };
  }
}

/**
 * Traverses cloned repository directory and verifies safety limits BEFORE running AST analysis.
 * Throws RepositorySizeError if repository exceeds file count, file size, or total source byte limits.
 */
export async function inspectClonedRepositorySafety(
  dirPath: string
): Promise<RepositorySafetyInspectionResult> {
  let totalFilesScanned = 0;
  let totalSourceBytes = 0;
  let largestFileBytes = 0;

  const ignoredDirsSet = new Set(SAFETY_LIMITS.ignoredDirectories.map((d) => d.toLowerCase()));

  async function traverse(currentDir: string, depth: number): Promise<void> {
    if (depth > SAFETY_LIMITS.repository.maxDirectoryDepth) {
      return;
    }

    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirsSet.has(entry.name.toLowerCase())) {
          await traverse(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        totalFilesScanned += 1;
        if (totalFilesScanned > SAFETY_LIMITS.repository.maxFiles) {
          throw new RepositorySizeError(
            `Repository file count limit exceeded: Scanned ${totalFilesScanned} files (maximum allowed is ${SAFETY_LIMITS.repository.maxFiles}).`
          );
        }

        const stat = await fs.promises.stat(fullPath);
        if (stat.size > SAFETY_LIMITS.repository.maxFileBytes) {
          throw new RepositorySizeError(
            `Individual file size limit exceeded: File '${entry.name}' is ${stat.size} bytes (maximum allowed is ${SAFETY_LIMITS.repository.maxFileBytes} bytes / 1MB).`
          );
        }

        totalSourceBytes += stat.size;
        if (totalSourceBytes > SAFETY_LIMITS.repository.maxTotalSourceBytes) {
          throw new RepositorySizeError(
            `Total repository source size limit exceeded: Reached ${totalSourceBytes} bytes (maximum allowed is ${SAFETY_LIMITS.repository.maxTotalSourceBytes} bytes / 10MB).`
          );
        }

        if (stat.size > largestFileBytes) {
          largestFileBytes = stat.size;
        }
      }
    }
  }

  await traverse(dirPath, 1);

  return {
    totalFilesScanned,
    totalSourceBytes,
    largestFileBytes,
  };
}
