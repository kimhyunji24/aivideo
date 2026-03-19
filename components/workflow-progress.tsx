"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Step {
  id: number
  name: string
  description: string
}

interface WorkflowProgressProps {
  steps: Step[]
  currentStep: number
  onStepClick: (step: number) => void
}

export function WorkflowProgress({ steps, currentStep, onStepClick }: WorkflowProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Desktop view */}
      <div className="hidden md:flex items-center justify-center">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isClickable = step.id <= currentStep

          return (
            <div key={step.id} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => isClickable && onStepClick(step.id)}
                    disabled={!isClickable}
                    className={cn(
                      "flex items-center gap-2 group",
                      isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors",
                        isCompleted && "bg-black border-black text-white",
                        isCurrent && "border-black text-black step-glow",
                        !isCompleted && !isCurrent && "border-gray-300 text-gray-400"
                      )}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-xs font-medium",
                        isCurrent && "text-black font-semibold",
                        !isCurrent && !isCompleted && "text-gray-400"
                      )}>
                        {step.name}
                      </p>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{step.description}</TooltipContent>
              </Tooltip>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-12 lg:w-24 h-px mx-4",
                  isCompleted ? "bg-black" : "bg-gray-200"
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">
            단계 {currentStep} / {steps.length}
          </span>
          <span className="text-xs text-muted-foreground">
            {steps[currentStep - 1]?.name}
          </span>
        </div>
        <div className="flex gap-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "h-1 flex-1 rounded-full",
                step.id < currentStep && "bg-foreground",
                step.id === currentStep && "bg-foreground/50",
                step.id > currentStep && "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
