import { useState, useEffect } from "react";
import Layout from "../components/Layout.js";
import { api } from "../api/client.js";
import {
  Play,
  Trash2,
  Edit2,
  Plus,
  GitBranch,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Bell,
  Sparkles,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Loader2,
  Search,
  Check
} from "lucide-react";

export default function WorkflowsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"workflows" | "templates" | "history" | "notifications">("workflows");
  
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");

  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);
  const [triggeringWorkflowId, setTriggeringWorkflowId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, listData, templatesData, runsData, notifData] = await Promise.all([
        api.get("/workflows/stats"),
        api.get("/workflows"),
        api.get("/workflows/templates"),
        api.get("/workflows/runs"),
        api.get("/workflows/notifications")
      ]);

      setStats(statsData);
      setWorkflows(listData || []);
      setTemplates(templatesData || []);
      setRuns(runsData || []);
      setNotifications(notifData || []);
    } catch (err) {
      console.error("Error loading workflows dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh executions & stats every 8 seconds
    const interval = setInterval(async () => {
      try {
        const [statsData, runsData, notifData, listData] = await Promise.all([
          api.get("/workflows/stats"),
          api.get("/workflows/runs"),
          api.get("/workflows/notifications"),
          api.get("/workflows")
        ]);
        setStats(statsData);
        setRuns(runsData || []);
        setNotifications(notifData || []);
        setWorkflows(listData || []);
      } catch (e) {
        // ignore background poll errors
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.post("/workflows", {
        name: newWorkflowName,
        description: newWorkflowDesc
      });
      window.location.href = `/workflows/${result.id}`;
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  };

  const handleDeleteWorkflow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this workflow? All associated runs and logs will be deleted.")) return;
    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to delete workflow:", err);
    }
  };

  const handleRunWorkflow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTriggeringWorkflowId(id);
      await api.post(`/workflows/${id}/run`, {});
      fetchDashboardData();
      setActiveTab("history");
    } catch (err) {
      console.error("Failed to trigger workflow:", err);
    } finally {
      setTriggeringWorkflowId(null);
    }
  };

  const handleInstallTemplate = async (templateId: string) => {
    try {
      setInstallingTemplateId(templateId);
      const result = await api.post(`/workflows/templates/${templateId}/install`, {});
      window.location.href = `/workflows/${result.workflowId}`;
    } catch (err) {
      console.error("Failed to install template:", err);
    } finally {
      setInstallingTemplateId(null);
    }
  };

  const handleMarkNotifRead = async (id: string) => {
    try {
      await api.post(`/workflows/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: 1 } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllNotifRead = async () => {
    try {
      await api.post("/workflows/notifications/all/read", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: 1 })));
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleResumeRun = async (runId: string) => {
    if (!confirm("Approve execution resume?")) return;
    try {
      await api.post(`/workflows/runs/${runId}/resume`, {});
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to resume run:", err);
    }
  };

  const handleCancelRun = async (runId: string) => {
    if (!confirm("Are you sure you want to terminate this run?")) return;
    try {
      await api.post(`/workflows/runs/${runId}/cancel`, {});
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to cancel run:", err);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 space-y-8 animate-fade-in text-zinc-900 dark:text-zinc-100">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-100 pb-6 dark:border-zinc-800/50">
          <div>
            <h1 className="font-sans text-2xl font-extrabold tracking-tight md:text-3xl flex items-center space-x-3">
              <GitBranch className="h-8 w-8 text-blue-600 animate-pulse" />
              <span>Workflow Automation</span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Build, schedule, monitor, and execute custom multi-node AI and computer control automations.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workflow</span>
          </button>
        </div>

        {/* Dashboard Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Active Workflows</span>
                <p className="text-2xl font-extrabold mt-1">{stats.activeWorkflows} / {stats.totalWorkflows}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3 text-blue-500">
                <GitBranch className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Running Flows</span>
                <p className="text-2xl font-extrabold mt-1">{stats.runningWorkflows}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3 text-green-500">
                <Activity className="h-5 w-5 animate-spin" />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Scheduled Jobs</span>
                <p className="text-2xl font-extrabold mt-1">{stats.scheduledJobs}</p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-3 text-purple-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Success Rate</span>
                <p className="text-2xl font-extrabold mt-1 text-green-600 dark:text-green-400">{stats.successRate}%</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-3 text-amber-500">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("workflows")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "workflows"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            My Workflows ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "templates"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Pre-built Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Executions History ({runs.length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors relative ${
              activeTab === "notifications"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <span>Alerts & Approvals</span>
            {notifications.filter((n) => n.read_status === 0).length > 0 && (
              <span className="absolute top-1.5 right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-sm text-zinc-500">Loading system state...</p>
          </div>
        )}

        {!loading && (
          <div>
            {/* WORKFLOWS TAB */}
            {activeTab === "workflows" && (
              <div className="space-y-4">
                {workflows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center max-w-lg mx-auto space-y-4 dark:border-zinc-800">
                    <GitBranch className="h-10 w-10 text-zinc-400 mx-auto opacity-50" />
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">No workflows defined</h3>
                    <p className="text-xs text-zinc-500">
                      Create your very first visual orchestration from scratch, or browse our template library to get started.
                    </p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      Create from scratch
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workflows.map((w) => (
                      <div
                        key={w.id}
                        onClick={() => (window.location.href = `/workflows/${w.id}`)}
                        className="group relative rounded-xl border border-zinc-100 bg-white p-5 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <h3 className="font-sans font-bold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50">
                              {w.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                w.is_active === 1
                                  ? "bg-green-500/10 text-green-600"
                                  : "bg-zinc-500/10 text-zinc-500"
                              }`}
                            >
                              {w.is_active === 1 ? "Active" : "Paused"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">
                            {w.description || "No description provided."}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-50 pt-4 mt-6 dark:border-zinc-800/40">
                          <span className="text-[10px] font-mono text-zinc-400">
                            Version {w.version} • Trigger: {w.trigger_type}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => handleRunWorkflow(w.id, e)}
                              disabled={triggeringWorkflowId === w.id}
                              className="rounded p-1.5 hover:bg-green-50 text-green-600 dark:hover:bg-green-950/20 disabled:opacity-40 cursor-pointer"
                              title="Run immediately"
                            >
                              {triggeringWorkflowId === w.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/workflows/${w.id}`;
                              }}
                              className="rounded p-1.5 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/20 cursor-pointer"
                              title="Edit canvas"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteWorkflow(w.id, e)}
                              className="rounded p-1.5 hover:bg-red-50 text-red-600 dark:hover:bg-red-950/20 cursor-pointer"
                              title="Delete workflow"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TEMPLATES TAB */}
            {activeTab === "templates" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between"
                  >
                    <div>
                      <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600 w-fit">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <h3 className="font-sans font-bold text-zinc-900 mt-4 dark:text-zinc-50">
                        {t.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-3">
                        {t.description}
                      </p>
                    </div>

                    <div className="border-t border-zinc-50 pt-4 mt-6 dark:border-zinc-800/40 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-100/30 dark:bg-blue-950/30 px-2 py-0.5 rounded uppercase">
                        System built-in
                      </span>
                      <button
                        onClick={() => handleInstallTemplate(t.id)}
                        disabled={installingTemplateId === t.id}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                      >
                        {installingTemplateId === t.id ? (
                          <span className="flex items-center space-x-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Installing...</span>
                          </span>
                        ) : (
                          <>
                            <span>Install Copy</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <div className="rounded-xl border border-zinc-100 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                {runs.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <Activity className="h-8 w-8 text-zinc-400 mx-auto opacity-55" />
                    <p className="text-sm font-semibold text-zinc-600">No execution logs found</p>
                    <p className="text-xs text-zinc-400">Trigger a manual run of a workflow to begin recording logs.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-400 uppercase dark:bg-zinc-900/30 dark:border-zinc-800">
                          <th className="p-4">Workflow</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Trigger</th>
                          <th className="p-4">Started At</th>
                          <th className="p-4">Duration</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/40">
                        {runs.map((r) => (
                          <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                            <td className="p-4 font-semibold text-zinc-900 dark:text-zinc-100">
                              {r.workflow_name}
                            </td>
                            <td className="p-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center w-fit space-x-1.5 uppercase ${
                                  r.status === "completed"
                                    ? "bg-green-500/10 text-green-600"
                                    : r.status === "failed"
                                    ? "bg-red-500/10 text-red-600"
                                    : r.status === "running"
                                    ? "bg-blue-500/10 text-blue-600"
                                    : r.status === "paused"
                                    ? "bg-amber-500/10 text-amber-600 animate-pulse"
                                    : "bg-zinc-500/10 text-zinc-500"
                                }`}
                              >
                                {r.status === "completed" && <CheckCircle className="h-3.5 w-3.5" />}
                                {r.status === "failed" && <XCircle className="h-3.5 w-3.5" />}
                                {r.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {r.status === "paused" && <AlertCircle className="h-3.5 w-3.5" />}
                                <span>{r.status}</span>
                              </span>
                            </td>
                            <td className="p-4 text-xs text-zinc-500">
                              {r.variables_state ? (
                                <span className="font-mono">
                                  {JSON.parse(r.variables_state).trigger_source || "manual"}
                                </span>
                              ) : (
                                "manual"
                              )}
                            </td>
                            <td className="p-4 text-xs text-zinc-500">
                              {new Date(r.started_at).toLocaleString()}
                            </td>
                            <td className="p-4 text-xs text-zinc-500">
                              {r.duration ? `${Math.round(r.duration / 100) / 10}s` : "—"}
                            </td>
                            <td className="p-4 flex items-center space-x-2">
                              <button
                                onClick={() => (window.location.href = `/workflows/${r.workflow_id}?runId=${r.id}`)}
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1 cursor-pointer"
                              >
                                <span>View Logs</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                              {r.status === "paused" && (
                                <button
                                  onClick={() => handleResumeRun(r.id)}
                                  className="text-xs font-bold text-green-600 hover:underline cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {r.status === "running" && (
                                <button
                                  onClick={() => handleCancelRun(r.id)}
                                  className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                                >
                                  Terminate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === "notifications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500">View real-time orchestrator signals.</span>
                  {notifications.filter((n) => n.read_status === 0).length > 0 && (
                    <button
                      onClick={handleMarkAllNotifRead}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="rounded-xl border border-zinc-100 bg-white p-12 text-center space-y-2 dark:border-zinc-800 dark:bg-zinc-950">
                    <Bell className="h-8 w-8 text-zinc-400 mx-auto opacity-55" />
                    <p className="text-sm font-semibold text-zinc-600">No active alerts</p>
                    <p className="text-xs text-zinc-400">All system events are clear.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-4 transition-all flex items-start justify-between ${
                          n.read_status === 0
                            ? "bg-blue-500/[0.02] border-blue-100 dark:border-blue-900/30"
                            : "bg-white border-zinc-100 dark:bg-zinc-950 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex space-x-3.5">
                          <div
                            className={`rounded-lg p-2 mt-0.5 shrink-0 ${
                              n.type === "approval_required"
                                ? "bg-amber-500/10 text-amber-500"
                                : n.type === "failed"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-blue-500/10 text-blue-500"
                            }`}
                          >
                            <Bell className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {n.message}
                            </p>
                            <span className="text-[10px] font-mono text-zinc-400 block mt-1">
                              {new Date(n.created_at).toLocaleString()} • ID: {n.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0 ml-4">
                          {n.type === "approval_required" && n.read_status === 0 && (
                            <button
                              onClick={() => handleResumeRun(n.run_id)}
                              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {n.run_id && (
                            <button
                              onClick={() => (window.location.href = `/workflows/runs`)}
                              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                            >
                              Details
                            </button>
                          )}
                          {n.read_status === 0 && (
                            <button
                              onClick={() => handleMarkNotifRead(n.id)}
                              className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                              title="Mark read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CREATE WORKFLOW MODAL */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-zinc-100 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="font-sans text-lg font-bold">New Automation Workflow</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Establish a fresh automation project. You will construct nodes inside our design grid.
              </p>

              <form onSubmit={handleCreateWorkflow} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Workflow Name</label>
                  <input
                    type="text"
                    required
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    placeholder="e.g. Daily Backups"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Description (Optional)</label>
                  <textarea
                    value={newWorkflowDesc}
                    onChange={(e) => setNewWorkflowDesc(e.target.value)}
                    placeholder="Brief summary describing the workflow actions..."
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-50 dark:border-zinc-800/40">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                  >
                    Build Workflow
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
