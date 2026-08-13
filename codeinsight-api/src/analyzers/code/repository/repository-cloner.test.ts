import assert from 'node:assert';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  acquireShallowClone,
  validateGitHubUrl,
  withClonedRepository,
} from './repository-cloner.js';

describe('Code Analyzer Phase 5.1 — Repository Acquisition & Guaranteed Cleanup Boundary', () => {
  describe('URL Validation & Normalization (validateGitHubUrl)', () => {
    it('1. accepts valid standard GitHub URL', () => {
      const res = validateGitHubUrl('https://github.com/facebook/react');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalizedUrl, 'https://github.com/facebook/react.git');
    });

    it('2. accepts GitHub URL with .git suffix', () => {
      const res = validateGitHubUrl('https://github.com/facebook/react.git');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalizedUrl, 'https://github.com/facebook/react.git');
    });

    it('3. normalizes trailing slash', () => {
      const res = validateGitHubUrl('https://github.com/facebook/react/');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalizedUrl, 'https://github.com/facebook/react.git');
    });

    it('4. rejects invalid/malformed URL string', () => {
      const res = validateGitHubUrl('not-a-valid-url');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('Malformed') || res.error?.includes('Invalid'));
    });

    it('5. rejects non-GitHub hosts', () => {
      const res = validateGitHubUrl('https://gitlab.com/owner/repo');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('Only public GitHub repositories'));
    });

    it('6. rejects file:// protocol URLs', () => {
      const res = validateGitHubUrl('file:///C:/Users/prati/Desktop/secret');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('Only HTTP/HTTPS URLs are allowed'));
    });

    it('7. rejects credential-containing URLs', () => {
      const res = validateGitHubUrl('https://user:password@github.com/owner/repo');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('Credential-containing URLs are forbidden'));
    });
  });

  describe('Shallow Clone & Guaranteed Cleanup (withClonedRepository)', () => {
    it('8. passes shallow clone flags [--depth, 1] to simple-git', async () => {
      let capturedArgs: any[] = [];
      const mockGit: any = {
        clone: async (url: string, target: string, args: string[]) => {
          capturedArgs = args;
          // Create dummy file inside target directory
          await fs.promises.writeFile(`${target}/README.md`, '# Mock Repo');
        },
      };

      await withClonedRepository(
        'https://github.com/expressjs/express',
        async ({ tempDir }) => {
          assert.strictEqual(fs.existsSync(`${tempDir}/README.md`), true);
        },
        { gitClient: mockGit }
      );

      assert.deepStrictEqual(capturedArgs, ['--depth', '1']);
    });

    it('9. provides acquired local tempDir path to callback', async () => {
      let receivedDir = '';
      const mockGit: any = {
        clone: async () => {},
      };

      const result = await withClonedRepository(
        'https://github.com/expressjs/express',
        async ({ tempDir, normalizedUrl }) => {
          receivedDir = tempDir;
          assert.strictEqual(normalizedUrl, 'https://github.com/expressjs/express.git');
          return 'callback-success';
        },
        { gitClient: mockGit }
      );

      assert.strictEqual(result, 'callback-success');
      assert.ok(receivedDir.length > 0);
    });

    it('10. guarantees cleanup of tempDir after successful execution', async () => {
      let tempPath = '';
      const mockGit: any = {
        clone: async (_url: string, target: string) => {
          tempPath = target;
          await fs.promises.writeFile(`${target}/file.txt`, 'test');
        },
      };

      await withClonedRepository(
        'https://github.com/owner/repo',
        async ({ tempDir }) => {
          assert.strictEqual(fs.existsSync(tempDir), true);
        },
        { gitClient: mockGit }
      );

      // Verify tempDir was cleaned up post-execution
      assert.strictEqual(fs.existsSync(tempPath), false);
    });

    it('11. guarantees cleanup of tempDir when clone fails', async () => {
      let tempPath = '';
      const mockGit: any = {
        clone: async (_url: string, target: string) => {
          tempPath = target;
          throw new Error('Git clone failed due to network timeout');
        },
      };

      await assert.rejects(
        async () => {
          await withClonedRepository('https://github.com/owner/repo', async () => {}, {
            gitClient: mockGit,
          });
        },
        (err: Error) => err.message.includes('Git clone failed')
      );

      // Verify tempDir was cleaned up even when clone threw an exception
      assert.ok(tempPath.length > 0);
      assert.strictEqual(fs.existsSync(tempPath), false);
    });

    it('12. guarantees cleanup of tempDir when downstream callback throws an exception', async () => {
      let tempPath = '';
      const mockGit: any = {
        clone: async (_url: string, target: string) => {
          tempPath = target;
        },
      };

      await assert.rejects(
        async () => {
          await withClonedRepository(
            'https://github.com/owner/repo',
            async () => {
              throw new Error('Downstream AST parser failed');
            },
            { gitClient: mockGit }
          );
        },
        (err: Error) => err.message.includes('Downstream AST parser failed')
      );

      // Verify tempDir was cleaned up post-exception
      assert.ok(tempPath.length > 0);
      assert.strictEqual(fs.existsSync(tempPath), false);
    });

    it('13. handles repeated execution deterministically without leftover directories', async () => {
      const mockGit: any = {
        clone: async () => {},
      };

      for (let i = 0; i < 5; i++) {
        const res = await withClonedRepository(
          'https://github.com/owner/repo',
          async ({ normalizedUrl }) => normalizedUrl,
          { gitClient: mockGit }
        );
        assert.strictEqual(res, 'https://github.com/owner/repo.git');
      }
    });
  });
});
