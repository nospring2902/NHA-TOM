export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = 'nhatom.auth.session';

export const saveAuthSession = (session: AuthSession) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getAuthSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.user?.id !== 'string' ||
      typeof parsed.user?.email !== 'string' ||
      typeof parsed.user?.fullName !== 'string' ||
      typeof parsed.user?.role !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        fullName: parsed.user.fullName,
        role: parsed.user.role,
      },
    };
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => {
  return getAuthSession()?.accessToken ?? null;
};

export const getCurrentUserId = (): string | null => {
  return getAuthSession()?.user.id ?? null;
};