import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { AcquiredRepositoryContext, UrlValidationResult } from './types.js';

/**
 * Validates and normalizes public GitHub repository URLs.
 * Rejects non-HTTP(S), non-GitHub, local file URLs, and credential-containing URLs.
 */
export function validateGitHubUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Repository URL string is required' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Repository URL cannot be empty' };
  }

  // Reject URLs containing embedded credentials (e.g., https://user:pass@github.com/owner/repo)
  const schemeSplit = trimmed.split('://');
  if (schemeSplit.length > 1 && /@/.test(schemeSplit[1])) {
    return { valid: false, error: 'Credential-containing URLs are forbidden' };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol '${parsed.protocol}'. Only HTTP/HTTPS URLs are allowed`,
      };
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return {
        valid: false,
        error: `Invalid host '${parsed.hostname}'. Only public GitHub repositories (github.com) are supported`,
      };
    }

    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length < 2) {
      return {
        valid: false,
        error: 'GitHub URL must specify both owner and repository name',
      };
    }

    const owner = pathSegments[0];
    let repo = pathSegments[1];

    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    if (!repo) {
      return { valid: false, error: 'Invalid repository name in GitHub URL' };
    }

    const normalizedUrl = `https://github.com/${owner}/${repo}.git`;
    return { valid: true, normalizedUrl };
  } catch {
    return { valid: false, error: 'Malformed URL format' };
  }
}

/**
 * Performs a read-only shallow clone (--depth 1) into a target temporary directory using simple-git.
 */
export async function acquireShallowClone(
  normalizedUrl: string,
  targetDir: string,
  options: { gitClient?: SimpleGit } = {}
): Promise<void> {
  const git = options.gitClient || simpleGit();
  await git.clone(normalizedUrl, targetDir, ['--depth', '1']);
}

/**
 * Executes a callback with a temporary shallow clone of a public GitHub repository.
 * Guarantees recursive removal of the temporary directory in a try...finally block.
 */
export async function withClonedRepository<T>(
  repositoryUrl: string,
  callback: (context: AcquiredRepositoryContext) => Promise<T>,
  options: { gitClient?: SimpleGit; tempDirPrefix?: string } = {}
): Promise<T> {
  const validation = validateGitHubUrl(repositoryUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    throw new Error(validation.error || 'Invalid repository URL');
  }

  const normalizedUrl = validation.normalizedUrl;
  const prefix = options.tempDirPrefix || 'codeinsight-repo-';
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    await acquireShallowClone(normalizedUrl, tempDir, { gitClient: options.gitClient });
    return await callback({ tempDir, normalizedUrl });
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr: unknown) {
      console.error(`Failed to clean up temporary directory '${tempDir}':`, cleanupErr);
    }
  }
}
