import { EntryService } from "../../src/application/entries/entry-service.js";
import { ExtractionService } from "../../src/application/extraction/extraction-service.js";
import { InMemoryEntryRepository } from "../../src/infrastructure/persistence/in-memory-entry-repository.js";
import { TODAY } from "./builders.js";
import { fixedClock } from "./fixed-clock.js";
import { ScriptedProvider } from "./scripted-provider.js";

/** An EntryService over in-memory storage, for tests that only read entries. */
export function inMemoryEntries() {
  const repository = new InMemoryEntryRepository();
  const entries = new EntryService(repository, new ExtractionService(new ScriptedProvider([])), fixedClock(TODAY));
  return { repository, entries };
}
