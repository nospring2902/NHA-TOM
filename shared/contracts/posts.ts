import { ApiEnvelope } from './api';

export type PostItem = {
  id: string;
  content: string;
  imageUrl?: string;
};

export type CreatePostRequest = {
  content: string;
  imageUrl?: string;
};

export type LikeResult = {
  postId: string;
  liked: boolean;
};

export type CommentItem = {
  id: string;
  postId: string;
  content: string;
};

export type CreateCommentRequest = {
  content: string;
};

export type PostResponse = ApiEnvelope<PostItem>;
export type PostListResponse = ApiEnvelope<PostItem[]>;
export type LikeResponse = ApiEnvelope<LikeResult>;
export type CommentResponse = ApiEnvelope<CommentItem>;
export type CommentListResponse = ApiEnvelope<CommentItem[]>;
