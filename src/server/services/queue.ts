import { WorkflowEngineService } from "./workflowEngine.js";

interface QueueTask {
  runId: string;
  userId: string;
}

export const QueueService = {
  activeCount: 0,
  maxConcurrency: 5,
  queue: [] as QueueTask[],

  /**
   * Pushes a new execution run to the processing queue and triggers next execution.
   */
  enqueue(runId: string, userId: string): void {
    this.queue.push({ runId, userId });
    this.processNext();
  },

  /**
   * Processes the next task in the queue if concurrency limits allow.
   */
  async processNext(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    try {
      await WorkflowEngineService.startRun(task.runId, task.userId);
    } catch (err) {
      console.error(`Error executing run ${task.runId} in queue:`, err);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }
};
