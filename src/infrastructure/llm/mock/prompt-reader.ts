import type { IsoDate } from "../../../domain/model.js";

// The mock plays the part of a model, so it reads the prompts as text. The formats
// it expects are those produced by application/extraction/prompts.ts.

export function readExtractionPrompt(prompt: string): { note: string; referenceDate: IsoDate } | undefined {
  const referenceDate = /Reference date: (\d{4}-\d{2}-\d{2})/.exec(prompt)?.[1];
  const note = /<note>\n([\s\S]*)\n<\/note>/.exec(prompt)?.[1];
  if (referenceDate === undefined || note === undefined) return undefined;
  return { note: note.trim(), referenceDate };
}
