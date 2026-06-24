import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Grid3x3, Loader2, MessageCircle, MapPin, UserCheck, Clock, UserPlus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { http } from "@/lib/http";
import { getApiErrorMessage } from "@/lib/device-binding";
import { useChat } from "@/contexts/ChatContext";
import { useFriends } from "@/contexts/FriendsContext";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
};

type PostRow = {
  id: string;
  content: string;
  author: {
    id: string;
  };
};

const truncate = (value: string, maxLength: number): string => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const getInitials = (name: string): string => {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "NT";
  }

  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const UserProfilePage = () => {
  const { id } = useParams();
  const { openChat } = useChat();
  const { sendRequest } = useFriends();
  const [friendStatus, setFriendStatus] = useState<'NONE' | 'FRIEND' | 'PENDING'>('NONE');
  const [statusLoading, setStatusLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Array<{ id: string; preview: string }>>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load friend status after profile loads
  useEffect(() => {
    if (!profile) return;
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        // Check if already friends
        const friendsRes = await http.get<any>(`/friends/${profile.id}`);
        // Assuming endpoint returns list? We'll instead fetch list and check
        const listRes = await http.get<any>('/friends');
        const isFriend = listRes.data.data.some((f: any) => f.id === profile.id);
        if (isFriend) {
          setFriendStatus('FRIEND');
        } else {
          // Check pending incoming requests
          const incomingRes = await http.get<any>('/friends/requests');
          const pending = incomingRes.data.data.some((r: any) => r.requester.id === profile.id);
          setFriendStatus(pending ? 'PENDING' : 'NONE');
        }
      } catch (e) {
        // ignore errors
      } finally {
        setStatusLoading(false);
      }
    };
    void loadStatus();
  }, [profile]);

  const handleSendRequest = async () => {
    if (!profile) return;
    setSendingId(profile.id);
    try {
      await sendRequest(profile.id);
      setFriendStatus('PENDING');
    } catch (e) {
      // handle error if needed
    } finally {
      setSendingId(null);
    }
  };

  // UI modifications: replace the existing Button with conditional rendering

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setErrorMessage(null);

      try {
        const response = await http.get<ApiEnvelope<UserProfile>>(`/users/${id}`);
        if (isMounted) {
          setProfile(response.data.data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, "Không tải được thông tin hồ sơ"));
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;

    const loadPosts = async () => {
      setIsLoadingPosts(true);

      try {
        const response = await http.get<ApiEnvelope<PostRow[]>>("/posts", {
          params: {
            page: 1,
            limit: 30,
            authorId: id,
          },
        });

        if (!isMounted) {
          return;
        }

        setPosts(
          response.data.data.map((post) => ({
            id: post.id,
            preview: truncate(post.content, 58),
          })),
        );
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, "Không tải được bài viết"));
        }
      } finally {
        if (isMounted) {
          setIsLoadingPosts(false);
        }
      }
    };

    void loadPosts();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const profileName = profile?.fullName ?? "Người dùng";

  const avatarText = useMemo(() => getInitials(profileName), [profileName]);

  return (
    <AppLayout>
      <div className="container py-6 max-w-2xl mx-auto">
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="gradient-ocean text-primary-foreground text-2xl font-bold">
                {avatarText}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">{profileName}</h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> Hồ sơ cá nhân
              </p>
              {errorMessage && (
                <p className="text-xs text-destructive mt-2">{errorMessage}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!profile) return;
                openChat({
                  id: profile.id,
                  fullName: profile.fullName,
                  email: profile.email,
                });
              }}
              disabled={!profile}
            >
              <MessageCircle className="w-4 h-4" /> Nhắn tin
            </Button>
            {/* Friend request UI */}
            {friendStatus === 'FRIEND' && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 bg-green-500/10 rounded-full py-1">
                <UserCheck className="h-3 w-3" /> Bạn bè
              </span>
            )}
            {friendStatus === 'PENDING' && (
              <span className="flex items-center gap-1 text-xs text-orange-500 font-medium px-2 bg-orange-500/10 rounded-full py-1">
                <Clock className="h-3 w-3" /> Đang chờ
              </span>
            )}
            {friendStatus === 'NONE' && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-3 text-xs"
                disabled={sendingId === profile?.id}
                onClick={handleSendRequest}
              >
                {sendingId === profile?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                Kết bạn
              </Button>
            )}

          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-foreground">
          <Grid3x3 className="w-4 h-4" /> Bài viết gần đây
        </div>

        {isLoadingProfile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải hồ sơ...
          </div>
        )}

        {isLoadingPosts ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải bài viết...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
            Chưa có bài viết nào.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-square bg-secondary rounded-lg flex items-center justify-center p-3 hover:bg-ocean-light transition-colors"
              >
                <p className="text-xs text-secondary-foreground text-center font-medium">{post.preview}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserProfilePage;
