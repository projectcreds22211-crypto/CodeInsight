export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  projectId: string;
  assignedUserId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  hourlyRate: number;
  dueDate: Date;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskDto {
  projectId: string;
  assignedUserId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  estimatedHours: number;
  hourlyRate: number;
  dueDate: Date;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedHours?: number;
  hourlyRate?: number;
  dueDate?: Date;
}
