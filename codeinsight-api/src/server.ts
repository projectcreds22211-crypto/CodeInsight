import dotenv from 'dotenv';
import path from 'node:path';

// Load .env from local directory first, then monorepo root directory as fallback
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { buildApp } from './app.js';
import { getEnvConfig, maskSecretKey, validateEnvironment } from './config/env.js';

const env = getEnvConfig();
const envValidation = validateEnvironment(env);

const app = buildApp({
  logger: true,
});

const start = async (): Promise<void> => {
  try {
    app.log.info(
      `Initializing CodeInsight API Server [NODE_ENV=${env.nodeEnv}] (Allowed Origins: ${env.allowedOrigins.join(', ')})`
    );
    app.log.info(
      `Environment Key Audit — Clerk Key: ${maskSecretKey(env.clerkPublishableKey)}, Database: ${env.databaseUrl ? 'Configured' : 'Missing'}, Claude API: ${maskSecretKey(env.anthropicApiKey)}`
    );

    if (envValidation.warnings.length > 0) {
      for (const warning of envValidation.warnings) {
        app.log.warn(`Environment Warning: ${warning}`);
      }
    }

    if (!envValidation.valid && env.isProduction) {
      app.log.error(
        `Critical Production Config Error: Missing required environment variables: ${envValidation.missingKeys.join(', ')}`
      );
      process.exit(1);
    }

    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
