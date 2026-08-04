import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { createProject, createDemoProject, listProjects, UserNotFoundError } from '../services/project.service.js';
import { createProjectSchema } from '../validators/project.js';

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/projects/demo
  fastify.post('/api/projects/demo', { onRequest: [requireAuth] }, async (request, reply) => {
    const clerkId = request.user?.clerkId;
    if (!clerkId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
      const project = await createDemoProject(clerkId);
      return reply.status(201).send(project);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Authenticated user is not synchronized in database. Please sign up or complete webhook sync.',
        });
      }

      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create demo project',
      });
    }
  });

  // POST /api/projects
  fastify.post('/api/projects', { onRequest: [requireAuth] }, async (request, reply) => {
    const clerkId = request.user?.clerkId;
    if (!clerkId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const project = await createProject({
        clerkId,
        name: parseResult.data.name,
        githubUrl: parseResult.data.githubUrl,
        isDemoRepository: parseResult.data.isDemoRepository,
      });

      return reply.status(201).send(project);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Authenticated user is not synchronized in database. Please sign up or complete webhook sync.',
        });
      }

      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create project',
      });
    }
  });

  // GET /api/projects
  fastify.get('/api/projects', { onRequest: [requireAuth] }, async (request, reply) => {
    const clerkId = request.user?.clerkId;
    if (!clerkId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
      const userProjects = await listProjects(clerkId);
      return reply.status(200).send(userProjects);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Authenticated user is not synchronized in database. Please sign up or complete webhook sync.',
        });
      }

      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch projects',
      });
    }
  });
}
