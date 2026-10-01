import type { z } from "zod";
import { ValidationError } from "../application/errors.js";
import { toIssues } from "../application/validation.js";

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(toIssues(result.error));
  return result.data;
}
