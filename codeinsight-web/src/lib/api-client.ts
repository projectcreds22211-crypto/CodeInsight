const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Project {
  id: string;
  userId: string;
  name: string;
  githubUrl: string | null;
  isDemoRepository: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectParams {
  name: string;
  githubUrl?: string | null;
  isDemoRepository?: boolean;
}

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    let details: Record<string, string[]> | undefined;
    try {
      const errorJson = await response.json();
      if (errorJson.message) errorMessage = errorJson.message;
      if (errorJson.details) details = errorJson.details;
    } catch {
      // response body was not JSON
    }
    throw new ApiError(errorMessage, response.status, details);
  }

  return response.json() as Promise<T>;
}

export async function getProjects(getToken: () => Promise<string | null>): Promise<Project[]> {
  return request<Project[]>('/api/projects', { method: 'GET' }, getToken);
}

export async function createProject(
  params: CreateProjectParams,
  getToken: () => Promise<string | null>
): Promise<Project> {
  return request<Project>(
    '/api/projects',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    getToken
  );
}

export async function createDemoProject(
  getToken: () => Promise<string | null>
): Promise<Project> {
  return request<Project>(
    '/api/projects/demo',
    {
      method: 'POST',
    },
    getToken
  );
}
