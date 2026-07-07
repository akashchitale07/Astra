import React from "react";
import { Play, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, Loader2 } from "lucide-react";

export interface PlanStep {
  id: string;
  title: string;
  action: string;
  args: Record<string, any>;
  estimatedTime: string;
  isHighRisk: boolean;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
}

interface ActionPlanProps {
  steps: PlanStep[];
  currentStepIndex: number;
  onExecuteNext: () => void;
  onExecuteAll: () => void;
  onReset: () => void;
  isAutomating: boolean;
}

export function ActionPlan({
  steps,
  currentStepIndex,
  onExecuteNext,
  onExecuteAll,
  onReset,
  isAutomating
}: ActionPlanProps) {
  if (!steps || steps.length === 0) return null;

  const activeStep = steps[currentStepIndex];
  const hasMoreSteps = currentStepIndex < steps.length;
  const isPlanCompleted = currentStepIndex >= steps.length;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">AI Computer Action Plan</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            The AI has drafted a multi-step orchestration plan to fulfill your request.
          </p>
        </div>

        <div className="flex gap-2">
          {isPlanCompleted ? (
            <button
              onClick={onReset}
              className="px-3.5 py-1.5 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold transition duration-150"
            >
              Reset Plan
            </button>
          ) : (
            <>
              <button
                onClick={onExecuteNext}
                disabled={isAutomating}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition duration-150 flex items-center gap-1"
              >
                {isAutomating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                )}
                Run Next Step
              </button>
              
              <button
                onClick={onExecuteAll}
                disabled={isAutomating}
                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 rounded-lg text-xs font-semibold transition duration-150 flex items-center gap-1.5 shadow shadow-indigo-500/10"
              >
                <Play className="h-3.5 w-3.5" />
                Run Full Sequence
              </button>
            </>
          )}
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="relative border-l border-zinc-800 pl-6 ml-3 space-y-6">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          const isUpcoming = idx > currentStepIndex;

          let stepBadgeColor = "bg-zinc-900 border-zinc-800 text-zinc-500";
          if (isCurrent) {
            stepBadgeColor = "bg-indigo-600/20 border-indigo-500 text-indigo-400 ring-4 ring-indigo-500/10";
          } else if (isDone) {
            stepBadgeColor = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
          }

          return (
            <div key={step.id} className={`relative transition-all duration-150 ${isUpcoming ? "opacity-45" : ""}`}>
              {/* Vertical Dot */}
              <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${stepBadgeColor}`}>
                {isDone ? "✓" : idx + 1}
              </div>

              <div className={`p-4 rounded-xl border transition duration-150 ${
                isCurrent 
                  ? "bg-zinc-950 border-indigo-500/40 shadow-lg shadow-indigo-500/5" 
                  : "bg-zinc-950/40 border-zinc-850"
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block">{step.title}</span>
                    <span className="text-[10px] font-mono text-indigo-300 block mt-0.5">{step.action}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* High Risk warning badge */}
                    {step.isHighRisk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                        <AlertTriangle className="h-3 w-3" />
                        High-Risk Node
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-zinc-500">
                      Est. Time: {step.estimatedTime}
                    </span>
                  </div>
                </div>

                {/* Arguments Preview */}
                {Object.keys(step.args).length > 0 && (
                  <div className="mt-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/40 text-[10px] font-mono text-zinc-400 max-h-16 overflow-y-auto">
                    {JSON.stringify(step.args, null, 2)}
                  </div>
                )}

                {/* Step Execution Logs / Output */}
                {step.output && (
                  <div className="mt-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-300 max-h-24 overflow-y-auto">
                    <div className="text-[9px] uppercase font-mono text-zinc-500 mb-1 border-b border-zinc-850 pb-1">Execution Log</div>
                    {step.output}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
