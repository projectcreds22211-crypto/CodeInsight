import assert from 'node:assert';
import { describe, it } from 'node:test';
import { getEnvConfig, maskSecretKey, parseAllowedOrigins, validateEnvironment } from './env.js';

describe('Phase 7.7 — Environment Configuration & Production Readiness', () => {
  describe('Secret Key Masking Helper', () => {
    it('masks long API secret keys safely without leaking sensitive tokens', () => {
      const secret = 'sk-ant-api03-abcdef1234567890xyz';
      const masked = maskSecretKey(secret);

      assert.ok(masked.startsWith('sk-ant-'));
      assert.ok(masked.endsWith('0xyz'));
      assert.ok(masked.includes('...'));
      assert.strictEqual(masked.includes('abcdef1234567890'), false);
    });

    it('handles missing or short secrets gracefully', () => {
      assert.strictEqual(maskSecretKey(undefined), '(not set)');
      assert.strictEqual(maskSecretKey(''), '(not set)');
      assert.strictEqual(maskSecretKey('12345'), '****');
    });
  });

  describe('CORS Allowed Origins Parsing', () => {
    it('parses comma-separated origins from FRONTEND_URL or CORS_ORIGIN', () => {
      const origins = parseAllowedOrigins(
        'https://codeinsight.vercel.app, https://preview.vercel.app'
      );

      assert.ok(origins.includes('https://codeinsight.vercel.app'));
      assert.ok(origins.includes('https://preview.vercel.app'));
      assert.ok(origins.includes('http://localhost:5173'));
    });

    it('always includes standard local dev origins by default', () => {
      const origins = parseAllowedOrigins();
      assert.ok(origins.includes('http://localhost:5173'));
      assert.ok(origins.includes('http://localhost:3000'));
    });
  });

  describe('Environment Config & Production Validation', () => {
    it('provides sensible defaults for PORT and HOST', () => {
      const config = getEnvConfig();
      assert.ok(typeof config.port === 'number');
      assert.ok(typeof config.host === 'string');
      assert.ok(Array.isArray(config.allowedOrigins));
    });

    it('reports missing required keys when environment is unconfigured', () => {
      const emptyConfig = {
        nodeEnv: 'production',
        port: 3001,
        host: '0.0.0.0',
        allowedOrigins: ['http://localhost:5173'],
        isProduction: true,
      };

      const result = validateEnvironment(emptyConfig);
      assert.strictEqual(result.valid, false);
      assert.ok(result.missingKeys.includes('DATABASE_URL'));
      assert.ok(result.missingKeys.includes('CLERK_PUBLISHABLE_KEY'));
      assert.ok(result.missingKeys.includes('CLERK_SECRET_KEY'));
    });

    it('validates successfully when all required environment variables are set', () => {
      const validConfig = {
        nodeEnv: 'production',
        port: 3001,
        host: '0.0.0.0',
        databaseUrl: 'postgresql://user:pass@ep-test.neon.tech/db',
        clerkPublishableKey: 'pk_test_123',
        clerkSecretKey: 'sk_test_123',
        anthropicApiKey: 'sk-ant-123',
        frontendUrl: 'https://codeinsight.vercel.app',
        allowedOrigins: ['https://codeinsight.vercel.app'],
        isProduction: true,
      };

      const result = validateEnvironment(validConfig);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.missingKeys.length, 0);
    });
  });
});
