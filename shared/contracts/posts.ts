import { ApiEnvelope } from './api';

export type PostAuthor = {
  id: string;
  fullName: string;
  email: string;
};

export type PostItem = {
  id: string;
  content: string;
  imageUrl?: string;
  pondId?: string;
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

export type CommentAuthor = {
  id: string;
  fullName: string;
  email: string;
};

export type CommentItem = {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
};

export type CreateCommentRequest = {
  content: string;
};

export type PostResponse = ApiEnvelope<PostItem>;
export type PostListResponse = ApiEnvelope<PostItem[]>;
export type LikeResponse = ApiEnvelope<LikeResult>;
export type CommentResponse = ApiEnvelope<CommentItem>;
export type CommentListResponse = ApiEnvelope<CommentItem[]>;
