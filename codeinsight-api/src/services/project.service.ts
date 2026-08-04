import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { projects, users, type Project } from '../db/schema.js';
import { DEMO_REPOSITORY_CONFIG } from '../config/demo-repository.js';

export class UserNotFoundError extends Error {
  constructor(clerkId: string) {
    super(`User with Clerk ID '${clerkId}' not found in database.`);
    this.name = 'UserNotFoundError';
  }
}

export async function createProject(params: {
  clerkId: string;
  name: string;
  githubUrl?: string | null;
  isDemoRepository?: boolean;
}): Promise<Project> {
  const db = getDb();

  // Resolve internal user ID from users table using clerkId
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, params.clerkId))
    .limit(1);

  const internalUser = existingUsers[0];
  if (!internalUser) {
    throw new UserNotFoundError(params.clerkId);
  }

  // Insert project record
  const insertedProjects = await db
    .insert(projects)
    .values({
      userId: internalUser.id,
      name: params.name,
      githubUrl: params.githubUrl || null,
      isDemoRepository: params.isDemoRepository ?? false,
    })
    .returning();

  const createdProject = insertedProjects[0];
  if (!createdProject) {
    throw new Error('Failed to create project record in database.');
  }

  return createdProject;
}

export async function createDemoProject(clerkId: string): Promise<Project> {
  return createProject({
    clerkId,
    name: DEMO_REPOSITORY_CONFIG.name,
    githubUrl: DEMO_REPOSITORY_CONFIG.githubUrl,
    isDemoRepository: true,
  });
}

export async function listProjects(clerkId: string): Promise<Project[]> {
  const db = getDb();

  // Resolve internal user ID
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  const internalUser = existingUsers[0];
  if (!internalUser) {
    throw new UserNotFoundError(clerkId);
  }

  // Fetch projects belonging to internal user ID, ordered by createdAt descending (newest first)
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, internalUser.id))
    .orderBy(desc(projects.createdAt));

  return userProjects;
}
