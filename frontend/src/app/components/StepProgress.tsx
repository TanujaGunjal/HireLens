interface StepProgressProps {
  currentStep: number;
}

const steps = [
  { id: 1, label: "Upload Resume" },
  { id: 2, label: "Add Job" },
  { id: 3, label: "View Results" },
];

export default function StepProgress({ currentStep }: StepProgressProps) {
  const safeStep = Math.min(3, Math.max(1, currentStep));

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = step.id < safeStep;
          const isActive = step.id === safeStep;
          const isInactive = step.id > safeStep;

          const circleClass = isCompleted
            ? "bg-blue-700 border-blue-700 text-white"
            : isActive
            ? "bg-blue-600 border-blue-600 text-white"
            : "bg-gray-100 border-gray-300 text-gray-500";

          const lineClass =
            step.id < safeStep ? "bg-blue-600" : "bg-gray-200";

          return (
            <div key={step.id} className="flex-1 min-w-0">
              <div className="flex items-center">
                <div
                  className={`h-8 w-8 shrink-0 rounded-full border-2 text-xs font-semibold flex items-center justify-center transition-colors ${circleClass}`}
                >
                  {step.id}
                </div>

                {index < steps.length - 1 && (
                  <div className="mx-2 h-0.5 flex-1 rounded">
                    <div className={`h-full w-full rounded ${lineClass}`} />
                  </div>
                )}
              </div>

              <p
                className={`mt-2 text-xs sm:text-sm font-medium ${
                  isInactive ? "text-gray-500" : "text-gray-900"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
