import { ApiEnvelope } from './api';

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dob?: string;
  address?: string;
  experience?: string;
};

export type UpdateMeRequest = Partial<Pick<User, 'fullName' | 'phone' | 'dob' | 'address' | 'experience'>>;

export type UserResponse = ApiEnvelope<User>;
