"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, FileText, ArrowLeft } from "lucide-react"
import { FrameEdit } from "@/components/steps/frame-edit"
import type { ProjectState } from "@/lib/types"

type EditScene = {
  id: string | number
  title: string
  description: string
}

type ReturnState = {
  project: ProjectState
  currentStep: number
  planPhase: "chat" | "summary" | "workspace"
  readyToMerge: boolean
  selectedSceneIndex: number
}

const ELEMENT_FIELDS = ["주제", "동작", "배경", "비율", "색감", "조명", "구도", "날씨", "시간"]
const DEFAULT_DETAIL_VALUES = ELEMENT_FIELDS.reduce<Record<string, string>>((acc, field) => {
  acc[field] = ""
  return acc
}, {})
const EMPTY_ELEMENTS = {
  mainCharacter: "",
  subCharacter: "",
  action: "",
  pose: "",
  background: "",
  time: "",
  composition: "",
  lighting: "",
  mood: "",
  story: "",
}

function parseScenes(raw: string | null): EditScene[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.title === "string")
      .map((item, index) => ({
        id: item.id ?? index,
        title: item.title,
        description: typeof item.description === "string" ? item.description : "",
      }))
  } catch {
    return []
  }
}

function loadReturnState(): ReturnState | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem("aivideo:return-state")
  if (!raw) return null
  try {
    return JSON.parse(raw) as ReturnState
  } catch {
    return null
  }
}

function buildFallbackProject(scenes: EditScene[]): ProjectState {
  return {
    idea: "",
    logline: "",
    characters: [],
    plotPlan: null,
    generatedPlots: [],
    selectedPlot: null,
    scenes: scenes.map((scene, index) => ({
      id: scene.id,
      title: scene.title,
      description: scene.description,
      prompt: scene.description,
      duration: 3,
      status: "pending",
      elements: { ...EMPTY_ELEMENTS, story: scene.description },
    })),
    mode: "beginner",
  }
}

export default function EditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryScenes = useMemo(() => parseScenes(searchParams.get("scenes")), [searchParams])
  const queryIndex = Number.parseInt(searchParams.get("sceneIndex") ?? "0", 10)

  const initialReturnState = loadReturnState()
  const [project, setProject] = useState<ProjectState>(
    initialReturnState?.project ?? buildFallbackProject(queryScenes)
  )
  const [planPhase, setPlanPhase] = useState<"chat" | "summary" | "workspace">(initialReturnState?.planPhase ?? "workspace")
  const [readyToMerge, setReadyToMerge] = useState(Boolean(initialReturnState?.readyToMerge))
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (typeof initialReturnState?.selectedSceneIndex === "number") return initialReturnState.selectedSceneIndex
    return Number.isNaN(queryIndex) ? 0 : queryIndex
  })
  const [detailByScene, setDetailByScene] = useState<Record<string, Record<string, string>>>({})
  const [isEditingFrame, setIsEditingFrame] = useState(false)

  const scenes = project.scenes.length > 0 ? project.scenes : queryScenes
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, scenes.length - 1)))
  const selectedScene = scenes[safeSelectedIndex]
  const selectedSceneKey = String(selectedScene?.id ?? safeSelectedIndex)
  const selectedDetail = detailByScene[selectedSceneKey] ?? DEFAULT_DETAIL_VALUES

  const persistAndReturn = () => {
    const returnState: ReturnState = {
      project,
      currentStep: 2,
      planPhase,
      readyToMerge,
      selectedSceneIndex: safeSelectedIndex,
    }
    sessionStorage.setItem("aivideo:return-state", JSON.stringify(returnState))
    router.push("/?restore=1")
  }

  const handleDetailChange = (field: string, value: string) => {
    setDetailByScene((prev) => ({
      ...prev,
      [selectedSceneKey]: {
        ...(prev[selectedSceneKey] ?? DEFAULT_DETAIL_VALUES),
        [field]: value,
      },
    }))
  }

  if (isEditingFrame) {
    return (
      <main className="h-screen bg-white p-4 sm:p-6">
        <FrameEdit
          project={project}
          setProject={setProject}
          sceneIndex={safeSelectedIndex}
          onComplete={() => setIsEditingFrame(false)}
          onBack={() => setIsEditingFrame(false)}
          onNext={() => setIsEditingFrame(false)}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6] text-[#141414] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">2. 시각화</h1>
          <button
            onClick={persistAndReturn}
            className="inline-flex items-center gap-1 rounded-full border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[#f2f2f2]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            이전 화면
          </button>
        </div>

        <div className="flex items-center gap-3">
          {[1, 2, 3].map((step, index) => (
            <div
              key={step}
              className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold ${
                index === 0 ? "border-black bg-black text-white" : "border-[#c9c9c9] bg-white text-[#666]"
              }`}
            >
              {step}
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-[#d5d5d5] bg-[#f8f8f8] px-3 py-3 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3 rounded-xl border border-[#dedede] bg-white p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{selectedScene?.title ?? "씬 제목"}</h2>
                <button
                  onClick={() => setIsEditingFrame(true)}
                  className="rounded-full border border-[#dadada] bg-white px-3 py-1 text-xs font-medium"
                >
                  프레임 생성/추가
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#d8d8d8] bg-gradient-to-br from-[#1e232d] via-[#2a2f39] to-[#15181f] p-4">
                <div className="h-[200px] rounded bg-black/30 sm:h-[320px]" />
              </div>
              <div className="flex items-center justify-center gap-4 text-sm text-[#555]">
                <button className="grid h-7 w-7 place-items-center rounded-full border border-[#d8d8d8] bg-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>1 / 4</span>
                <button className="grid h-7 w-7 place-items-center rounded-full border border-[#d8d8d8] bg-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <aside className="rounded-xl border border-[#dedede] bg-white p-3">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                스크립트
              </h3>
              <div className="h-[320px] rounded-lg border border-[#e1e1e1] bg-[#fcfcfc] p-3 text-xs leading-5 text-[#555] whitespace-pre-wrap">
                {selectedScene?.description || "스크립트가 없습니다."}
              </div>
            </aside>
          </div>

          <div className="mt-5 space-y-5 border-t border-[#dcdcdc] pt-5">
            <div>
              <h3 className="mb-3 text-sm font-semibold">세부 요소</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {ELEMENT_FIELDS.map((label) => (
                  <label key={label} className="space-y-1">
                    <span className="text-xs text-[#666]">{label}</span>
                    <input
                      value={selectedDetail[label] ?? ""}
                      onChange={(e) => handleDetailChange(label, e.target.value)}
                      placeholder="(default)"
                      className="h-9 w-full rounded-xl border border-[#dfdfdf] bg-[#fafafa] px-3 text-sm text-[#555] outline-none focus:border-[#bfbfbf]"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-black p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-white sm:grid-cols-2 lg:grid-cols-4">
            {scenes.length === 0 && (
              <div className="rounded-full bg-[#111] px-3 py-2 ring-1 ring-white/30">S#1 씬 없음</div>
            )}
            {scenes.map((scene, index) => (
              <button
                key={scene.id}
                onClick={() => setSelectedIndex(index)}
                className={`rounded-full px-3 py-2 text-left ${
                  index === safeSelectedIndex ? "bg-white text-black" : "bg-[#111] text-white ring-1 ring-white/30"
                }`}
              >
                {`S#${index + 1} ${scene.title}`}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
