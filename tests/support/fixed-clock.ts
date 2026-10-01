import type { Clock } from "../../src/application/ports/clock.js";
import type { IsoDate } from "../../src/domain/model.js";

export const fixedClock = (date: IsoDate): Clock => ({ today: () => date });
