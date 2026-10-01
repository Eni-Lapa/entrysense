import type { z } from "zod";

export interface Issue {
  path: string;
  message: string;
}

export const toIssues = (error: z.ZodError): Issue[] =>
  error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));

export const describeIssues = (error: z.ZodError): string =>
  toIssues(error)
    .map((i) => `- ${i.path}: ${i.message}`)
    .join("\n");
