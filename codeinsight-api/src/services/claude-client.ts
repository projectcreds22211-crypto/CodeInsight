import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared Anthropic SDK client instance for CodeInsight.
 * Reads ANTHROPIC_API_KEY from environment variables.
 */
export function createClaudeClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Return instance with placeholder key to allow instantiation; actual API calls check key presence
    return new Anthropic({ apiKey: 'unconfigured_key' });
  }
  return new Anthropic({ apiKey: key });
}

export const defaultClaudeClient = createClaudeClient();
