import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchGlobal, type SearchResult } from "@/lib/search";
import { getApiErrorMessage } from "@/lib/device-binding";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Clock, Loader2 } from "lucide-react";
import { useFriends } from "@/contexts/FriendsContext";

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

const truncate = (value: string, maxLength: number) => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
};

const SearchBar = () => {
  const navigate = useNavigate();
  const { sendRequest } = useFriends();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const hasResults = useMemo(
    () => results.users.length > 0 || results.posts.length > 0,
    [results.posts.length, results.users.length],
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], posts: [] });
      setIsOpen(false);
      return;
    }

    const handler = window.setTimeout(async () => {
      const keyword = query.trim();
      if (keyword.length < 2) {
        setResults({ users: [], posts: [] });
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await searchGlobal(keyword, 6);
        setResults(response.data);
        setIsOpen(true);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, "Không thể tìm kiếm"));
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(handler);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }

      if (!containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm người dùng hoặc bài viết..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          onFocus={() => {
            if (hasResults || errorMessage) {
              setIsOpen(true);
            }
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-elevated z-50 overflow-hidden">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Đang tìm kiếm...</div>
          )}

          {!isLoading && errorMessage && (
            <div className="px-4 py-3 text-xs text-destructive">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && !hasResults && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Không có kết quả phù hợp.</div>
          )}

          {!isLoading && !errorMessage && hasResults && (
            <div className="max-h-80 overflow-y-auto">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">Người dùng</div>
              {results.users.length === 0 ? (
                <div className="px-4 pb-3 text-xs text-muted-foreground">Chưa có người dùng.</div>
              ) : (
                <div className="space-y-1 px-2 pb-3">
                  {results.users.map((user) => (
                    <div
                      key={user.id}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
                    >
                      <button
                        onClick={() => {
                          navigate(`/users/${user.id}`);
                          setIsOpen(false);
                        }}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            {getInitials(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 truncate">
                          <p className="text-sm font-medium text-foreground truncate">{user.fullName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </button>

                      <div className="shrink-0 ml-2 flex items-center">
                        {user.friendStatus === 'FRIEND' && (
                          <div className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 bg-green-500/10 rounded-full py-1">
                            <UserCheck className="h-3 w-3" />
                            Bạn bè
                          </div>
                        )}
                        {user.friendStatus === 'PENDING' && (
                          <div className="flex items-center gap-1 text-xs text-orange-500 font-medium px-2 bg-orange-500/10 rounded-full py-1">
                            <Clock className="h-3 w-3" />
                            Đang chờ
                          </div>
                        )}
                        {(user.friendStatus === 'NONE' || !user.friendStatus) && (
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-7 px-3 text-xs"
                            disabled={sendingId === user.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSendingId(user.id);
                              try {
                                await sendRequest(user.id);
                                setResults(prev => ({
                                  ...prev,
                                  users: prev.users.map(u => u.id === user.id ? { ...u, friendStatus: 'PENDING' } : u)
                                }));
                              } catch {}
                              finally { setSendingId(null); }
                            }}
                          >
                            {sendingId === user.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <UserPlus className="h-3 w-3 mr-1" />}
                            Kết bạn
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t border-border">
                Bài viết
              </div>
              {results.posts.length === 0 ? (
                <div className="px-4 pb-3 text-xs text-muted-foreground">Chưa có bài viết.</div>
              ) : (
                <div className="space-y-1 px-2 pb-3">
                  {results.posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-lg px-3 py-2 hover:bg-muted"
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {post.author.fullName}
                      </p>
                      <p className="text-sm text-foreground">{truncate(post.content, 80)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
