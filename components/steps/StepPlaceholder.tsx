import { STEPS, StepNumber } from "../../utils/types";

interface StepPlaceholderProps {
  step: StepNumber;
  onBack: () => void;
}

export default function StepPlaceholder({ step, onBack }: StepPlaceholderProps) {
  const label = STEPS.find((s) => s.number === step)?.label ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold text-slate-900">
        Step {step}: {label}
      </h2>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
        <p className="text-sm text-slate-500">
          This step&apos;s UI is coming in a later phase.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to Step 1
        </button>
      </div>
    </div>
  );
}
