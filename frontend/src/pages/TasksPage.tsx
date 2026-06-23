import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  XCircle,
  AlertTriangle,
  Flag,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import {
  listMyTasks,
  updateTaskStatus,
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";
import { getAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { useRealtime } from "@/contexts/RealtimeContext";
import { Link } from "react-router-dom";

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

const formatDate = (date: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const isOverdue = (dueDate: string | null, status: TaskStatus) => {
  if (!dueDate || status === "DONE" || status === "CANCELLED") return false;
  return new Date(dueDate) < new Date();
};

const TasksPage = () => {
  const session = getAuthSession();
  const { socket } = useRealtime();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | "ALL">("ALL");

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listMyTasks();
      setTasks(response.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdated = (payload: { task: TaskItem }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === payload.task.id ? payload.task : t)),
      );
    };

    const handleTaskCreated = (payload: { task: TaskItem }) => {
      if (payload.task.assignee?.id === session?.user.id) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === payload.task.id)) return prev;
          return [payload.task, ...prev];
        });
      }
    };

    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:created", handleTaskCreated);

    return () => {
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:created", handleTaskCreated);
    };
  }, [socket, session?.user.id]);

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

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  // Group by pond
  const grouped: Record<string, TaskItem[]> = {};
  for (const task of filtered) {
    const key = `${task.pondName} — ${task.farmName}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }

  const statusCounts = {
    ALL: tasks.length,
    TODO: tasks.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    DONE: tasks.filter((t) => t.status === "DONE").length,
    CANCELLED: tasks.filter((t) => t.status === "CANCELLED").length,
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Nhiệm vụ của tôi</h1>
            <p className="text-sm text-muted-foreground">
              Tất cả nhiệm vụ được gán cho bạn
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {(["ALL", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setFilter(s)}
            >
              {s !== "ALL" && (() => {
                const Icon = STATUS_CONFIG[s].icon;
                return <Icon className="h-3.5 w-3.5" />;
              })()}
              {s === "ALL" ? "Tất cả" : STATUS_CONFIG[s].label}
              <span className="text-xs opacity-70">({statusCounts[s]})</span>
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Chưa có nhiệm vụ nào</p>
            <p className="text-sm mt-1">
              {filter === "ALL"
                ? "Bạn chưa được gán nhiệm vụ nào"
                : "Không có nhiệm vụ ở trạng thái này"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([pondLabel, pondTasks]) => (
              <div key={pondLabel}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-primary">{pondLabel}</span>
                  <span className="text-xs text-muted-foreground">({pondTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {pondTasks.map((task) => {
                    const config = STATUS_CONFIG[task.status];
                    const StatusIcon = config.icon;
                    const nextStatuses = STATUS_FLOW[task.status];
                    const overdue = isOverdue(task.dueDate, task.status);

                    return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-xl border bg-card shadow-sm transition-colors ${
                          overdue ? "border-red-200" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
                              <span className="font-medium">{task.title}</span>
                              <Badge
                                variant={PRIORITY_CONFIG[task.priority].variant}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {PRIORITY_CONFIG[task.priority].label}
                              </Badge>
                              {overdue && (
                                <span className="flex items-center gap-1 text-[10px] text-red-500">
                                  <AlertTriangle className="h-3 w-3" /> Quá hạn
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1.5 ml-6">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 ml-6 text-xs text-muted-foreground">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Hạn: {formatDate(task.dueDate)}
                                </span>
                              )}
                              <span>Giao bởi: {task.creator.fullName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {nextStatuses.map((nextStatus) => {
                              const nextConfig = STATUS_CONFIG[nextStatus];
                              const NextIcon = nextConfig.icon;
                              return (
                                <Button
                                  key={nextStatus}
                                  size="sm"
                                  variant="outline"
                                  className={`gap-1.5 text-xs ${nextConfig.color}`}
                                  onClick={() => handleStatusChange(task.id, nextStatus)}
                                  disabled={updatingId === task.id}
                                >
                                  {updatingId === task.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <NextIcon className="h-3.5 w-3.5" />
                                  )}
                                  {nextConfig.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TasksPage;
