/**
 * Minimal scheduler stub.
 *
 * The backend uses this to start/stop periodic jobs.
 * In this repo, most periodic work is implemented as interval-based jobs in `server.ts`.
 */

export function startScheduledJobs(): { stop: () => void } {
  return {
    stop: () => {
      // no-op
    },
  };
}

