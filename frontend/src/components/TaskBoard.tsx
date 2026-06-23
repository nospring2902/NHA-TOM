import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  Trash2,
  XCircle,
  AlertTriangle,
  ArrowUpCircle,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import {
  listPondTasks,
  updateTaskStatus,
  deleteTask,
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";
import { getAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { useRealtime } from "@/contexts/RealtimeContext";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "NT";

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  TODO: { label: "Chưa bắt đầu", icon: Circle, color: "text-muted-foreground" },
  IN_PROGRESS: { label: "Đang thực hiện", icon: PlayCircle, color: "text-blue-500" },
  DONE: { label: "Hoàn thành", icon: CheckCircle2, color: "text-green-500" },
  CANCELLED: { label: "Đã hủy", icon: XCircle, color: "text-red-400" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  LOW: { label: "Thấp", variant: "secondary" },
  MEDIUM: { label: "TB", variant: "outline" },
  HIGH: { label: "Cao", variant: "default" },
  URGENT: { label: "Khẩn", variant: "destructive" },
};

const STATUS_FLOW: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["DONE", "TODO"],
  DONE: ["TODO"],
  CANCELLED: ["TODO"],
};

type TaskBoardProps = {
  pondId: string;
  isOwner: boolean;
};

export const TaskBoard = ({ pondId, isOwner }: TaskBoardProps) => {
  const session = getAuthSession();
  const { socket } = useRealtime();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listPondTasks(pondId);
      setTasks(response.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Listen for realtime task updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (payload: { task: TaskItem; pondId: string }) => {
      if (payload.pondId !== pondId) return;
      setTasks((prev) => {
        if (prev.some((t) => t.id === payload.task.id)) return prev;
        return [payload.task, ...prev];
      });
    };

    const handleTaskUpdated = (payload: { task: TaskItem; pondId: string }) => {
      if (payload.pondId !== pondId) return;
      setTasks((prev) =>
        prev.map((t) => (t.id === payload.task.id ? payload.task : t)),
      );
    };

    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);

    return () => {
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
    };
  }, [socket, pondId]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingId(taskId);
    try {
      const response = await updateTaskStatus(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? response.data : t)),
      );
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể cập nhật trạng thái"),
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (task: TaskItem) => {
    if (!confirm(`Xóa nhiệm vụ "${task.title}"?`)) return;
    try {
      await deleteTask(task.pondId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast({ title: "Đã xóa nhiệm vụ" });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể xóa nhiệm vụ"),
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const isOverdue = (dueDate: string | null, status: TaskStatus) => {
    if (!dueDate || status === "DONE" || status === "CANCELLED") return false;
    return new Date(dueDate) < new Date();
  };

  const groupedTasks: Record<TaskStatus, TaskItem[]> = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    DONE: tasks.filter((t) => t.status === "DONE"),
    CANCELLED: tasks.filter((t) => t.status === "CANCELLED"),
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Nhiệm vụ</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {isOwner && <CreateTaskModal pondId={pondId} onCreated={fetchTasks} />}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Chưa có nhiệm vụ nào
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as TaskStatus[]).map((status) => {
            const group = groupedTasks[status];
            if (group.length === 0) return null;

            const config = STATUS_CONFIG[status];
            const StatusIcon = config.icon;

            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-medium">{config.label}</span>
                  <span className="text-xs text-muted-foreground">({group.length})</span>
                </div>

                <div className="space-y-2 ml-6">
                  {group.map((task) => {
                    const canUpdate =
                      task.assigneeId === session?.user.id || isOwner;
                    const nextStatuses = STATUS_FLOW[task.status];
                    const overdue = isOverdue(task.dueDate, task.status);

                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          overdue ? "border-red-200 bg-red-50/50" : "bg-background hover:bg-accent/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{task.title}</span>
                              <Badge variant={PRIORITY_CONFIG[task.priority].variant} className="text-[10px] px-1.5 py-0">
                                {PRIORITY_CONFIG[task.priority].label}
                              </Badge>
                              {overdue && (
                                <span className="flex items-center gap-1 text-[10px] text-red-500">
                                  <AlertTriangle className="h-3 w-3" /> Quá hạn
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {task.assignee && (
                                <span className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(task.assignee.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {task.assignee.fullName}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {canUpdate &&
                              nextStatuses.map((nextStatus) => {
                                const nextConfig = STATUS_CONFIG[nextStatus];
                                const NextIcon = nextConfig.icon;
                                return (
                                  <Button
                                    key={nextStatus}
                                    size="icon"
                                    variant="ghost"
                                    className={`h-7 w-7 ${nextConfig.color}`}
                                    title={nextConfig.label}
                                    onClick={() => handleStatusChange(task.id, nextStatus)}
                                    disabled={updatingId === task.id}
                                  >
                                    {updatingId === task.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <NextIcon className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                );
                              })}
                            {isOwner && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(task)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
