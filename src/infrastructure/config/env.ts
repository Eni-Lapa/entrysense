import { z } from "zod";
import { toIssues } from "../../application/validation.js";

export const SAMPLE_API_KEY = "dev-api-key-change-me";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v));

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const isTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
    API_KEY: z.string().min(16, "must be at least 16 characters"),
    TIME_ZONE: z.string().refine(isTimeZone, "must be an IANA time zone, e.g. Europe/Berlin").default("UTC"),
    STORAGE: z.enum(["memory", "postgres"]).default("memory"),
    DATABASE_URL: optionalString,
    LLM_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
    LANGFUSE_PUBLIC_KEY: optionalString,
    LANGFUSE_SECRET_KEY: optionalString,
    LANGFUSE_BASE_URL: z.url().default("https://cloud.langfuse.com"),
    TRACE_CONTENT: flag,
    OTEL_SERVICE_NAME: z.string().default("entrysense"),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalString.pipe(z.url().optional()),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, when: string) => {
      if (env[key] === undefined) ctx.addIssue({ code: "custom", path: [key], message: `required when ${when}` });
    };
    if (env.STORAGE === "postgres") require("DATABASE_URL", "STORAGE=postgres");
    if (env.LLM_PROVIDER === "anthropic") require("ANTHROPIC_API_KEY", "LLM_PROVIDER=anthropic");
    if (env.NODE_ENV === "production") {
      if (env.API_KEY === SAMPLE_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["API_KEY"], message: "the sample key is not allowed in production" });
      }
      if (env.STORAGE === "memory") {
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE"],
          message: "in-memory storage loses data; use postgres in production",
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Fails at boot with every problem listed, instead of on the first request. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = toIssues(result.error).map((i) => `  ${i.path}: ${i.message}`);
    throw new Error(`Invalid environment configuration (see .env.example):\n${issues.join("\n")}`);
  }
  return result.data;
}
