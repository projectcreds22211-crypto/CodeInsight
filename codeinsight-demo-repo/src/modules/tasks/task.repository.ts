import { Task, CreateTaskDto, UpdateTaskDto } from "./task.types";

export class TaskRepository {
  private tasks: Map<string, Task> = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const sampleTask: Task = {
      id: "tsk_501",
      projectId: "prj_001",
      assignedUserId: "usr_101",
      title: "Implement OAuth2 Authentication Flow",
      description: "Set up security tokens and end-to-end flow with provider",
      status: "in_progress",
      priority: "high",
      estimatedHours: 12,
      hourlyRate: 85.0,
      dueDate: new Date(Date.now() + 86400000 * 5),
      metadataJson: JSON.stringify({ tags: ["auth", "security"], targetRelease: "v1.2" }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(sampleTask.id, sampleTask);
  }

  public async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  public async findByProject(projectId: string): Promise<Task[]> {
    const result: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.projectId === projectId) {
        result.push(task);
      }
    }
    return result;
  }

  public async findByUserAndStatus(userID: string, status: string): Promise<Task[]> {
    const result: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.assignedUserId === userID && task.status === status) {
        result.push(task);
      }
    }
    return result;
  }

  public async create(dto: CreateTaskDto): Promise<Task> {
    const id = `tsk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const task: Task = {
      id,
      projectId: dto.projectId,
      assignedUserId: dto.assignedUserId,
      title: dto.title,
      description: dto.description ?? "",
      status: "pending",
      priority: dto.priority ?? "medium",
      estimatedHours: dto.estimatedHours,
      hourlyRate: dto.hourlyRate,
      dueDate: dto.dueDate,
      metadataJson: JSON.stringify({ env: "production" }),
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    return task;
  }

  public async update(id: string, dto: UpdateTaskDto): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) {
      return null;
    }
    const updated: Task = {
      ...existing,
      ...dto,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return updated;
  }
}

export const taskRepository = new TaskRepository();
