import { useState, useCallback, useEffect } from "react";
import { Loader2, Plus, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, type TaskPriority } from "@/lib/tasks";
import { listMembers, type FarmMemberItem } from "@/lib/collaboration";
import { getAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";

type CreateTaskModalProps = {
  pondId: string;
  onCreated: () => void;
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const CreateTaskModal = ({ pondId, onCreated }: CreateTaskModalProps) => {
  const session = getAuthSession();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<FarmMemberItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const fetchMembers = useCallback(async () => {
    try {
      const response = await listMembers();
      setMembers(response.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (open) void fetchMembers();
  }, [open, fetchMembers]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Vui lòng nhập tiêu đề nhiệm vụ", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await createTask(pondId, {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        priority,
        dueDate: dueDate || undefined,
      });
      toast({ title: "Tạo nhiệm vụ thành công" });
      setOpen(false);
      resetForm();
      onCreated();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể tạo nhiệm vụ"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setPriority("MEDIUM");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Tạo nhiệm vụ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo nhiệm vụ mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="task-title">Tiêu đề *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề nhiệm vụ..."
            />
          </div>

          <div>
            <Label htmlFor="task-desc">Mô tả</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Gán cho</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người thực hiện" />
                </SelectTrigger>
                <SelectContent>
                  {session?.user && (
                    <SelectItem value={session.user.id}>
                      <span className="flex items-center gap-2">
                        <UserCircle className="h-3.5 w-3.5" />
                        {session.user.fullName} (Tôi)
                      </span>
                    </SelectItem>
                  )}
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mức độ ưu tiên</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="task-due">Hạn hoàn thành</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Tạo nhiệm vụ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
