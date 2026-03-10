"use client"

import { useState } from "react"
import { IdeaInput } from "@/components/steps/idea-input"
import { PlotSelection } from "@/components/steps/plot-selection"
import { Storyboard } from "@/components/steps/storyboard"
import { ImageGeneration } from "@/components/steps/image-generation"
import { VideoGeneration } from "@/components/steps/video-generation"
import { FinalMerge } from "@/components/steps/final-merge"
import { WorkflowProgress } from "@/components/workflow-progress"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export interface Scene {
  id: string
  title: string
  description: string
  prompt: string
  imageUrl?: string
  videoUrl?: string
  duration: number
  status: "pending" | "generating" | "done" | "error"
}

export interface Plot {
  id: string
  title: string
  summary: string
  tone: string
  scenes: Scene[]
}

export interface ProjectState {
  idea: string
  generatedPlots: Plot[]
  selectedPlot: Plot | null
  scenes: Scene[]
  mode: "beginner" | "advanced"
}

const STEPS = [
  { id: 1, name: "Idea Input", description: "Describe your video concept" },
  { id: 2, name: "Plot Selection", description: "Choose or customize your story" },
  { id: 3, name: "Storyboard", description: "Review and edit scenes" },
  { id: 4, name: "Image Generation", description: "Generate scene images" },
  { id: 5, name: "Video Generation", description: "Animate your scenes" },
  { id: 6, name: "Final Merge", description: "Combine and export" },
]

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1)
  const [project, setProject] = useState<ProjectState>({
    idea: "",
    generatedPlots: [],
    selectedPlot: null,
    scenes: [],
    mode: "beginner",
  })

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 6) {
      setCurrentStep(step)
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <IdeaInput
            project={project}
            setProject={setProject}
            onNext={() => goToStep(2)}
          />
        )
      case 2:
        return (
          <PlotSelection
            project={project}
            setProject={setProject}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )
      case 3:
        return (
          <Storyboard
            project={project}
            setProject={setProject}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )
      case 4:
        return (
          <ImageGeneration
            project={project}
            setProject={setProject}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
          />
        )
      case 5:
        return (
          <VideoGeneration
            project={project}
            setProject={setProject}
            onNext={() => goToStep(6)}
            onBack={() => goToStep(4)}
          />
        )
      case 6:
        return (
          <FinalMerge
            project={project}
            setProject={setProject}
            onBack={() => goToStep(5)}
            onRestart={() => {
              setProject({
                idea: "",
                generatedPlots: [],
                selectedPlot: null,
                scenes: [],
                mode: "beginner",
              })
              setCurrentStep(1)
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentStep > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToStep(currentStep - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <h1 className="text-lg font-semibold">AI Fan Video Creator</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Mode:</span>
              <Button
                variant={project.mode === "beginner" ? "default" : "outline"}
                size="sm"
                onClick={() => setProject({ ...project, mode: "beginner" })}
              >
                Beginner
              </Button>
              <Button
                variant={project.mode === "advanced" ? "default" : "outline"}
                size="sm"
                onClick={() => setProject({ ...project, mode: "advanced" })}
              >
                Advanced
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <WorkflowProgress
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={goToStep}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {renderCurrentStep()}
      </div>
    </main>
  )
}
