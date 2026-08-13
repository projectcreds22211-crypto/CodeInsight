import dotenv from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Load .env from local directory first, then monorepo root as fallback
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] || '',
  },
});
