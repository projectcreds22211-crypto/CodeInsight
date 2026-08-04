import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, type User } from '../db/schema.js';

export async function syncUser(userData: {
  clerkId: string;
  email?: string;
  createdAt?: Date;
}): Promise<User> {
  const db = getDb();

  // Idempotency check: check if user already exists
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userData.clerkId))
    .limit(1);

  if (existingUsers.length > 0 && existingUsers[0]) {
    return existingUsers[0];
  }

  // Insert user, ignoring conflict if clerkId already exists concurrently
  const insertedUsers = await db
    .insert(users)
    .values({
      clerkId: userData.clerkId,
      email: userData.email,
      createdAt: userData.createdAt || new Date(),
    })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();

  if (insertedUsers.length > 0 && insertedUsers[0]) {
    return insertedUsers[0];
  }

  // Fallback query if conflict occurred concurrently
  const finalUsers = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userData.clerkId))
    .limit(1);

  if (finalUsers.length > 0 && finalUsers[0]) {
    return finalUsers[0];
  }

  throw new Error(`Failed to synchronize user with clerkId ${userData.clerkId}`);
}
