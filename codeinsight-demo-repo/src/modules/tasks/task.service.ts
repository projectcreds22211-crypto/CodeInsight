import { taskRepository, TaskRepository } from "./task.repository";
import { Task, CreateTaskDto, UpdateTaskDto, TaskStatus } from "./task.types";
import { reportGenerator } from "../reports/report.generator";
import { Logger } from "../../utils/logger";

export class TaskService {
  private repo: TaskRepository;
  private logger: Logger;

  constructor(repo = taskRepository) {
    this.repo = repo;
    this.logger = new Logger("TaskService");
  }

  public async getTaskById(id: string): Promise<Task> {
    const task = await this.repo.findById(id);
    if (!task) {
      this.logger.warn(`Task not found: ${id}`);
      throw new Error(`Task with ID ${id} not found`);
    }
    return task;
  }

  public async getTasksByProject(projectId: string): Promise<Task[]> {
    return this.repo.findByProject(projectId);
  }

  public async getPendingUserTasks(userId: string): Promise<Task[]> {
    return this.repo.findByUserAndStatus(userId, "pending");
  }

  public async createTask(dto: CreateTaskDto): Promise<Task> {
    const task = await this.repo.create(dto);
    this.logger.info(`Task created successfully: ${task.id}`);
    return task;
  }

  public async completeTask(taskId: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (task.status === "completed") {
      return task;
    }

    const snapshot = await reportGenerator.generateTaskBillingSnapshot(taskId);
    this.logger.info(
      `Retrieved task billing snapshot for ${taskId}: totalBilled=${snapshot.totalBilled}, outstandingBalance=${snapshot.outstandingBalance}, isFullySettled=${snapshot.isFullySettled}`
    );

    const updated = await this.repo.update(taskId, { status: "completed" });
    if (!updated) {
      throw new Error(`Failed to complete task ${taskId}`);
    }
    return updated;
  }

  public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const updated = await this.repo.update(taskId, { status });
    if (!updated) {
      throw new Error(`Task update failed for ${taskId}`);
    }
    return updated;
  }
}

export const taskService = new TaskService();
