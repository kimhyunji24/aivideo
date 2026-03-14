"use client"

import { useState } from "react"
import { IdeaInput } from "@/components/steps/idea-input"
import { PlotSelection } from "@/components/steps/plot-selection"
import { Storyboard } from "@/components/steps/storyboard"
import { VideoGeneration } from "@/components/steps/video-generation"
import { FinalMerge } from "@/components/steps/final-merge"
import { WorkflowProgress } from "@/components/workflow-progress"
import { AssetLibrary } from "@/components/asset-library"
import { AIChatPanel } from "@/components/ai-chat-panel"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles, PanelLeftClose, PanelLeftOpen, MessageSquare } from "lucide-react"

import type { ProjectState } from "@/lib/types"

const STEPS = [
  { id: 1, name: "기획",  description: "아이디어 & 플롯" },
  { id: 2, name: "제작",  description: "스토리보드 & 이미지" },
  { id: 3, name: "영상",  description: "애니메이션 & 완성" },
]

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1)
  const [readyToMerge, setReadyToMerge] = useState(false)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0)
  const [assetPanelOpen, setAssetPanelOpen] = useState(true)
  const [chatPanelOpen, setChatPanelOpen] = useState(true)

  const [project, setProject] = useState<ProjectState>({
    idea: "",
    generatedPlots: [],
    selectedPlot: null,
    scenes: [],
    mode: "beginner",
  })

  const pinnedAssets = project.scenes.reduce<Record<string | number, string>>((acc, s) => {
    if (s.pinnedAsset) acc[s.id] = s.pinnedAsset
    return acc
  }, {})

  const handleAssetDrop = (assetId: string, sceneId: string | number) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, pinnedAsset: assetId } : s)),
    }))
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 3) setCurrentStep(step)
  }

  const showPanels = currentStep >= 2

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return project.idea && project.generatedPlots.length > 0 ? (
          <PlotSelection
            project={project}
            setProject={setProject}
            onNext={() => goToStep(2)}
            onBack={() => setProject({ ...project, idea: "" })}
          />
        ) : (
          <IdeaInput project={project} setProject={setProject} onNext={() => {}} />
        )

      case 2:
        return (
          <Storyboard
            project={project}
            setProject={setProject}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
            selectedSceneIndex={selectedSceneIndex}
            onSceneSelect={setSelectedSceneIndex}
          />
        )

      case 3: {
        const scenesWithImages = project.scenes.filter((s) => s.imageUrl)
        const autoAllDone = scenesWithImages.length > 0 && scenesWithImages.every((s) => s.videoUrl)
        const showFinalMerge = readyToMerge || autoAllDone

        if (showFinalMerge) {
          return (
            <FinalMerge
              project={project}
              setProject={setProject}
              onBack={() => setReadyToMerge(false)}
              onRestart={() => {
                setReadyToMerge(false)
                setProject({ idea: "", generatedPlots: [], selectedPlot: null, scenes: [], mode: "beginner" })
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
    <main className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-20 left-[30%] w-64 h-64 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-[20%] w-96 h-96 rounded-full bg-purple-700/5 blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl z-20 flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI Video Studio</h1>
              <p className="text-[10px] text-muted-foreground">아이디어를 영상으로</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Panel toggles (step 2+) */}
            {showPanels && (
              <div className="flex items-center gap-1 mr-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setAssetPanelOpen((v) => !v)}>
                      {assetPanelOpen
                        ? <PanelLeftClose className="h-3.5 w-3.5" />
                        : <PanelLeftOpen  className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{assetPanelOpen ? "에셋 패널 닫기" : "에셋 패널 열기"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setChatPanelOpen((v) => !v)}>
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{chatPanelOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {(["beginner", "advanced"] as const).map((m) => (
                <Tooltip key={m}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={project.mode === m ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 text-xs px-3"
                      onClick={() => setProject({ ...project, mode: m })}
                    >
                      {m === "beginner" ? "초보자" : "전문가"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {m === "beginner" ? "가이드 중심 · Double Prompting" : "10대 요소 직접 편집 · 파라미터 제어"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Progress ── */}
      <div className="border-b border-border/50 bg-background/60 backdrop-blur-sm flex-shrink-0">
        <div className="px-4 py-2.5">
          <WorkflowProgress steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
        </div>
      </div>

      {/* ── 3-panel body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Asset library */}
        {showPanels && assetPanelOpen && (
          <div className="w-48 flex-shrink-0 border-r border-border/50 overflow-hidden">
            <AssetLibrary onDrop={handleAssetDrop} pinnedAssets={pinnedAssets} />
          </div>
        )}

        {/* Center: Main content */}
        <div className="flex-1 overflow-auto px-5 py-5 min-w-0">
          {renderCurrentStep()}
        </div>

        {/* Right: AI Chat */}
        {showPanels && chatPanelOpen && (
          <div className="w-64 flex-shrink-0 overflow-hidden">
            <AIChatPanel
              project={project}
              setProject={setProject}
              currentSceneIndex={selectedSceneIndex}
            />
          </div>
        )}
      </div>
    </main>
  )
}
