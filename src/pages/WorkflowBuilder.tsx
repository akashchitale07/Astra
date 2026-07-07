import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout.js";
import { api } from "../api/client.js";
import {
  Play,
  Save,
  Plus,
  X,
  Settings,
  Activity,
  GitBranch,
  ArrowRight,
  Clock,
  Sparkles,
  BookOpen,
  Terminal,
  FileText,
  Check,
  Loader2,
  HelpCircle,
  FolderOpen,
  Globe,
  Code,
  Sliders,
  AlertCircle,
  CheckCircle,
  Eye,
  Trash2
} from "lucide-react";

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const runIdParam = searchParams.get("runId");

  // Workflow graph states
  const [workflow, setWorkflow] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [variables, setVariables] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  
  // Real-time run logs
  const [activeRun, setActiveRun] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

  // Editor states
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Drag and drop states
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Connection tool states
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingSourceHandle, setConnectingSourceHandle] = useState<string | null>(null);

  // Sidebar control tabs
  const [sidebarTab, setSidebarTab] = useState<"nodes" | "variables" | "schedules" | "logs">("nodes");

  // Add variable states
  const [newVarName, setNewVarName] = useState("");
  const [newVarVal, setNewVarVal] = useState("");

  // Add schedule states
  const [newSchedType, setNewSchedType] = useState<"hourly" | "daily" | "weekly" | "monthly" | "cron">("daily");
  const [newSchedTime, setNewSchedTime] = useState("09:00");

  const fetchWorkflowData = async () => {
    try {
      const data = await api.get(`/workflows/${id}`);
      setWorkflow(data);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setVariables(data.variables || []);
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error("Failed to load workflow details:", err);
    }
  };

  const fetchRunLogs = async (runId: string) => {
    try {
      const data = await api.get(`/workflows/runs/${runId}`);
      setActiveRun(data);
      setLogs(data.logs || []);
      setCurrentNodeId(data.current_node_id);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  useEffect(() => {
    fetchWorkflowData();
    if (runIdParam) {
      setSidebarTab("logs");
      fetchRunLogs(runIdParam);
    }
  }, [id, runIdParam]);

  // Poll logs if there's an active run in 'running' state
  useEffect(() => {
    if (!activeRun || activeRun.status !== "running") return;
    const interval = setInterval(() => {
      fetchRunLogs(activeRun.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeRun]);

  // Mouse Handlers for Repositioning Nodes
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".handle")) return; // skip if clicked connection handle
    e.preventDefault();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggingNodeId(nodeId);
    dragOffset.current = {
      x: e.clientX - node.position_x,
      y: e.clientY - node.position_y
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = Math.max(0, e.clientX - dragOffset.current.x);
    const y = Math.max(0, e.clientY - dragOffset.current.y);

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, position_x: x, position_y: y } : n))
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Node adding logic
  const handleAddNode = (type: string) => {
    const defaultLabels: Record<string, string> = {
      start: "Start",
      end: "End",
      delay: "Delay",
      condition: "Condition Check",
      switch: "Switch Node",
      loop: "Loop Node",
      variable: "Set Variable",
      notification: "Alert Notify",
      ai_prompt: "Ask Gemini AI",
      browser_action: "Browser Search",
      computer_action: "Launch Script",
      file_action: "Manage File",
      http_request: "External Fetch",
      script_runner: "JS Sandbox",
      user_input: "Wait Confirmation",
      wait: "Pause Wait"
    };

    const defaultConfigs: Record<string, any> = {
      delay: { duration: 2000 },
      condition: { logicalOperator: "AND", rules: [] },
      switch: { field: "variableName", cases: [] },
      loop: { variable_name: "index", start: 0, end: 5 },
      variable: { name: "my_var", value: "hello", value_type: "string" },
      notification: { message: "Task complete!" },
      ai_prompt: { prompt: "Translate: {{text}}", variable_name: "ai_output" },
      browser_action: { action: "search", query: "Astra AI", variable_name: "results" },
      computer_action: { command: "echo 'Success'" },
      file_action: { action: "read", path: "./test.txt", variable_name: "file_data" },
      http_request: { method: "GET", url: "https://api.github.com", headers: "{}", body: "", variable_name: "api_out" },
      script_runner: { script: "return vars.my_var + ' suffix';" },
      user_input: { message: "Verify file content." },
      wait: { duration: 5000 }
    };

    const newNode = {
      id: `node_${Math.random().toString(36).substring(2, 9)}`,
      type,
      label: defaultLabels[type] || "Custom Step",
      position_x: 250,
      position_y: 150,
      config: defaultConfigs[type] || {}
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(newNode);
  };

  // Connection management
  const handleHandleClick = (nodeId: string, handleType: "source" | "target", handleName: string | null) => {
    if (handleType === "source") {
      setConnectingSourceId(nodeId);
      setConnectingSourceHandle(handleName);
    } else {
      if (connectingSourceId) {
        // Prevent connecting to self
        if (connectingSourceId === nodeId) return;

        // Check if connection already exists
        const exists = edges.some(
          (e) => e.source_node_id === connectingSourceId && e.target_node_id === nodeId
        );
        if (!exists) {
          const newEdge = {
            id: `edge_${Math.random().toString(36).substring(2, 9)}`,
            source_node_id: connectingSourceId,
            target_node_id: nodeId,
            source_handle: connectingSourceHandle,
            target_handle: null
          };
          setEdges((prev) => [...prev, newEdge]);
        }

        // Reset
        setConnectingSourceId(null);
        setConnectingSourceHandle(null);
      }
    }
  };

  const handleRemoveEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  const handleRemoveNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  // Variables and Schedules Config
  const handleAddVariable = () => {
    if (!newVarName) return;
    setVariables((prev) => [
      ...prev,
      { id: `v_${Date.now()}`, name: newVarName, value: newVarVal, scope: "workflow" }
    ]);
    setNewVarName("");
    setNewVarVal("");
  };

  const handleAddSchedule = () => {
    setSchedules((prev) => [
      ...prev,
      { id: `s_${Date.now()}`, schedule_type: newSchedType, schedule_config: { time: newSchedTime }, is_active: 1 }
    ]);
  };

  const handleRemoveVariable = (name: string) => {
    setVariables((prev) => prev.filter((v) => v.name !== name));
  };

  const handleRemoveSchedule = (idStr: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== idStr));
  };

  // AI Workflow Builder Generator
  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    try {
      setIsGenerating(true);
      const data = await api.post("/workflows/generate", { prompt: aiPrompt });
      
      if (data.nodes) {
        setNodes(data.nodes);
        setEdges(data.edges || []);
        setVariables(data.variables || []);
        if (data.name) {
          setWorkflow((prev: any) => ({ ...prev, name: data.name, description: data.description }));
        }
      }
    } catch (err: any) {
      alert(`AI Generation error: ${err.message || "Failed to process blueprint"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save changes to database
  const handleSaveWorkflow = async () => {
    try {
      setIsSaving(true);
      await api.put(`/workflows/${id}`, {
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.is_active,
        trigger_type: workflow.trigger_type,
        nodes,
        edges,
        variables,
        schedules
      });
      alert("Workflow project saved successfully.");
      fetchWorkflowData();
    } catch (err: any) {
      alert(`Validation / Save error: ${err.message || "Failed to save workflow diagram"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Run manually
  const handleTriggerRun = async () => {
    try {
      setIsSaving(true);
      // Save state first
      await api.put(`/workflows/${id}`, {
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.is_active,
        trigger_type: workflow.trigger_type,
        nodes,
        edges,
        variables,
        schedules
      });

      const data = await api.post(`/workflows/${id}/run`, {});
      alert("Workflow execution triggered in background!");
      setSidebarTab("logs");
      fetchRunLogs(data.runId);
    } catch (err: any) {
      alert(`Trigger error: ${err.message || "Failed to run"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Visual Canvas Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-950 relative border-r border-zinc-200 dark:border-zinc-800">
          
          {/* Top Control Rail / AI Generator bar */}
          <div className="bg-white border-b border-zinc-200 p-4 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => (window.location.href = "/workflows")}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                ← Back
              </button>
              {workflow && (
                <div>
                  <h1 className="font-sans font-bold text-sm tracking-tight flex items-center space-x-1">
                    <span>{workflow.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      v{workflow.version}
                    </span>
                  </h1>
                  <p className="text-[11px] text-zinc-500 truncate max-w-sm">{workflow.description}</p>
                </div>
              )}
            </div>

            {/* AI Generator Bar */}
            <div className="flex items-center space-x-2 flex-1 max-w-md md:mx-4">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-2.5 h-3.5 w-3.5 text-blue-500" />
                <input
                  type="text"
                  placeholder="Ask Gemini to generate this workflow... (e.g. Daily backups)"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />
              </div>
              <button
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiPrompt}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "AI Generate"}
              </button>
            </div>

            {/* Control triggers */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTriggerRun}
                disabled={isSaving}
                className="flex items-center space-x-1.5 rounded-lg bg-green-600 py-1.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-green-700 transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run</span>
              </button>

              <button
                onClick={handleSaveWorkflow}
                disabled={isSaving}
                className="flex items-center space-x-1.5 rounded-lg bg-blue-600 py-1.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Blueprint</span>
              </button>
            </div>
          </div>

          {/* Interactive Flow Grid Design Space */}
          <div
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 overflow-auto relative select-none"
            style={{
              backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }}
          >
            {/* SVG Connecting lines layer */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none z-0">
              {edges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source_node_id);
                const targetNode = nodes.find((n) => n.id === edge.target_node_id);
                if (!sourceNode || !targetNode) return null;

                // Source Handle point
                let x1 = sourceNode.position_x + 180;
                let y1 = sourceNode.position_y + 40;
                if (edge.source_handle === "true") y1 = sourceNode.position_y + 25;
                if (edge.source_handle === "false") y1 = sourceNode.position_y + 55;
                if (edge.source_handle === "loop_body") y1 = sourceNode.position_y + 25;
                if (edge.source_handle === "loop_end") y1 = sourceNode.position_y + 55;

                // Target Handle point
                const x2 = targetNode.position_x;
                const y2 = targetNode.position_y + 40;

                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer">
                    <path
                      d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="none"
                      className="hover:stroke-red-500 hover:stroke-[4px] transition-all"
                      onClick={() => handleRemoveEdge(edge.id)}
                    >
                      <title>Click connection to delete</title>
                    </path>
                  </g>
                );
              })}
            </svg>

            {/* Render node items */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isActiveNode = currentNodeId === node.id;

              return (
                <div
                  key={node.id}
                  style={{ left: node.position_x, top: node.position_y }}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onDoubleClick={() => setSelectedNode(node)}
                  className={`absolute w-[180px] rounded-lg border bg-white shadow-xs dark:bg-zinc-900 z-10 select-none cursor-grab transition-shadow ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/10"
                      : isActiveNode
                      ? "border-green-500 ring-4 ring-green-500/20 shadow-md animate-pulse"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  {/* Left Target Connection Handle */}
                  {node.type !== "start" && (
                    <div
                      onClick={() => handleHandleClick(node.id, "target", null)}
                      className={`handle absolute -left-2 top-[32px] h-4 w-4 rounded-full border bg-white shadow-xs hover:scale-125 hover:bg-blue-500 transition-all cursor-crosshair flex items-center justify-center ${
                        connectingSourceId ? "border-blue-500 bg-blue-100" : "border-zinc-300"
                      }`}
                      title="Connect target input handle"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    </div>
                  )}

                  {/* Node Header Row */}
                  <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="font-sans text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {node.label}
                    </span>
                    <button
                      onClick={() => handleRemoveNode(node.id)}
                      className="rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 p-0.5 text-zinc-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Node Body details summary */}
                  <div className="p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                      {node.type}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate dark:text-zinc-400 mt-1">
                      {node.type === "ai_prompt" && node.config?.prompt}
                      {node.type === "delay" && `${node.config?.duration}ms`}
                      {node.type === "computer_action" && node.config?.command}
                      {node.type === "file_action" && `${node.config?.action}: ${node.config?.path}`}
                      {node.type === "notification" && node.config?.message}
                      {node.type === "condition" && "Conditional branches"}
                      {node.type === "loop" && `0 to ${node.config?.end}`}
                    </p>
                  </div>

                  {/* Right Source Connection Handles */}
                  {node.type !== "end" && (
                    <div>
                      {node.type === "condition" ? (
                        <>
                          <div
                            onClick={() => handleHandleClick(node.id, "source", "true")}
                            className="handle absolute -right-2 top-[16px] h-4 w-4 rounded-full border border-zinc-300 bg-white shadow-xs hover:bg-blue-500 cursor-crosshair flex items-center justify-center"
                            title="True output branch"
                          >
                            <span className="text-[8px] font-bold text-green-600">T</span>
                          </div>
                          <div
                            onClick={() => handleHandleClick(node.id, "source", "false")}
                            className="handle absolute -right-2 top-[44px] h-4 w-4 rounded-full border border-zinc-300 bg-white shadow-xs hover:bg-blue-500 cursor-crosshair flex items-center justify-center"
                            title="False output branch"
                          >
                            <span className="text-[8px] font-bold text-red-600">F</span>
                          </div>
                        </>
                      ) : node.type === "loop" ? (
                        <>
                          <div
                            onClick={() => handleHandleClick(node.id, "source", "loop_body")}
                            className="handle absolute -right-2 top-[16px] h-4 w-4 rounded-full border border-zinc-300 bg-white shadow-xs hover:bg-blue-500 cursor-crosshair flex items-center justify-center"
                            title="Loop cycle body path"
                          >
                            <span className="text-[8px] font-bold text-blue-500">B</span>
                          </div>
                          <div
                            onClick={() => handleHandleClick(node.id, "source", "loop_end")}
                            className="handle absolute -right-2 top-[44px] h-4 w-4 rounded-full border border-zinc-300 bg-white shadow-xs hover:bg-blue-500 cursor-crosshair flex items-center justify-center"
                            title="Loop completion end path"
                          >
                            <span className="text-[8px] font-bold text-zinc-500">E</span>
                          </div>
                        </>
                      ) : (
                        <div
                          onClick={() => handleHandleClick(node.id, "source", null)}
                          className="handle absolute -right-2 top-[32px] h-4 w-4 rounded-full border border-zinc-300 bg-white shadow-xs hover:scale-125 hover:bg-blue-500 transition-all cursor-crosshair flex items-center justify-center"
                          title="Connect output handle"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Builder Panel Drawer Sidebar (Variables, Schedules, Active Logs, Node Properties) */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
          
          {/* Sidebar Tab Triggers */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <button
              onClick={() => setSidebarTab("nodes")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                sidebarTab === "nodes" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-400"
              }`}
            >
              Steps ({nodes.length})
            </button>
            <button
              onClick={() => setSidebarTab("variables")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                sidebarTab === "variables" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-400"
              }`}
            >
              Variables ({variables.length})
            </button>
            <button
              onClick={() => setSidebarTab("schedules")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                sidebarTab === "schedules" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-400"
              }`}
            >
              Trigger
            </button>
            <button
              onClick={() => setSidebarTab("logs")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                sidebarTab === "logs" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-400"
              }`}
            >
              Live Monitor
            </button>
          </div>

          <div className="flex-1 p-5 space-y-6">
            
            {/* NODE INSPECTOR DETAILED DRAWER */}
            {selectedNode && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-4 dark:border-blue-900/30 dark:bg-blue-950/10 space-y-4 animate-fade-in relative">
                <button
                  onClick={() => setSelectedNode(null)}
                  className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-100/30 dark:bg-blue-950/40 px-2 py-0.5 rounded uppercase">
                    Node Configuration
                  </span>
                  <h3 className="text-sm font-bold mt-2">Configure {selectedNode.label}</h3>
                </div>

                {/* Common rename input */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Step Label</label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) => {
                      const updated = { ...selectedNode, label: e.target.value };
                      setSelectedNode(updated);
                      setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                    }}
                    className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                {/* AI Prompt node inputs */}
                {selectedNode.type === "ai_prompt" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">System / Input Prompt</label>
                      <textarea
                        value={selectedNode.config?.prompt || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, prompt: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        rows={4}
                        placeholder="e.g. Rewrite the following text: {{file_output}}"
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 resize-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Save output in variable</label>
                      <input
                        type="text"
                        value={selectedNode.config?.variable_name || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, variable_name: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        placeholder="ai_response"
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                  </div>
                )}

                {/* Delay Node Inputs */}
                {selectedNode.type === "delay" && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Delay Duration (ms)</label>
                    <input
                      type="number"
                      value={selectedNode.config?.duration || ""}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, duration: Number(e.target.value) }
                        };
                        setSelectedNode(updated);
                        setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                      }}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>
                )}

                {/* Computer Action Node Inputs */}
                {selectedNode.type === "computer_action" && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Terminal command string</label>
                    <textarea
                      value={selectedNode.config?.command || ""}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, command: e.target.value }
                        };
                        setSelectedNode(updated);
                        setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                      }}
                      rows={3}
                      placeholder="e.g. ls -la or tar -czf backup.tar.gz src/"
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 font-mono resize-none"
                    />
                  </div>
                )}

                {/* File Action Node Inputs */}
                {selectedNode.type === "file_action" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Action Mode</label>
                      <select
                        value={selectedNode.config?.action || "read"}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, action: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <option value="read">Read File text</option>
                        <option value="write">Write Content to path</option>
                        <option value="list">List Folder contents</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Workspace File/Directory Path</label>
                      <input
                        type="text"
                        value={selectedNode.config?.path || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, path: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        placeholder="e.g. ./downloads or ./logs/auth.log"
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>

                    {selectedNode.config?.action === "write" && (
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Write Content</label>
                        <textarea
                          value={selectedNode.config?.content || ""}
                          onChange={(e) => {
                            const updated = {
                              ...selectedNode,
                              config: { ...selectedNode.config, content: e.target.value }
                            };
                            setSelectedNode(updated);
                            setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                          }}
                          rows={3}
                          className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 resize-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* HTTP Request Node Inputs */}
                {selectedNode.type === "http_request" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Method</label>
                      <select
                        value={selectedNode.config?.method || "GET"}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, method: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">External Endpoint URL</label>
                      <input
                        type="text"
                        value={selectedNode.config?.url || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, url: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        placeholder="https://api.example.com/endpoint"
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                  </div>
                )}

                {/* Notification node inputs */}
                {selectedNode.type === "notification" && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Alert message</label>
                    <textarea
                      value={selectedNode.config?.message || ""}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, message: e.target.value }
                        };
                        setSelectedNode(updated);
                        setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                      }}
                      rows={2}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 resize-none font-mono"
                    />
                  </div>
                )}

                {/* Variable Config inputs */}
                {selectedNode.type === "variable" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Variable Name</label>
                      <input
                        type="text"
                        value={selectedNode.config?.name || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, name: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Variable Value</label>
                      <input
                        type="text"
                        value={selectedNode.config?.value || ""}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, value: e.target.value }
                          };
                          setSelectedNode(updated);
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updated : n)));
                        }}
                        className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NODES CATALOG TAB */}
            {sidebarTab === "nodes" && !selectedNode && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-sans font-bold text-xs text-zinc-400 uppercase">Automation Node Catalog</h3>
                  <p className="text-[11px] text-zinc-500 mt-1">Select and click a step below to place it inside your design workspace.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddNode("delay")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Clock className="h-5 w-5 text-purple-500" />
                    <span className="text-xs font-semibold mt-1">Delay</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("condition")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Sliders className="h-5 w-5 text-amber-500" />
                    <span className="text-xs font-semibold mt-1">Condition</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("ai_prompt")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <span className="text-xs font-semibold mt-1">Ask Gemini</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("computer_action")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Terminal className="h-5 w-5 text-red-500" />
                    <span className="text-xs font-semibold mt-1">Command</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("file_action")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-semibold mt-1">File Action</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("http_request")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Globe className="h-5 w-5 text-emerald-500" />
                    <span className="text-xs font-semibold mt-1">HTTP Fetch</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("notification")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <FileText className="h-5 w-5 text-indigo-500" />
                    <span className="text-xs font-semibold mt-1">Alert Notify</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("script_runner")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center"
                  >
                    <Code className="h-5 w-5 text-zinc-500" />
                    <span className="text-xs font-semibold mt-1">JS Sandbox</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("user_input")}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-100 hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer dark:border-zinc-800/40 text-center col-span-2"
                  >
                    <HelpCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-xs font-semibold mt-1">Approval Prompt (Wait)</span>
                  </button>
                </div>
              </div>
            )}

            {/* VARIABLES MANAGER TAB */}
            {sidebarTab === "variables" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-sans font-bold text-xs text-zinc-400 uppercase">Workflow Context Variables</h3>
                  <p className="text-[11px] text-zinc-500 mt-1">Add variables accessible by name, like {"{{my_var}}"} or {"{{global.user}}"}.</p>
                </div>

                <div className="space-y-2">
                  {variables.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
                      <div>
                        <span className="text-xs font-semibold font-mono block text-blue-600">{v.name}</span>
                        <span className="text-[10px] text-zinc-400 block truncate max-w-xs">{v.value}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveVariable(v.name)}
                        className="rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add variable input block */}
                <div className="border-t border-zinc-100 pt-4 space-y-3 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold">New Variable</h4>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Variable Name</label>
                    <input
                      type="text"
                      placeholder="e.g. log_path"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Default Value</label>
                    <input
                      type="text"
                      placeholder="e.g. ./logs/trace.txt"
                      value={newVarVal}
                      onChange={(e) => setNewVarVal(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    onClick={handleAddVariable}
                    disabled={!newVarName}
                    className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-40"
                  >
                    Add Variable
                  </button>
                </div>
              </div>
            )}

            {/* SCHEDULE TRIGGERS TAB */}
            {sidebarTab === "schedules" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-sans font-bold text-xs text-zinc-400 uppercase">Schedule Job triggers</h3>
                  <p className="text-[11px] text-zinc-500 mt-1">Configure intervals for this workflow to trigger automatically in the background.</p>
                </div>

                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
                      <div>
                        <span className="text-xs font-bold block uppercase text-purple-600">{s.schedule_type}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">Time: {s.schedule_config?.time || "default"}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveSchedule(s.id)}
                        className="rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add schedule input block */}
                <div className="border-t border-zinc-100 pt-4 space-y-3 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold">Add Scheduled Trigger</h4>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Interval Period</label>
                    <select
                      value={newSchedType}
                      onChange={(e: any) => setNewSchedType(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="hourly">Every Hour</option>
                      <option value="daily">Daily Schedule</option>
                      <option value="weekly">Weekly Schedule</option>
                      <option value="monthly">Monthly Schedule</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Trigger Time</label>
                    <input
                      type="time"
                      value={newSchedTime}
                      onChange={(e) => setNewSchedTime(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    onClick={handleAddSchedule}
                    className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Add Schedule Trigger
                  </button>
                </div>
              </div>
            )}

            {/* LIVE STREAMING LOGS TAB */}
            {sidebarTab === "logs" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-sans font-bold text-xs text-zinc-400 uppercase flex items-center space-x-1.5">
                    <Activity className={`h-4 w-4 text-green-500 ${activeRun?.status === "running" ? "animate-spin" : ""}`} />
                    <span>Orchestrator Execution Logs</span>
                  </h3>
                  {activeRun && (
                    <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                      {activeRun.status}
                    </span>
                  )}
                </div>

                {logs.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400">
                    <AlertCircle className="h-6 w-6 opacity-30 mx-auto mb-2" />
                    <p className="text-xs">No execution active or selected.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-[10px] max-h-[450px] overflow-y-auto bg-zinc-950 dark:bg-black p-3.5 rounded-lg text-zinc-300">
                    {logs.map((log) => {
                      const isError = log.level === "error";
                      const isWarn = log.level === "warn";
                      const isInfo = log.level === "info";
                      return (
                        <div key={log.id} className="border-b border-zinc-900 pb-1.5 mb-1.5">
                          <div className="flex items-center justify-between text-[8px] text-zinc-500">
                            <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                            <span className={isError ? "text-red-500" : isWarn ? "text-amber-500" : "text-green-500"}>
                              {log.level.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-0.5 leading-relaxed text-zinc-200">{log.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
