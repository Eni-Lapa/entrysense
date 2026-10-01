import type { Entry, IsoDate, Symptom, Trends } from "../../domain/model.js";
import { computeTrends } from "../../domain/trends.js";
import type { ExtractionService } from "../extraction/extraction-service.js";
import type { Clock } from "../ports/clock.js";
import type { EntryRepository } from "../ports/entry-repository.js";
import type { CallContext } from "../ports/llm-provider.js";

export interface EntryQuery {
  from?: IsoDate | undefined;
  to?: IsoDate | undefined;
  symptom?: Symptom | undefined;
  page: number;
  pageSize: number;
}

export interface EntryPage {
  items: Entry[];
  page: number;
  pageSize: number;
  total: number;
}

export class EntryService {
  constructor(
    private readonly repository: EntryRepository,
    private readonly extractor: ExtractionService,
    private readonly clock: Clock,
  ) {}

  async create(text: string, context?: CallContext): Promise<Entry> {
    const today = this.clock.today();
    const { extraction, extractedBy } = await this.extractor.extract(text, today, context);
    return this.repository.create({
      text,
      date: extraction.date ?? today,
      sleepHours: extraction.sleepHours ?? null,
      energy: extraction.energy ?? null,
      mood: extraction.mood ?? null,
      symptoms: [...new Set(extraction.symptoms)],
      extractedBy,
    });
  }

  /** Newest first. */
  async find({ from, to, symptom, page, pageSize }: EntryQuery): Promise<EntryPage> {
    const { items, total } = await this.repository.list(
      { from, to, symptom },
      { offset: (page - 1) * pageSize, limit: pageSize },
    );
    return { items, page, pageSize, total };
  }

  /** The range must already be bounded (see DateRange). */
  async trends(from: IsoDate, to: IsoDate): Promise<Trends> {
    return computeTrends(await this.repository.findAll({ from, to }), from, to);
  }
}
