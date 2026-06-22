export type VerificationSession = {
  email: string;
  phone: string;
};

const VERIFICATION_STORAGE_KEY = "nhatom.auth.verification";

export const saveVerificationSession = (session: VerificationSession) => {
  sessionStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(session));
};

export const getVerificationSession = (): VerificationSession | null => {
  const raw = sessionStorage.getItem(VERIFICATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VerificationSession>;
    if (typeof parsed.email !== "string" || typeof parsed.phone !== "string") {
      return null;
    }

    return {
      email: parsed.email,
      phone: parsed.phone,
    };
  } catch {
    return null;
  }
};

export const clearVerificationSession = () => {
  sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
};
