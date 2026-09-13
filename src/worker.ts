import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { enqueue } from "./queue/index.js";
import { startWorker } from "./queue/worker.js";

startWorker();
setInterval(
  () => {
    enqueue("job-discovery", "scheduled-search", {}, {
      idempotencyKey: `job-discovery:scheduled-search:${new Date().toISOString().slice(0, 13)}`,
    }).catch((error) => {
      logger.warn({ err: error }, "Failed to enqueue scheduled search");
    });
  },
  env.JOB_SEARCH_INTERVAL_HOURS * 60 * 60 * 1000,
).unref?.();

logger.info("Standalone worker process ready");
