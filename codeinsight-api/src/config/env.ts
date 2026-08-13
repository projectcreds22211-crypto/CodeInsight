export interface EnvConfig {
  nodeEnv: string;
  port: number;
  host: string;
  databaseUrl?: string;
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  clerkWebhookSecret?: string;
  anthropicApiKey?: string;
  frontendUrl?: string;
  allowedOrigins: string[];
  isProduction: boolean;
}

export interface EnvValidationResult {
  valid: boolean;
  missingKeys: string[];
  warnings: string[];
}

/**
 * Safely masks secret keys for diagnostic logging (e.g. "sk-ant-...1234").
 */
export function maskSecretKey(secret?: string): string {
  if (!secret) return '(not set)';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

/**
 * Parses allowed CORS origins from FRONTEND_URL or CORS_ORIGIN environment variables.
 */
export function parseAllowedOrigins(frontendUrl?: string, corsOrigin?: string): string[] {
  const originsSet = new Set<string>();

  const rawString = corsOrigin || frontendUrl || '';
  if (rawString.trim()) {
    const parts = rawString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      originsSet.add(part);
    }
  }

  // Always include standard local development origins
  originsSet.add('http://localhost:5173');
  originsSet.add('http://localhost:3000');
  originsSet.add('http://127.0.0.1:5173');

  return Array.from(originsSet);
}

/**
 * Reads environment variables and returns a parsed EnvConfig object.
 */
export function getEnvConfig(): EnvConfig {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  const port = Number(process.env['PORT']) || 3001;
  const host = process.env['HOST'] || '0.0.0.0';

  const databaseUrl = process.env['DATABASE_URL'];
  const clerkPublishableKey = process.env['CLERK_PUBLISHABLE_KEY'];
  const clerkSecretKey = process.env['CLERK_SECRET_KEY'];
  const clerkWebhookSecret = process.env['CLERK_WEBHOOK_SECRET'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  const frontendUrl = process.env['FRONTEND_URL'];
  const corsOrigin = process.env['CORS_ORIGIN'];

  const allowedOrigins = parseAllowedOrigins(frontendUrl, corsOrigin);
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    port,
    host,
    databaseUrl,
    clerkPublishableKey,
    clerkSecretKey,
    clerkWebhookSecret,
    anthropicApiKey,
    frontendUrl,
    allowedOrigins,
    isProduction,
  };
}

/**
 * Validates presence of critical production environment keys.
 */
export function validateEnvironment(config: EnvConfig = getEnvConfig()): EnvValidationResult {
  const missingKeys: string[] = [];
  const warnings: string[] = [];

  if (!config.databaseUrl) {
    missingKeys.push('DATABASE_URL');
  }

  if (!config.clerkPublishableKey) {
    missingKeys.push('CLERK_PUBLISHABLE_KEY');
  }

  if (!config.clerkSecretKey) {
    missingKeys.push('CLERK_SECRET_KEY');
  }

  if (!config.anthropicApiKey) {
    warnings.push(
      'ANTHROPIC_API_KEY is not configured. AI Claude advisory prompts will run in offline fallback mode.'
    );
  }

  if (!config.frontendUrl) {
    warnings.push('FRONTEND_URL is not set. Defaulting CORS origins to localhost origins.');
  }

  return {
    valid: missingKeys.length === 0,
    missingKeys,
    warnings,
  };
}
