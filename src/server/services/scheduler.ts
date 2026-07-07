import { dbRun, dbAll } from "../db.js";
import { WorkflowEngineService } from "./workflowEngine.js";
import { QueueService } from "./queue.js";

export const SchedulerService = {
  intervalId: null as any,

  /**
   * Starts the polling thread for schedules.
   */
  start(): void {
    if (this.intervalId) return;

    console.log("⏰ Workflow background scheduler active.");
    this.intervalId = setInterval(() => {
      this.checkSchedules();
    }, 15000); // poll database schedules every 15 seconds
  },

  /**
   * Stops the background poller thread.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  /**
   * Performs the database check for any schedules that are due or overdue.
   */
  async checkSchedules(): Promise<void> {
    try {
      const nowStr = new Date().toISOString();
      const schedules = await dbAll<any>(
        "SELECT * FROM workflow_schedules WHERE is_active = 1 AND (next_run_at IS NULL OR next_run_at <= ?)",
        [nowStr]
      );

      for (const s of schedules) {
        console.log(`[Scheduler] Triggering workflow ${s.workflow_id} via schedule ${s.id}`);

        // 1. Queue a new run
        const runId = await WorkflowEngineService.createRun(s.workflow_id, s.user_id, {
          trigger_source: "schedule"
        });
        QueueService.enqueue(runId, s.user_id);

        // 2. Parse configuration and compute next run datetime
        let config: any = {};
        try {
          if (s.schedule_config) {
            config = JSON.parse(s.schedule_config);
          }
        } catch {
          // ignore
        }

        const nextRun = this.calculateNextRun(s.schedule_type, config);

        // 3. Update schedule timestamps
        await dbRun(
          "UPDATE workflow_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
          [nowStr, nextRun.toISOString(), s.id]
        );
      }
    } catch (err) {
      console.error("Scheduler error during run check:", err);
    }
  },

  /**
   * Calculates the next calendar date/time for schedule execution.
   */
  calculateNextRun(type: string, config: any): Date {
    const now = new Date();
    switch (type) {
      case "once":
        // deactivate schedule effectively after first run
        return new Date(now.getTime() + 100 * 365 * 24 * 3600000); // 100 years in future
      case "hourly":
        return new Date(now.getTime() + 3600000);
      case "daily": {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        if (config.time) {
          const [h, m] = config.time.split(":");
          d.setHours(Number(h), Number(m), 0, 0);
        }
        return d;
      }
      case "weekly": {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      }
      case "monthly": {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      }
      case "cron": {
        return new Date(now.getTime() + 3600000); // default to 1 hour fallback
      }
      default:
        return new Date(now.getTime() + 3600000);
    }
  }
};
