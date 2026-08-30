import type { FastifyInstance } from "fastify";

/**
 * A very small periodic-job runner.
 *
 * The API had no scheduler at all, which is why two things that the schema and
 * the interface both already described had never actually happened: requests
 * nobody answered were never expired, and nobody was ever reminded that a
 * session they had paid for was about to start.
 *
 * Deliberately not a cron library. These jobs are minute-granularity sweeps
 * that are safe to run late, safe to run twice, and safe to miss entirely
 * during a deploy — every one of them re-derives its work from the database
 * rather than from a schedule it has to keep in step with. A dependency, a
 * cron expression syntax and a second failure mode would buy nothing.
 *
 * Multi-process safety is each job's own problem, not the runner's: with more
 * than one API instance every job runs on every instance, so each sweep claims
 * its rows in the same statement that reads them.
 */

export type ScheduledJob = {
  name: string;
  /** How often to run, in milliseconds. */
  everyMs: number;
  /** Returns how many items it handled, purely so the log line is useful. */
  run: () => Promise<number>;
};

export function registerScheduler(server: FastifyInstance, jobs: ScheduledJob[]): void {
  const timers: NodeJS.Timeout[] = [];

  for (const job of jobs) {
    const tick = async (): Promise<void> => {
      try {
        const handled = await job.run();
        // Silence when there was nothing to do — these run every few minutes
        // and an idle sweep should not fill the log.
        if (handled > 0) {
          server.log.info({ job: job.name, handled }, "scheduled job completed");
        }
      } catch (error) {
        // A failing sweep must never take the API down with it; the next tick
        // re-derives the same work from the database and tries again.
        server.log.error({ job: job.name, err: error }, "scheduled job failed");
      }
    };

    const timer = setInterval(() => void tick(), job.everyMs);
    // Do not hold the process open for the sake of a sweep.
    timer.unref();
    timers.push(timer);

    // Run once shortly after boot rather than immediately: on a deploy the
    // database may still be coming up, and nothing here is urgent.
    const initial = setTimeout(() => void tick(), 30_000);
    initial.unref();
  }

  server.addHook("onClose", async () => {
    for (const timer of timers) clearInterval(timer);
  });
}
