import { http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type SearchUser = {
  id: string;
  fullName: string;
  email: string;
};

export type SearchPost = {
  id: string;
  content: string;
  createdAt: string;
  author: SearchUser;
};

export type SearchResult = {
  users: SearchUser[];
  posts: SearchPost[];
};

export const searchGlobal = async (
  query: string,
  limit = 5,
): Promise<ApiEnvelope<SearchResult>> => {
  const response = await http.get<ApiEnvelope<SearchResult>>("/search", {
    params: {
      q: query,
      limit,
    },
  });

  return response.data;
};
