"use client"

import { useEffect, useState } from "react"
import { IdeaChat } from "@/components/steps/idea-chat"
import { PlanningWorkspace } from "@/components/steps/planning-workspace"
import { Storyboard } from "@/components/steps/storyboard"
import { VideoGeneration } from "@/components/steps/video-generation"
import { FinalMerge } from "@/components/steps/final-merge"
import { WorkflowProgress } from "@/components/workflow-progress"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Clapperboard } from "lucide-react"
import { useSearchParams } from "next/navigation"

import type { ProjectState, Scene } from "@/lib/types"
import { createSession, updateSession } from "@/lib/api"

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

const DEFAULT_ELEMENTS = {
  mainCharacter: "주인공",
  subCharacter: "조력자 1인",
  action: "주변을 천천히 살피며 이동한다",
  pose: "자연스럽고 안정적인 자세",
  background: "현실적인 도심 배경",
  time: "늦은 오후",
  composition: "미디엄 샷 중심의 안정적 구도",
  lighting: "부드러운 자연광",
  mood: "차분하지만 기대감 있는 분위기",
  story: "작은 단서를 통해 다음 장면으로 이어지는 흐름",
}

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
      ...DEFAULT_ELEMENTS,
      ...stage.elements,
      mainCharacter: stage.elements?.mainCharacter || mainCharName || DEFAULT_ELEMENTS.mainCharacter,
      subCharacter: stage.elements?.subCharacter || subCharName || DEFAULT_ELEMENTS.subCharacter,
      story: stage.elements?.story || stage.content || DEFAULT_ELEMENTS.story,
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
    const initSession = async () => {
      try {
        let sid = sessionStorage.getItem("aivideo:sessionId")
        if (sid) {
          try {
            const { getSession } = await import("@/lib/api")
            await getSession(sid)
          } catch {
            sid = null
          }
        }
        if (!sid) {
          sid = await createSession()
          sessionStorage.setItem("aivideo:sessionId", sid)
        }
        setSessionId(sid)
      } catch (err) {
        console.error("Failed to create session", err)
        alert("CRITICAL ERROR: Failed to create session! Check if backend is running on 8080. " + err)
      }
    }
    void initSession()
  }, [])

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

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 3) setCurrentStep(step)
  }

  /** Called when user finishes planning workspace → move to storyboard */
  const handlePlanningDone = async () => {
    const scenes = buildScenesFromPlan(project)
    const updatedProject = { ...project, scenes }
    setProject(updatedProject)
    // 씬 목록을 Redis에 동기화 — 이미지 생성 시 백엔드에서 씬을 찾을 수 있도록
    if (sessionId) {
      try {
        await updateSession(sessionId, updatedProject)
      } catch (e) {
        console.error("씬 동기화 실패", e)
      }
    }
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
          sessionId={sessionId}
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
          sessionId={sessionId}
        />
      )
    }

    // Step 3
    const showFinalMerge = readyToMerge

    if (showFinalMerge) {
      return (
        <FinalMerge
          project={project}
          setProject={setProject}
          sessionId={sessionId}
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
        sessionId={sessionId}
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
                가중치 - AI 2차 창작 비디오 서비스
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">아이디어를 영상으로</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">


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
        <div className="flex flex-1 min-h-0 overflow-y-auto bg-white justify-center">
          <div className="flex flex-1 min-h-0 max-w-[1440px] w-full flex-col lg:flex-row">
            <div className="flex-1 overflow-y-auto min-w-0">
              {renderContent()}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
