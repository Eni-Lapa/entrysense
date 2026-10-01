import type { IsoDate } from "../../domain/model.js";

export interface Clock {
  /** The current calendar date in the user's time zone. */
  today(): IsoDate;
}
