export const directorCadence = { intervalMinutes: 30, minimumRequestGapMs: 30000 } as const;

export type SimulationClock = { sessionId: string; elapsedMinutes: number };

export class DirectorSchedule {
  private lastAttemptMs?: number;
  private previousClock?: SimulationClock;
  private simulatedMinutes = 0;
  private retryPending = false;
  private retryCount = 0;

  retryAfterFailure(): void {
    if (this.retryCount < 2) { this.retryPending = true; this.retryCount++; }
  }

  cooldownSeconds(nowMs: number): number {
    return this.lastAttemptMs === undefined ? 0 : Math.max(0, Math.ceil((this.lastAttemptMs + directorCadence.minimumRequestGapMs - nowMs) / 1000));
  }

  take(nowMs: number, clock?: SimulationClock, manual = false): boolean {
    if (clock) {
      const elapsed = Number.isFinite(clock.elapsedMinutes) ? Math.max(0, clock.elapsedMinutes) : 0;
      const previous = this.previousClock?.sessionId === clock.sessionId ? this.previousClock.elapsedMinutes : 0;
      this.simulatedMinutes += Math.max(0, elapsed - previous);
      this.previousClock = { ...clock, elapsedMinutes: elapsed };
    } else {
      this.previousClock = undefined;
    }
    if (this.cooldownSeconds(nowMs) > 0) return false;
    const intervalDue = this.lastAttemptMs === undefined || (clock
      ? this.simulatedMinutes >= directorCadence.intervalMinutes
      : nowMs - this.lastAttemptMs >= directorCadence.intervalMinutes * 60000);
    if (!manual && !intervalDue && !this.retryPending) return false;
    if (manual || intervalDue) this.retryCount = 0;
    this.retryPending = false;
    this.lastAttemptMs = nowMs;
    this.simulatedMinutes = 0;
    return true;
  }
}