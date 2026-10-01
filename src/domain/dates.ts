import type { IsoDate } from "./model.js";

const DAY_MS = 86_400_000;

const toUtc = (d: IsoDate): number => Date.parse(`${d}T00:00:00.000Z`);
const fromUtc = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: IsoDate, days: number): IsoDate => fromUtc(toUtc(d) + days * DAY_MS);

export const daysBetween = (a: IsoDate, b: IsoDate): number => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
