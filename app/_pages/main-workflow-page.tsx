"use client"

import { useEffect, useState } from "react"
import { IdeaChat } from "@/components/steps/idea-chat"
import { PlanningWorkspace } from "@/components/steps/planning-workspace"
import { Storyboard } from "@/components/steps/storyboard"
import { VideoGeneration } from "@/components/steps/video-generation"
import { FinalMerge } from "@/components/steps/final-merge"
import { WorkflowProgress } from "@/components/workflow-progress"
import { AssetLibrary } from "@/components/asset-library"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Clapperboard, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSearchParams } from "next/navigation"

import type { ProjectState, Scene } from "@/lib/types"
import { createSession } from "@/lib/api"

type ReturnState = {
  project: ProjectState
  currentStep: number
  planPhase: "chat" | "summary" | "workspace"
  readyToMerge: boolean
  selectedSceneIndex: number
}

const STEPS = [
  { id: 1, name: "기획", description: "로그라인 & 플롯" },
  { id: 2, name: "시각화", description: "스토리보드 & 이미지" },
  { id: 3, name: "영상", description: "애니메이션 & 완성" },
]

/** Convert planning workspace result into scenes for the storyboard */
function buildScenesFromPlan(project: ProjectState): Scene[] {
  const { plotPlan, characters, logline } = project
  if (!plotPlan) return []

  const mainCharName = characters?.[0]?.name ?? ""
  const subCharName = characters?.[1]?.name ?? ""

  return plotPlan.stages.map((stage, i) => ({
    id: `scene-${i + 1}`,
    title: stage.label,
    description: stage.content,
    prompt: stage.content,
    duration: 3,
    status: "pending" as const,
    elements: {
      mainCharacter: mainCharName,
      subCharacter: subCharName,
      action: "",
      pose: "",
      background: "",
      time: "",
      composition: "",
      lighting: "",
      mood: "",
      story: stage.content,
    },
  }))
}

export default function MainWorkflowPage() {
  const searchParams = useSearchParams()
  const stepParam = Number.parseInt(searchParams.get("step") ?? "1", 10)
  const initialStep = Number.isNaN(stepParam) ? 1 : Math.min(3, Math.max(1, stepParam))
  const shouldRestore = searchParams.get("restore") === "1"
  // "chat" -> "summary" -> "workspace" -> step 2, 3
  const [planPhase, setPlanPhase] = useState<"chat" | "summary" | "workspace">("chat")
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [readyToMerge, setReadyToMerge] = useState(false)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0)
  const [assetPanelOpen, setAssetPanelOpen] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)


  const [project, setProject] = useState<ProjectState>({
    idea: "",
    logline: "",
    characters: [],
    plotPlan: null,
    generatedPlots: [],
    selectedPlot: null,
    scenes: [],
    mode: "beginner",
  })

  useEffect(() => {
    if (!shouldRestore) return
    const raw = sessionStorage.getItem("aivideo:return-state")
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as ReturnState
      if (parsed?.project) {
        setProject(parsed.project)
        setCurrentStep(parsed.currentStep ?? 2)
        setPlanPhase(parsed.planPhase ?? "workspace")
        setReadyToMerge(Boolean(parsed.readyToMerge))
        setSelectedSceneIndex(parsed.selectedSceneIndex ?? 0)
      }
    } catch {
      // ignore invalid stored data
    } finally {
      sessionStorage.removeItem("aivideo:return-state")
    }
  }, [shouldRestore])


  const pinnedAssets = project.scenes.reduce<Record<string | number, string[]>>((acc, s) => {
    if (s.pinnedAssets && s.pinnedAssets.length > 0) acc[s.id] = s.pinnedAssets

    return acc
  }, {})

  const handleAssetDrop = (assetId: string, sceneId: string | number) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => {
        if (s.id !== sceneId) return s
        const currentPins = s.pinnedAssets || []
        if (currentPins.includes(assetId)) return s
        return { ...s, pinnedAssets: [...currentPins, assetId] }
      }),
    }))
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 3) setCurrentStep(step)
  }

  /** Called when user finishes planning workspace → move to storyboard */
  const handlePlanningDone = () => {
    const scenes = buildScenesFromPlan(project)
    setProject((prev) => ({ ...prev, scenes }))
    setCurrentStep(2)
  }

  const showPanels = currentStep >= 2

  const renderContent = () => {
    // Step 1: Planning
    if (currentStep === 1) {
      if (planPhase !== "workspace") {
        return (
          <IdeaChat
            project={project}
            setProject={setProject}
            initialView={planPhase}
            onNext={() => setPlanPhase("workspace")}
            sessionId={sessionId}
          />
        )
      }
      return (
        <PlanningWorkspace
          project={project}
          setProject={setProject}
          onNext={handlePlanningDone}
          onBack={() => setPlanPhase("summary")}
        />
      )
    }

    // Step 2
    if (currentStep === 2) {
      return (
        <Storyboard
          project={project}
          setProject={setProject}
          onNext={() => goToStep(3)}
          onBack={() => {
            setPlanPhase("workspace")
            goToStep(1)
          }}
          selectedSceneIndex={selectedSceneIndex}
          onSceneSelect={setSelectedSceneIndex}
        />
      )
    }

    // Step 3
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
            setPlanPhase("chat")
            setProject({
              idea: "",
              logline: "",
              characters: [],
              plotPlan: null,
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

  // Step 1 planning workspace needs the 3-panel layout with sidebars inside the component itself
  const isWorkspaceStep = currentStep === 1 && planPhase === "workspace"

  return (
    <main className="h-screen bg-white flex flex-col overflow-hidden min-h-0">
      {/* ── Header: 반응형 패딩·타이포 ── */}
      <header className="border-b border-[#E5E7EB] bg-white z-20 flex-shrink-0">
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2 max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-black flex items-center justify-center shrink-0 shadow-lg hover-lift">
              <Clapperboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-gray-900 truncate">
                사이트명
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">아이디어를 영상으로</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Panel toggles (step 2+): 목업 스타일 — 회색 아이콘, rounded-lg 호버 */}
            {showPanels && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      onClick={() => setAssetPanelOpen((v) => !v)}
                    >
                      {assetPanelOpen ? (
                        <PanelLeftClose className="h-4 w-4" />
                      ) : (
                        <PanelLeftOpen className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{assetPanelOpen ? "에셋 패널 닫기" : "에셋 패널 열기"}</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Mode toggle: sm 이상에서만 풀 레이블, 작은 화면에서도 터치 가능 */}
            <div className="flex items-center rounded-lg p-1 bg-gray-100 border border-gray-200">
              {(["beginner", "advanced"] as const).map((m) => (
                <Tooltip key={m}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 rounded-md text-xs font-medium px-2 sm:px-3 transition-colors ${project.mode === m
                          ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                          : "text-gray-600 hover:text-gray-900"
                        }`}
                      onClick={() => setProject({ ...project, mode: m })}
                    >
                      {m === "beginner" ? "초보자" : "전문가"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {m === "beginner"
                      ? "가이드 중심 · Double Prompting"
                      : "10대 요소 직접 편집 · 파라미터 제어"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Progress: 반응형 패딩 ── */}
      <div className="border-b border-[#E5E7EB] bg-white flex-shrink-0">
        <div className="px-4 py-2 sm:px-6 sm:py-3 max-w-[1440px] mx-auto w-full">
          <WorkflowProgress steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
        </div>
      </div>

      {/* ── Body: md 이하에서는 사이드 패널 숨김, 본문만 전체 너비 ── */}
      {isWorkspaceStep ? (
        <div className="flex-1 overflow-hidden bg-white min-h-0">
          {renderContent()}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden bg-white justify-center">
          <div className="flex flex-1 min-h-0 max-w-[1440px] w-full flex-col lg:flex-row">
            {showPanels && assetPanelOpen && (
              <div className="hidden lg:flex w-52 flex-shrink-0 border-r border-[#E5E7EB] overflow-hidden bg-white">
                <AssetLibrary onDrop={handleAssetDrop} pinnedAssets={pinnedAssets} project={project} setProject={setProject} onClose={() => setAssetPanelOpen(false)} />
              </div>
            )}

            <div className="flex-1 overflow-hidden min-w-0">
              {renderContent()}
            </div>


          </div>
        </div>
      )}
    </main>
  )
}
