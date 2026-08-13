import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

// Load .env from root directory as fallback
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function verifyNeon() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  // Redact password for safe logging
  const redactedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log(`Connecting to Neon database at ${redactedUrl}...`);

  const sql = neon(connectionString);

  try {
    // 1. Connection & Version
    const versionRes = await sql`SELECT version();`;
    const dbNameRes = await sql`SELECT current_database();`;
    console.log('\n--- CONNECTION & SYSTEM ---');
    console.log(`DATABASE CONNECTION: PASS`);
    console.log(`PostgreSQL Version: ${versionRes[0]?.version}`);
    console.log(`Database Name: ${dbNameRes[0]?.current_database}`);

    // 2. Tables Check
    const tablesRes = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tableNames = tablesRes.map((r: any) => r.table_name);
    console.log('\n--- PUBLIC TABLES ---');
    console.log(`Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    const hasUsers = tableNames.includes('users');
    const hasProjects = tableNames.includes('projects');

    console.log(`users table: ${hasUsers ? 'PASS' : 'FAIL'}`);
    console.log(`projects table: ${hasProjects ? 'PASS' : 'FAIL'}`);

    // 3. Users Columns
    if (hasUsers) {
      console.log('\n--- USERS TABLE COLUMNS ---');
      const usersCols = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
      `;
      usersCols.forEach((col: any) => {
        console.log(
          `  - ${col.column_name} (${col.data_type}) | Nullable: ${col.is_nullable} | Default: ${col.column_default || 'NONE'}`
        );
      });
    }

    // 4. Projects Columns
    if (hasProjects) {
      console.log('\n--- PROJECTS TABLE COLUMNS ---');
      const projectsCols = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects'
        ORDER BY ordinal_position;
      `;
      projectsCols.forEach((col: any) => {
        console.log(
          `  - ${col.column_name} (${col.data_type}) | Nullable: ${col.is_nullable} | Default: ${col.column_default || 'NONE'}`
        );
      });
    }

    // 5. Constraints (Primary Keys, Foreign Keys, Unique)
    console.log('\n--- CONSTRAINTS ---');
    const constraintsRes = await sql`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name;
    `;
    constraintsRes.forEach((c: any) => {
      if (c.constraint_type === 'FOREIGN KEY') {
        console.log(
          `  - [${c.table_name}] ${c.constraint_type}: ${c.constraint_name} on (${c.column_name}) -> ${c.foreign_table_name}(${c.foreign_column_name})`
        );
      } else {
        console.log(
          `  - [${c.table_name}] ${c.constraint_type}: ${c.constraint_name} on (${c.column_name})`
        );
      }
    });

    // 6. Indexes
    console.log('\n--- INDEXES ---');
    const indexesRes = await sql`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    indexesRes.forEach((idx: any) => {
      console.log(`  - [${idx.tablename}] ${idx.indexname}: ${idx.indexdef}`);
    });

    // 7. Migration Table Check
    if (tableNames.includes('__drizzle_migrations')) {
      console.log('\n--- MIGRATIONS STATUS ---');
      const migrationsRes =
        await sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC;`;
      console.log(`Drizzle Migrations Applied (${migrationsRes.length}):`);
      migrationsRes.forEach((m: any) => {
        console.log(
          `  - Migration #${m.id} | Applied: ${new Date(Number(m.created_at)).toISOString()}`
        );
      });
    }

    console.log('\n✅ VERIFICATION COMPLETE — ALL READ-ONLY CHECKS COMPLETED.');
  } catch (err: any) {
    console.error(`\n❌ DATABASE VERIFICATION FAILED: ${err.message}`);
    process.exit(1);
  }
}

verifyNeon();
