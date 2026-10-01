import { z } from "zod";

/**
 * JSON Schema for a tool's input, generated from the Zod schema that validates it.
 * Refinements (such as range checks) cannot be expressed in JSON Schema; they are
 * still enforced when the arguments are parsed.
 */
export function toToolInputSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  return jsonSchema;
}
