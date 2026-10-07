// Readable message for anything thrown. Supabase/PostgREST errors are plain
// objects ({ message, details, hint, code }), not Error instances, so the
// usual `instanceof Error` check reported them all as "Unknown error".
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as { message?: unknown; details?: unknown; code?: unknown };
    if (typeof e.message === "string" && e.message) {
      return [e.message, typeof e.details === "string" && e.details ? e.details : null, typeof e.code === "string" ? `(${e.code})` : null]
        .filter(Boolean)
        .join(" ");
    }
  }
  if (typeof error === "string" && error) return error;
  return "Unknown error";
}
