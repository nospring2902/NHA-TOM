import { useState } from "react";
import { UserPlus, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFriends } from "@/contexts/FriendsContext";
import { inviteMember, type FarmMemberItem } from "@/lib/collaboration";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "NT";

type InviteMemberModalProps = {
  existingMembers: FarmMemberItem[];
  onInvited: () => void;
};

export const InviteMemberModal = ({ existingMembers, onInvited }: InviteMemberModalProps) => {
  const { friends } = useFriends();
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const memberUserIds = new Set(existingMembers.map((m) => m.userId));

  const availableFriends = friends.filter(
    (f) => !memberUserIds.has(f.id) && !invitedIds.has(f.id),
  );

  const handleInvite = async (friendId: string) => {
    setLoadingId(friendId);
    try {
      await inviteMember(friendId);
      setInvitedIds((prev) => new Set([...prev, friendId]));
      toast({ title: "Đã gửi lời mời cộng tác" });
      onInvited();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể gửi lời mời"),
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Mời thành viên
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mời bạn bè cộng tác</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {availableFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {friends.length === 0
                ? "Bạn chưa có bạn bè nào. Hãy kết bạn trước!"
                : "Tất cả bạn bè đã được mời hoặc là thành viên."}
            </p>
          ) : (
            availableFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(friend.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{friend.fullName}</p>
                    <p className="text-xs text-muted-foreground">{friend.email}</p>
                  </div>
                </div>
                {invitedIds.has(friend.id) ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3.5 w-3.5" /> Đã mời
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInvite(friend.id)}
                    disabled={loadingId === friend.id}
                  >
                    {loadingId === friend.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Mời"
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
