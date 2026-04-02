import { ApiEnvelope } from './api';
import { User } from './users';

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type AuthResponse = ApiEnvelope<AuthPayload>;
