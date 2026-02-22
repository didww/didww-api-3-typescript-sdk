export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface ListResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}
