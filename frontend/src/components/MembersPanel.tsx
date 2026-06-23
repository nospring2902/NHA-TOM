import { useCallback, useEffect, useState } from "react";
import { Users, Crown, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import {
  listMembers,
  removeMember,
  type FarmMemberItem,
} from "@/lib/collaboration";
import { getAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "NT";

type MembersPanelProps = {
  isOwner: boolean;
};

export const MembersPanel = ({ isOwner }: MembersPanelProps) => {
  const session = getAuthSession();
  const [members, setMembers] = useState<FarmMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!isOwner) return;
    setIsLoading(true);
    try {
      const response = await listMembers();
      setMembers(response.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`)) return;

    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({ title: "Đã xóa thành viên" });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể xóa thành viên"),
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (!isOwner) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Thành viên</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {members.length + 1}
          </span>
        </div>
        <InviteMemberModal existingMembers={members} onInvited={fetchMembers} />
      </div>

      <div className="p-4 space-y-2">
        {/* Owner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(session?.user.fullName ?? "Owner")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{session?.user.fullName}</p>
              <p className="text-xs text-muted-foreground">{session?.user.email}</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            <Crown className="h-3 w-3" /> Owner
          </span>
        </div>

        {/* Members */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {getInitials(member.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  Member
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(member.id, member.fullName)}
                  disabled={removingId === member.id}
                >
                  {removingId === member.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
