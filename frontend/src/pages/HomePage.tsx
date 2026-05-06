import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Image, Send, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AppLayout from "@/components/AppLayout";
import { getAuthSession } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/device-binding";
import {
  createComment,
  createPost,
  likePost,
  listComments,
  listPosts,
  resolvePostImageUrl,
  type CommentItem,
  type PostItem,
  unlikePost,
  uploadPostImage,
} from "@/lib/posts";
import { useFriends } from "@/contexts/FriendsContext";
import { useChat } from "@/contexts/ChatContext";

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

const formatRelativeTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Vừa xong";
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) {
    return "Vừa xong";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const HomePage = () => {
  const session = getAuthSession();
  const avatarInitials = useMemo(
    () => getInitials(session?.user.fullName ?? "Người dùng"),
    [session?.user.fullName],
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { friends, suggestions, onlineUserIds, isLoadingFriends, friendsError, isLoadingSuggestions, suggestionsError, sendRequest } = useFriends();
  const { openChat } = useChat();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, CommentItem[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setIsLoadingPosts(true);
      setFeedError(null);

      try {
        const response = await listPosts(1, 20);
        if (!isMounted) {
          return;
        }

        setPosts(response.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFeedError(getApiErrorMessage(error, "Không tải được bảng tin"));
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
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage]);


  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content || isSubmittingPost || isUploadingImage) {
      return;
    }

    setIsSubmittingPost(true);
    setFeedError(null);

    try {
      let imageUrl: string | undefined;

      if (selectedImage) {
        setIsUploadingImage(true);
        const uploadResult = await uploadPostImage(selectedImage);
        imageUrl = uploadResult.data.url;
      }

      const response = await createPost({
        content,
        imageUrl,
      });

      setPosts((current) => [response.data, ...current]);
      setNewPostContent("");
      setSelectedImage(null);
    } catch (error) {
      setFeedError(getApiErrorMessage(error, "Không thể đăng bài viết"));
    } finally {
      setIsSubmittingPost(false);
      setIsUploadingImage(false);
    }
  };

  const handleToggleLike = async (post: PostItem) => {
    if (likeLoading[post.id]) {
      return;
    }

    setLikeLoading((current) => ({
      ...current,
      [post.id]: true,
    }));
    setFeedError(null);

    try {
      const response = post.liked ? await unlikePost(post.id) : await likePost(post.id);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked: response.data.liked,
                likeCount: response.data.likeCount,
              }
            : item,
        ),
      );
    } catch (error) {
      setFeedError(getApiErrorMessage(error, "Không thể cập nhật lượt thích"));
    } finally {
      setLikeLoading((current) => ({
        ...current,
        [post.id]: false,
      }));
    }
  };

  const loadComments = async (postId: string) => {
    if (commentsLoading[postId]) {
      return;
    }

    setCommentsLoading((current) => ({
      ...current,
      [postId]: true,
    }));

    try {
      const response = await listComments(postId);
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: response.data,
      }));
    } catch (error) {
      setFeedError(getApiErrorMessage(error, "Không tải được bình luận"));
    } finally {
      setCommentsLoading((current) => ({
        ...current,
        [postId]: false,
      }));
    }
  };

  const toggleComments = (postId: string) => {
    const isOpen = expandedComments.has(postId);
    setExpandedComments((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    if (!isOpen && !commentsByPostId[postId]) {
      void loadComments(postId);
    }
  };

  const handleCommentDraftChange = (postId: string, value: string) => {
    setCommentDrafts((current) => ({
      ...current,
      [postId]: value,
    }));
  };

  const handleCreateComment = async (postId: string) => {
    const content = commentDrafts[postId]?.trim() ?? "";
    if (!content || commentSubmitting[postId]) {
      return;
    }

    setCommentSubmitting((current) => ({
      ...current,
      [postId]: true,
    }));

    try {
      const response = await createComment(postId, {
        content,
      });

      setCommentsByPostId((current) => ({
        ...current,
        [postId]: [...(current[postId] ?? []), response.data],
      }));
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                commentCount: item.commentCount + 1,
              }
            : item,
        ),
      );
      setCommentDrafts((current) => ({
        ...current,
        [postId]: "",
      }));
    } catch (error) {
      setFeedError(getApiErrorMessage(error, "Không thể gửi bình luận"));
    } finally {
      setCommentSubmitting((current) => ({
        ...current,
        [postId]: false,
      }));
    }
  };

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedImage(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const friendsWithStatus = useMemo(
    () =>
      friends.map((friend) => ({
        ...friend,
        isOnline: onlineUserIds.has(friend.id) || friend.isOnline,
      })),
    [friends, onlineUserIds],
  );

  const onlineFriends = useMemo(
    () => friendsWithStatus.filter((friend) => friend.isOnline),
    [friendsWithStatus],
  );

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 max-w-4xl mx-auto">
          {/* Feed */}
          <div className="space-y-5">
            {/* Create post */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="gradient-ocean text-primary-foreground text-sm">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectImage}
                    className="hidden"
                  />
                  <input
                    placeholder="Chia sẻ kinh nghiệm nuôi tôm..."
                    value={newPostContent}
                    onChange={(event) => setNewPostContent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreatePost();
                      }
                    }}
                    className="w-full bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {imagePreviewUrl && (
                    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">Ảnh đính kèm</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={handleRemoveImage}
                        >
                          Gỡ ảnh
                        </Button>
                      </div>
                      <img
                        src={imagePreviewUrl}
                        alt="Ảnh bài viết"
                        className="w-full max-h-64 object-cover rounded-md border border-border"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground gap-2"
                      onClick={handleOpenFilePicker}
                      type="button"
                    >
                      <Image className="w-4 h-4" />
                      {selectedImage ? "Đổi ảnh" : "Ảnh"}
                    </Button>
                    <Button
                      size="sm"
                      className="gradient-ocean text-primary-foreground border-0 gap-2"
                      onClick={() => void handleCreatePost()}
                      disabled={isSubmittingPost || isUploadingImage || !newPostContent.trim()}
                    >
                      {isSubmittingPost || isUploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đăng
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Đăng
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {feedError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {feedError}
              </div>
            )}

            {/* Posts */}
            {isLoadingPosts && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải bài viết...
              </div>
            )}

            {!isLoadingPosts && posts.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
                Chưa có bài viết nào.
              </div>
            )}

            {!isLoadingPosts && posts.map((post) => {
              const isCommentsOpen = expandedComments.has(post.id);
              const comments = commentsByPostId[post.id] ?? [];
              const isCommentsLoading = commentsLoading[post.id];
              const isCommentSubmitting = commentSubmitting[post.id];
              const isLikeLoading = likeLoading[post.id];
              const imageUrl = resolvePostImageUrl(post.imageUrl);

              return (
                <div key={post.id} className="bg-card rounded-xl border border-border shadow-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-medium">
                          {getInitials(post.author.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{post.author.fullName}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(post.createdAt)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-4">{post.content}</p>
                  {imageUrl && (
                    <div className="mb-4">
                      <img
                        src={imageUrl}
                        alt="Ảnh bài viết"
                        className="w-full max-h-[420px] object-cover rounded-lg border border-border"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-border">
                    <button
                      onClick={() => void handleToggleLike(post)}
                      disabled={isLikeLoading}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-coral" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} />
                      {post.likeCount}
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {post.commentCount}
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isCommentsOpen && (
                    <div className="mt-3 border-t border-border pt-3 space-y-3">
                      {isCommentsLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Đang tải bình luận...
                        </div>
                      )}

                      {!isCommentsLoading && comments.length === 0 && (
                        <p className="text-xs text-muted-foreground">Chưa có bình luận nào.</p>
                      )}

                      {!isCommentsLoading && comments.length > 0 && (
                        <div className="space-y-3">
                          {comments.map((comment) => (
                            <div key={comment.id} className="flex items-start gap-2">
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
                                  {getInitials(comment.author.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-foreground">
                                    {comment.author.fullName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatRelativeTime(comment.createdAt)}
                                  </p>
                                </div>
                                <p className="text-xs text-foreground mt-1">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
                            {avatarInitials}
                          </AvatarFallback>
                        </Avatar>
                        <input
                          value={commentDrafts[post.id] ?? ""}
                          onChange={(event) => handleCommentDraftChange(post.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleCreateComment(post.id);
                            }
                          }}
                          placeholder="Viết bình luận..."
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => void handleCreateComment(post.id)}
                          disabled={isCommentSubmitting || !(commentDrafts[post.id] ?? "").trim()}
                        >
                          {isCommentSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-5">
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Đang hoạt động</h3>
              {isLoadingFriends && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tải bạn bè...
                </div>
              )}
              {!isLoadingFriends && onlineFriends.length === 0 && (
                <p className="text-xs text-muted-foreground">Chưa có ai đang online.</p>
              )}
              {!isLoadingFriends && onlineFriends.length > 0 && (
                <div className="space-y-3">
                  {onlineFriends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleOpenChat(friend.id)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            {getInitials(friend.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aqua rounded-full border-2 border-card" />
                      </div>
                      <span className="text-sm text-foreground">{friend.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Bạn bè</h3>
                <span className="text-xs text-muted-foreground">{friendsWithStatus.length}</span>
              </div>
              {friendsError && (
                <p className="text-xs text-destructive mb-2">{friendsError}</p>
              )}
              {!isLoadingFriends && friendsWithStatus.length === 0 && !friendsError && (
                <p className="text-xs text-muted-foreground">Chưa có bạn bè nào.</p>
              )}
              <div className="space-y-2">
                {friendsWithStatus.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleOpenChat(friend.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            {getInitials(friend.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        {friend.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aqua rounded-full border-2 border-card" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{friend.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {friend.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                        </p>
                      </div>
                    </div>
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {openChats.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[70] flex flex-row-reverse gap-3">
          {openChats.map((friend) => {
            const messages = messagesByFriendId[friend.id] ?? [];
            const isLoading = messagesLoading[friend.id];
            const isSending = messageSending[friend.id];

            return (
              <div
                key={friend.id}
                className="w-72 bg-card border border-border rounded-xl shadow-elevated flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                          {getInitials(friend.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      {friend.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aqua rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{friend.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {friend.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCloseChat(friend.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 max-h-72 overflow-y-auto p-3 space-y-2 bg-muted/20">
                  {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Đang tải tin nhắn...
                    </div>
                  )}
                  {!isLoading && messages.length === 0 && (
                    <p className="text-xs text-muted-foreground">Chưa có tin nhắn.</p>
                  )}
                  {!isLoading &&
                    messages.map((message) => {
                      const isOwn = message.senderId === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-foreground border border-border"
                            }`}
                          >
                            <p>{message.content}</p>
                            <p
                              className={`mt-1 text-[10px] ${
                                isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
                              }`}
                            >
                              {formatRelativeTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="border-t border-border p-2 flex items-center gap-2">
                  <input
                    value={messageDrafts[friend.id] ?? ""}
                    onChange={(event) => handleMessageDraftChange(friend.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSendMessage(friend.id);
                      }
                    }}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => void handleSendMessage(friend.id)}
                    disabled={isSending || !(messageDrafts[friend.id] ?? "").trim()}
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default HomePage;
