import { dbRun, dbAll } from "../db.js";

const generateId = () =>
  Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

export const NotificationsService = {
  /**
   * Creates a notification in the database for a user and logs it on the server.
   */
  async createNotification(
    userId: string,
    message: string,
    type: "finished" | "failed" | "approval_required" | "in_app" | "desktop",
    runId?: string | null
  ): Promise<void> {
    const id = generateId();
    const createdAt = new Date().toISOString();

    await dbRun(
      "INSERT INTO workflow_notifications (id, user_id, run_id, type, message, read_status, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      [id, userId, runId || null, type, message, createdAt]
    );

    console.log(`[Notification - ${type.toUpperCase()}] User: ${userId} | ${message}`);
  },

  /**
   * Retrieves all notifications for a given user, ordered by creation date.
   */
  async getNotifications(userId: string): Promise<any[]> {
    return await dbAll(
      "SELECT * FROM workflow_notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await dbRun(
      "UPDATE workflow_notifications SET read_status = 1 WHERE id = ? AND user_id = ?",
      [id, userId]
    );
  },

  /**
   * Marks all notifications as read for a given user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await dbRun(
      "UPDATE workflow_notifications SET read_status = 1 WHERE user_id = ?",
      [userId]
    );
  }
};
