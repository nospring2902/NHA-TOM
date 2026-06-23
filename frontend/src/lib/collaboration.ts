import { http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type FarmInvite = {
  id: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
};

export type FarmMemberItem = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  createdAt: string;
};

export type CollaborativeFarm = {
  farmMemberId: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  ponds: Array<{
    id: string;
    name: string;
    farmName: string;
    province: string;
    district: string;
    ward: string;
    areaM2: number;
    averageDepthM: number;
    waterType: string;
    lifecycleStatus: string;
    createdAt: string;
    updatedAt: string;
  }>;
  joinedAt: string;
};

export const inviteMember = async (
  friendId: string,
): Promise<ApiEnvelope<{ inviteId: string; status: string }>> => {
  const response = await http.post<ApiEnvelope<{ inviteId: string; status: string }>>(
    "/collaboration/invite",
    { friendId },
  );
  return response.data;
};

export const listMyInvites = async (): Promise<ApiEnvelope<FarmInvite[]>> => {
  const response = await http.get<ApiEnvelope<FarmInvite[]>>("/collaboration/invites");
  return response.data;
};

export const acceptInvite = async (
  inviteId: string,
): Promise<ApiEnvelope<{ inviteId: string }>> => {
  const response = await http.post<ApiEnvelope<{ inviteId: string }>>(
    `/collaboration/invites/${inviteId}/accept`,
  );
  return response.data;
};

export const rejectInvite = async (
  inviteId: string,
): Promise<ApiEnvelope<{ inviteId: string }>> => {
  const response = await http.post<ApiEnvelope<{ inviteId: string }>>(
    `/collaboration/invites/${inviteId}/reject`,
  );
  return response.data;
};

export const listMembers = async (): Promise<ApiEnvelope<FarmMemberItem[]>> => {
  const response = await http.get<ApiEnvelope<FarmMemberItem[]>>("/collaboration/members");
  return response.data;
};

export const removeMember = async (
  memberId: string,
): Promise<ApiEnvelope<{ id: string }>> => {
  const response = await http.delete<ApiEnvelope<{ id: string }>>(
    `/collaboration/members/${memberId}`,
  );
  return response.data;
};

export const listCollaborativeFarms = async (): Promise<ApiEnvelope<CollaborativeFarm[]>> => {
  const response = await http.get<ApiEnvelope<CollaborativeFarm[]>>("/collaboration/farms");
  return response.data;
};
