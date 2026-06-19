export type Result<T, E extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; message?: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = <E extends string>(error: E, message?: string): Result<never, E> => ({
  ok: false,
  error,
  message,
});
