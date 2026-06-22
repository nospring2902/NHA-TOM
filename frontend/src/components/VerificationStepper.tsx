import { Check, UserPlus, Mail, Phone } from "lucide-react";

const steps = [
  { label: "Đăng ký", icon: UserPlus },
  { label: "Xác minh Gmail", icon: Mail },
];

const VerificationStepper = ({ currentStep }: { currentStep: 1 | 2 }) => {
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="w-full mb-8">
      <div className="relative">
        {/* Track */}
        <div className="absolute top-5 left-5 right-5 h-1 bg-muted rounded-full" />
        {/* Filled */}
        <div
          className="absolute top-5 left-5 h-1 gradient-ocean rounded-full transition-all duration-500"
          style={{ width: `calc((100% - 2.5rem) * ${progressPercent / 100})` }}
        />

        <div className="relative flex justify-between">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex flex-col items-center gap-2 w-24">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? "gradient-ocean border-transparent text-primary-foreground"
                      : isActive
                      ? "bg-card border-primary text-primary shadow-card"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs font-medium text-center ${
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VerificationStepper;
