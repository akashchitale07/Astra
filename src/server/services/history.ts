import { dbAll, dbGet } from "../db.js";

export const HistoryService = {
  /**
   * Generates comprehensive statistics and metrics for the workflow dashboard.
   */
  async getDashboardStats(userId: string): Promise<any> {
    const totalWorkflows = await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM workflows WHERE user_id = ?",
      [userId]
    );
    const activeWorkflows = await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM workflows WHERE user_id = ? AND is_active = 1",
      [userId]
    );
    const runningWorkflows = await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM workflow_runs WHERE user_id = ? AND status = 'running'",
      [userId]
    );
    const scheduledJobs = await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM workflow_schedules WHERE user_id = ? AND is_active = 1",
      [userId]
    );

    const runs = await dbAll<{ status: string }>(
      "SELECT status FROM workflow_runs WHERE user_id = ?",
      [userId]
    );

    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status === "completed").length;
    const failedRuns = runs.filter((r) => r.status === "failed").length;
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 100;

    const recentRuns = await dbAll<any>(
      `SELECT r.*, w.name as workflow_name
       FROM workflow_runs r
       JOIN workflows w ON r.workflow_id = w.id
       WHERE r.user_id = ?
       ORDER BY r.started_at DESC
       LIMIT 10`,
      [userId]
    );

    // Let's gather timeline chart data: runs completed per day for last 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      
      const dayRuns = await dbGet<{ count: number }>(
        "SELECT COUNT(*) as count FROM workflow_runs WHERE user_id = ? AND started_at LIKE ?",
        [userId, `${dayStr}%`]
      );
      
      const dayFailed = await dbGet<{ count: number }>(
        "SELECT COUNT(*) as count FROM workflow_runs WHERE user_id = ? AND status = 'failed' AND started_at LIKE ?",
        [userId, `${dayStr}%`]
      );

      dailyStats.push({
        date: dayStr,
        runs: dayRuns?.count || 0,
        failed: dayFailed?.count || 0
      });
    }

    return {
      totalWorkflows: totalWorkflows?.count || 0,
      activeWorkflows: activeWorkflows?.count || 0,
      runningWorkflows: runningWorkflows?.count || 0,
      scheduledJobs: scheduledJobs?.count || 0,
      successRate,
      failedRuns,
      completedRuns,
      totalRuns,
      recentRuns,
      timeline: dailyStats
    };
  }
};
