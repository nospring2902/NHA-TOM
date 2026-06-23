import { http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskItem = {
  id: string;
  pondId: string;
  pondName: string;
  farmName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  creator: {
    id: string;
    fullName: string;
    email: string;
  };
  assignee: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  dueDate?: string;
};

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

export const createTask = async (
  pondId: string,
  payload: CreateTaskPayload,
): Promise<ApiEnvelope<TaskItem>> => {
  const response = await http.post<ApiEnvelope<TaskItem>>(
    `/ponds/${pondId}/tasks`,
    payload,
  );
  return response.data;
};

export const listPondTasks = async (
  pondId: string,
): Promise<ApiEnvelope<TaskItem[]>> => {
  const response = await http.get<ApiEnvelope<TaskItem[]>>(`/ponds/${pondId}/tasks`);
  return response.data;
};

export const getTask = async (
  pondId: string,
  taskId: string,
): Promise<ApiEnvelope<TaskItem>> => {
  const response = await http.get<ApiEnvelope<TaskItem>>(
    `/ponds/${pondId}/tasks/${taskId}`,
  );
  return response.data;
};

export const updateTask = async (
  pondId: string,
  taskId: string,
  payload: UpdateTaskPayload,
): Promise<ApiEnvelope<TaskItem>> => {
  const response = await http.patch<ApiEnvelope<TaskItem>>(
    `/ponds/${pondId}/tasks/${taskId}`,
    payload,
  );
  return response.data;
};

export const updateTaskStatus = async (
  taskId: string,
  status: TaskStatus,
): Promise<ApiEnvelope<TaskItem>> => {
  const response = await http.patch<ApiEnvelope<TaskItem>>(
    `/tasks/${taskId}/status`,
    { status },
  );
  return response.data;
};

export const deleteTask = async (
  pondId: string,
  taskId: string,
): Promise<ApiEnvelope<{ id: string; deleted: boolean }>> => {
  const response = await http.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
    `/ponds/${pondId}/tasks/${taskId}`,
  );
  return response.data;
};

export const listMyTasks = async (): Promise<ApiEnvelope<TaskItem[]>> => {
  const response = await http.get<ApiEnvelope<TaskItem[]>>("/tasks/my");
  return response.data;
};
