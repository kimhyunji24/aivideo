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
import { MessageSquare, X, Sparkles } from "lucide-react"
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
  { id: 1, name: "아이디어", description: "영상 컨셉" },
  { id: 2, name: "플롯", description: "스토리 선택" },
  { id: 3, name: "스토리보드", description: "씬 편집" },
  { id: 4, name: "이미지", description: "씬 이미지" },
  { id: 5, name: "영상", description: "애니메이션" },
  { id: 6, name: "완성", description: "최종 결과물" },
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
      <main className="min-h-screen bg-background flex relative overflow-hidden dark">
        {/* Background gradient effects */}
        <div className="fixed inset-0 pointer-events-none">
          {/* Main gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-purple-950/20" />
          
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 pattern-dots opacity-50" />
          
          {/* Large blurred purple glow - top right */}
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]" />
          
          {/* Large blurred purple glow - bottom left */}
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[100px]" />
          
          {/* Medium glow - center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-purple-700/5 blur-[80px]" />
          
          {/* Subtle geometric shapes */}
          <div className="absolute top-20 left-[15%] w-32 h-32 border border-purple-500/10 rounded-full" />
          <div className="absolute bottom-32 right-[20%] w-24 h-24 border border-purple-400/10 rotate-45" />
          <div className="absolute top-1/3 right-[10%] w-16 h-16 border border-purple-600/10 rounded-lg rotate-12" />
        </div>

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
                "fixed top-4 z-30 h-9 w-9 transition-all duration-300 glass-button border-purple-500/20 hover:border-purple-500/40",
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
            "flex-1 flex flex-col transition-all duration-300 relative z-10",
            isChatOpen ? "ml-80" : "ml-0"
          )}
        >
          {/* Header */}
          <header className="border-b border-border/50 bg-background/60 backdrop-blur-xl sticky top-0 z-10">
            <div className="px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg glow-purple-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold">AI 팬 영상 크리에이터</h1>
                    <p className="text-[10px] text-muted-foreground">아이디어를 영상으로</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-secondary/50 backdrop-blur-sm rounded-lg p-1 border border-border/50">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={project.mode === "beginner" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-7 text-xs px-3 transition-all",
                          project.mode === "beginner" && "bg-primary text-primary-foreground shadow-md"
                        )}
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
                        className={cn(
                          "h-7 text-xs px-3 transition-all",
                          project.mode === "advanced" && "bg-primary text-primary-foreground shadow-md"
                        )}
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
          <div className="border-b border-border/50 bg-background/40 backdrop-blur-sm">
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
