import { STEPS, StepNumber } from "../../utils/types";

interface SidebarProps {
  currentStep: StepNumber;
  maxStepReached: StepNumber;
  onSelectStep: (step: StepNumber) => void;
  finalStepComplete?: boolean;
}

export default function Sidebar({
  currentStep,
  maxStepReached,
  onSelectStep,
  finalStepComplete = false,
}: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Progress
      </p>
      <ol className="mt-4 space-y-1">
        {STEPS.map((step) => {
          const isJustCompleted = step.number === 5 && finalStepComplete;
          const isActive = step.number === currentStep && !isJustCompleted;
          const isComplete = step.number < currentStep || isJustCompleted;
          const isReachable = step.number <= maxStepReached;

          return (
            <li key={step.number}>
              <button
                type="button"
                onClick={() => isReachable && onSelectStep(step.number as StepNumber)}
                disabled={!isReachable}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : isComplete
                      ? "text-slate-500 hover:bg-slate-50"
                      : isReachable
                        ? "text-slate-500 hover:bg-slate-50"
                        : "cursor-not-allowed text-slate-400"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isComplete
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isComplete ? "✓" : step.number}
                </span>
                <div className="min-w-0">
                  <p className="truncate">{step.label}</p>
                  <p className="text-[11px] text-slate-400">
                    Step {step.number} of {STEPS.length}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
