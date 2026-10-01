import { z } from "zod";
import { DateRange, Entry, IsoDate, Symptom, withRangeChecks } from "../domain/model.js";
import { ERROR_CODES } from "./errors.js";

// Request and response bodies. Handlers parse requests with these; tests parse
// responses with them, so the contract is checked from both sides.

export const CreateEntryBody = z.object({
  text: z.string().trim().min(3).max(2000),
});

export const ListEntriesQuery = withRangeChecks(
  z
    .object({
      from: IsoDate.optional(),
      to: IsoDate.optional(),
      symptom: Symptom.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
);

export const TrendsQuery = DateRange;

export const ChatBody = z.object({
  question: z.string().trim().min(3).max(500),
});

export const EntryListResponse = z.object({
  items: z.array(Entry),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
export type EntryListResponse = z.infer<typeof EntryListResponse>;

export const ChatResponse = z.object({
  answer: z.string(),
  toolCalls: z.array(z.object({ name: z.string(), input: z.unknown(), ok: z.boolean() })),
  steps: z.int(),
});
export type ChatResponse = z.infer<typeof ChatResponse>;

export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
