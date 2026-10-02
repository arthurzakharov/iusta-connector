import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    /** Comma-separated list of frontend origins allowed to call the API (CORS). */
    ALLOWED_ORIGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()))
      // Browsers send a bare origin (no path, no trailing slash); CORS matching is exact.
      .transform((urls) => urls.map((url) => new URL(url).origin)),
    /** Repository path on the host (e.g. `owner/name`), used to look up commit info remotely. */
    GIT_REPOSITORY_NAME: z.string().optional(),
    GIT_REPOSITORY_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const missing = [
      env.ALLOWED_ORIGINS.length === 0 && "ALLOWED_ORIGINS",
      !env.GIT_REPOSITORY_NAME && "GIT_REPOSITORY_NAME",
      !env.GIT_REPOSITORY_TOKEN && "GIT_REPOSITORY_TOKEN",
    ].filter((key) => key !== false);

    for (const key of missing) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "required in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
