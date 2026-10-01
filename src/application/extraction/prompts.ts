import { MOODS, SYMPTOMS, type IsoDate } from "../../domain/model.js";

export const EXTRACTION_TOOL_NAME = "record_entry";

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured data from short personal health notes.
Rules:
- Only record what the note states or clearly implies. Never guess.
- Omit a field entirely when the note does not mention it.
- energy is on a 1 to 5 scale. If the note uses another scale (e.g. 8/10), convert it.
- mood must be one of: ${MOODS.join(", ")}.
- symptoms may only contain: ${SYMPTOMS.join(", ")}. Ignore negated symptoms ("no headache").
- Resolve relative dates ("yesterday", "on Monday") against the reference date.
Always answer by calling the ${EXTRACTION_TOOL_NAME} tool.`;

// The note is fenced in tags so instructions inside it read as data.
export const buildExtractionPrompt = (text: string, referenceDate: IsoDate): string =>
  `Reference date: ${referenceDate}\n\n<note>\n${text}\n</note>`;

export const buildRetryPrompt = (issues: string): string =>
  `Your previous ${EXTRACTION_TOOL_NAME} call failed validation:\n${issues}\nCall ${EXTRACTION_TOOL_NAME} again with corrected values.`;
