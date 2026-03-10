"use client"

import { useState } from "react"
import { IdeaInput } from "@/components/steps/idea-input"
import { PlotSelection } from "@/components/steps/plot-selection"
import { Storyboard } from "@/components/steps/storyboard"
import { ImageGeneration } from "@/components/steps/image-generation"
import { VideoGeneration } from "@/components/steps/video-generation"
import { FinalMerge } from "@/components/steps/final-merge"
import { WorkflowProgress } from "@/components/workflow-progress"
import { AIChatPanel } from "@/components/ai-chat-panel"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"

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
  sceneCount: number
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
  { id: 1, name: "아이디어 입력", description: "영상 컨셉 설명" },
  { id: 2, name: "플롯 선택", description: "스토리 선택 또는 커스텀" },
  { id: 3, name: "스토리보드", description: "씬 검토 및 편집" },
  { id: 4, name: "이미지 생성", description: "씬별 이미지 생성" },
  { id: 5, name: "영상 생성", description: "이미지 애니메이션" },
  { id: 6, name: "최종 병합", description: "영상 합치기 및 내보내기" },
]

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isChatOpen, setIsChatOpen] = useState(true)
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
    <TooltipProvider delayDuration={300}>
      <main className="min-h-screen bg-muted/30 flex">
        {/* Left: AI Chat Panel */}
        <div
          className={cn(
            "fixed left-0 top-0 h-full z-20 transition-all duration-300",
            isChatOpen ? "w-80" : "w-0"
          )}
        >
          {isChatOpen && <AIChatPanel className="w-80" />}
        </div>

        {/* Chat Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "fixed top-4 z-30 h-8 w-8 transition-all duration-300",
                isChatOpen ? "left-[328px]" : "left-4"
              )}
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              {isChatOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isChatOpen ? "채팅 닫기" : "AI 어시스턴트 열기"}
          </TooltipContent>
        </Tooltip>

        {/* Main Content Area */}
        <div
          className={cn(
            "flex-1 flex flex-col transition-all duration-300",
            isChatOpen ? "ml-80" : "ml-0"
          )}
        >
          {/* Header */}
          <header className="border-b bg-background sticky top-0 z-10">
            <div className="px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToStep(currentStep - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>이전 단계</TooltipContent>
                    </Tooltip>
                  )}
                  <h1 className="text-base font-semibold">AI 팬 영상 크리에이터</h1>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">모드:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={project.mode === "beginner" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
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
                        variant={project.mode === "advanced" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
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
          <div className="border-b bg-background">
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
    </TooltipProvider>
  )
}
