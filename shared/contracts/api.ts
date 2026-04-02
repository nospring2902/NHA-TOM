export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
};
