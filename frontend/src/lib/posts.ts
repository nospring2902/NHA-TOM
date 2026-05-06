import { getApiOrigin, http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type PostAuthor = {
  id: string;
  fullName: string;
  email: string;
};

export type PostItem = {
  id: string;
  content: string;
  imageUrl?: string | null;
  pondId?: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  likeCount: number;
  commentCount: number;
  liked: boolean;
};

export type CreatePostRequest = {
  content: string;
  imageUrl?: string;
};

export type LikeResult = {
  postId: string;
  liked: boolean;
  likeCount: number;
};

export type CommentItem = {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
};

export type CreateCommentRequest = {
  content: string;
};

export type UploadImageResult = {
  url: string;
};

export const listPosts = async (
  page = 1,
  limit = 20,
  options?: { mine?: boolean },
): Promise<ApiEnvelope<PostItem[]>> => {
  const response = await http.get<ApiEnvelope<PostItem[]>>("/posts", {
    params: {
      page,
      limit,
      mine: options?.mine ? "true" : undefined,
    },
  });
  return response.data;
};

export const createPost = async (
  payload: CreatePostRequest,
): Promise<ApiEnvelope<PostItem>> => {
  const response = await http.post<ApiEnvelope<PostItem>>("/posts", payload);
  return response.data;
};

export const likePost = async (postId: string): Promise<ApiEnvelope<LikeResult>> => {
  const response = await http.post<ApiEnvelope<LikeResult>>(`/posts/${postId}/like`);
  return response.data;
};

export const unlikePost = async (postId: string): Promise<ApiEnvelope<LikeResult>> => {
  const response = await http.delete<ApiEnvelope<LikeResult>>(`/posts/${postId}/like`);
  return response.data;
};

export const listComments = async (postId: string): Promise<ApiEnvelope<CommentItem[]>> => {
  const response = await http.get<ApiEnvelope<CommentItem[]>>(`/posts/${postId}/comments`);
  return response.data;
};

export const createComment = async (
  postId: string,
  payload: CreateCommentRequest,
): Promise<ApiEnvelope<CommentItem>> => {
  const response = await http.post<ApiEnvelope<CommentItem>>(
    `/posts/${postId}/comments`,
    payload,
  );
  return response.data;
};

export const uploadPostImage = async (
  file: File,
): Promise<ApiEnvelope<UploadImageResult>> => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await http.post<ApiEnvelope<UploadImageResult>>(
    "/posts/upload-image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

export const resolvePostImageUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const origin = getApiOrigin();
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
};
