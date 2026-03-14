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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles } from "lucide-react"

import type { Scene, Plot, ProjectState } from "@/lib/types"

const STEPS = [
  { id: 1, name: "기획", description: "아이디어 & 플롯" },
  { id: 2, name: "제작", description: "스토리보드 & 이미지" },
  { id: 3, name: "영상", description: "애니메이션 & 완성" },
]

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1)
  const [readyToMerge, setReadyToMerge] = useState(false)
  const [project, setProject] = useState<ProjectState>({
    idea: "",
    generatedPlots: [],
    selectedPlot: null,
    scenes: [],
    mode: "beginner",
  })

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 3) {
      setCurrentStep(step)
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        // 플롯이 생성된 이후에는 선택 여부와 무관하게 플롯 선택 화면을 유지
        return project.idea && project.generatedPlots.length > 0 ? (
          <PlotSelection
            project={project}
            setProject={setProject}
            onNext={() => goToStep(2)}
            onBack={() => setProject({ ...project, idea: "" })}
          />
        ) : (
          <IdeaInput
            project={project}
            setProject={setProject}
            onNext={() => {
              // PlotSelection으로 넘어가기 위해 상태 유지
            }}
          />
        )
      case 2:
        // 스토리보드와 이미지 생성 통합
        return (
          <Storyboard
            project={project}
            setProject={setProject}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )
      case 3: {
        // 영상 생성과 최종 병합 통합
        const scenesWithImages = project.scenes.filter(s => s.imageUrl)
        const autoAllDone = scenesWithImages.length > 0 && scenesWithImages.every(s => s.videoUrl)
        const showFinalMerge = readyToMerge || autoAllDone

        if (showFinalMerge) {
          return (
            <FinalMerge
              project={project}
              setProject={setProject}
              onBack={() => setReadyToMerge(false)}
              onRestart={() => {
                setReadyToMerge(false)
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
        }

        return (
          <VideoGeneration
            project={project}
            setProject={setProject}
            onNext={() => setReadyToMerge(true)}
            onBack={() => goToStep(2)}
          />
        )
      }
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-background flex relative">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pattern-dots pointer-events-none" />

      {/* Background accent shapes */}
      <div className="fixed top-20 left-[30%] w-64 h-64 rounded-full bg-muted/30 blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-[20%] w-96 h-96 rounded-full bg-muted/20 blur-3xl pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-background" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold">AI 팬 영상 크리에이터</h1>
                  <p className="text-[10px] text-muted-foreground">아이디어를 영상으로</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={project.mode === "beginner" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setProject({ ...project, mode: "beginner" })}
                    >
                      초보자
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>간단하고 안내된 경험</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={project.mode === "advanced" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setProject({ ...project, mode: "advanced" })}
                    >
                      고급
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>프롬프트 및 설정 직접 제어</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </header>

        {/* Progress */}
        <div className="border-b bg-background/60 backdrop-blur-sm">
          <div className="px-6 py-3">
            <WorkflowProgress
              steps={STEPS}
              currentStep={currentStep}
              onStepClick={goToStep}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 py-6 overflow-auto">
          {renderCurrentStep()}
        </div>
      </div>
    </main>
  )
}
