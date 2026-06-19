import type { DateIso } from '../types';

export type Clock = {
  now(): Date;
  nowIso(): DateIso;
};

export const systemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};
