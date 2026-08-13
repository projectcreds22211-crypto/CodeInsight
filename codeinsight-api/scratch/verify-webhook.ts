import dotenv from 'dotenv';
import path from 'node:path';
import { Webhook } from 'svix';

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { buildApp } from '../src/app.js';
import { getDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('--- Starting Clerk Webhook Verification Suite ---');

  // Set test webhook secret
  const testSecret = 'whsec_Mf2Jy8B6VDH15T8i3a24681012141618';
  process.env['CLERK_WEBHOOK_SECRET'] = testSecret;

  const app = buildApp();
  const wh = new Webhook(testSecret);

  // Test 1: Missing headers -> HTTP 401
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/webhooks/clerk',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ type: 'user.created', data: { id: 'user_test_missing_headers' } }),
  });
  console.log('✓ Test 1 (Missing Svix headers):', res1.statusCode, res1.json());
  if (res1.statusCode !== 401)
    throw new Error(`Test 1 failed: expected 401, got ${res1.statusCode}`);

  // Test 2: Invalid signature -> HTTP 401
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/webhooks/clerk',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'msg_123',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,invalidsignature123',
    },
    payload: JSON.stringify({ type: 'user.created', data: { id: 'user_test_invalid_sig' } }),
  });
  console.log('✓ Test 2 (Invalid Svix signature):', res2.statusCode, res2.json());
  if (res2.statusCode !== 401)
    throw new Error(`Test 2 failed: expected 401, got ${res2.statusCode}`);

  // Test 3: Valid signature & unsupported event (user.updated) -> HTTP 200 ignored
  const msgId3 = 'msg_test_3';
  const timestamp3 = new Date();
  const payload3 = JSON.stringify({
    type: 'user.updated',
    data: { id: 'user_test_unsupported_event' },
  });
  const sig3 = wh.sign(msgId3, timestamp3, payload3);

  const res3 = await app.inject({
    method: 'POST',
    url: '/api/webhooks/clerk',
    headers: {
      'content-type': 'application/json',
      'svix-id': msgId3,
      'svix-timestamp': Math.floor(timestamp3.getTime() / 1000).toString(),
      'svix-signature': sig3,
    },
    payload: payload3,
  });
  console.log('✓ Test 3 (Valid sig + unsupported event):', res3.statusCode, res3.json());
  if (res3.statusCode !== 200 || res3.json().status !== 'ignored') {
    throw new Error(`Test 3 failed: expected 200 ignored, got ${res3.statusCode}`);
  }

  // Test 4: Valid signature & user.created event -> HTTP 200 success & DB Sync
  const testClerkId = `user_test_${Date.now()}`;
  const testEmail = `webhook_test_${Date.now()}@example.com`;

  const msgId4 = `msg_${Date.now()}`;
  const timestamp4 = new Date();
  const payload4 = JSON.stringify({
    type: 'user.created',
    data: {
      id: testClerkId,
      primary_email_address_id: 'email_1',
      email_addresses: [{ id: 'email_1', email_address: testEmail }],
      created_at: timestamp4.getTime(),
    },
  });
  const sig4 = wh.sign(msgId4, timestamp4, payload4);

  const res4 = await app.inject({
    method: 'POST',
    url: '/api/webhooks/clerk',
    headers: {
      'content-type': 'application/json',
      'svix-id': msgId4,
      'svix-timestamp': Math.floor(timestamp4.getTime() / 1000).toString(),
      'svix-signature': sig4,
    },
    payload: payload4,
  });
  console.log('✓ Test 4 (Valid sig + user.created):', res4.statusCode, res4.json());
  if (res4.statusCode !== 200 || res4.json().status !== 'success') {
    throw new Error(`Test 4 failed: expected 200 success, got ${res4.statusCode}`);
  }

  // Verify DB entry created in Neon
  const db = getDb();
  const dbUsers = await db.select().from(users).where(eq(users.clerkId, testClerkId));
  console.log('✓ Test 4 DB Verification (User in Neon):', dbUsers.length > 0 ? dbUsers[0] : 'None');
  if (dbUsers.length !== 1 || dbUsers[0]?.email !== testEmail) {
    throw new Error('Test 4 DB Verification failed');
  }

  // Test 5: Idempotency (Duplicate user.created event) -> HTTP 200 success, no duplicate DB row
  const res5 = await app.inject({
    method: 'POST',
    url: '/api/webhooks/clerk',
    headers: {
      'content-type': 'application/json',
      'svix-id': msgId4,
      'svix-timestamp': Math.floor(timestamp4.getTime() / 1000).toString(),
      'svix-signature': sig4,
    },
    payload: payload4,
  });
  console.log('✓ Test 5 (Duplicate user.created idempotency):', res5.statusCode, res5.json());
  if (res5.statusCode !== 200) {
    throw new Error(`Test 5 failed: expected 200, got ${res5.statusCode}`);
  }

  const dbUsersAfterDuplicate = await db.select().from(users).where(eq(users.clerkId, testClerkId));
  console.log('✓ Test 5 DB Idempotency Count:', dbUsersAfterDuplicate.length);
  if (dbUsersAfterDuplicate.length !== 1) {
    throw new Error('Test 5 DB Idempotency failed: duplicate user created!');
  }

  // Cleanup test user from Neon
  await db.delete(users).where(eq(users.clerkId, testClerkId));
  console.log('✓ Test User Cleanup Complete');

  console.log('\n--- ALL CLERK WEBHOOK VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Webhook Verification Suite Failed:', err);
  process.exit(1);
});
