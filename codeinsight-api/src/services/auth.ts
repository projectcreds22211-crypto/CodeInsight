import type { FastifyReply, FastifyRequest } from 'fastify';
import { getAuth } from '@clerk/fastify';

export interface RequestUser {
  clerkId: string;
  internalUserId?: string;
  email?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

export function validateAuthConfig(): { publishableKey: string; secretKey: string } {
  const publishableKey = process.env['CLERK_PUBLISHABLE_KEY'];
  const secretKey = process.env['CLERK_SECRET_KEY'];

  if (!publishableKey) {
    throw new Error('CLERK_PUBLISHABLE_KEY environment variable is missing. Authentication cannot be configured.');
  }

  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY environment variable is missing. Authentication cannot be configured.');
  }

  return { publishableKey, secretKey };
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const auth = getAuth(request);

    if (!auth || !auth.userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required. Missing or invalid Clerk session.',
      });
    }

    request.user = {
      clerkId: auth.userId,
    };
  } catch {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required. Failed to verify session.',
    });
  }
}
