"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, FileText, Box, ArrowLeft, ArrowRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FrameEdit } from "@/components/steps/frame-edit"
import type { ProjectState, SceneElements } from "@/lib/types"

type EditScene = {
  id: string | number
  title: string
  description: string
  frames?: any[]
  elements?: Partial<SceneElements>
}

type ReturnState = {
  project: ProjectState
  currentStep: number
  planPhase: "chat" | "summary" | "workspace"
  readyToMerge: boolean
  selectedSceneIndex: number
}

const ELEMENT_FIELDS = ["주제/인물", "서브 인물", "동작", "자세", "배경", "시간대", "카메라/구도", "조명/렌즈", "분위기/스타일", "서사"]
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

const DETAIL_TO_ELEMENT_KEY = {
  "주제/인물":     "mainCharacter",
  "서브 인물":     "subCharacter",
  "동작":          "action",
  "자세":          "pose",
  "배경":          "background",
  "시간대":        "time",
  "카메라/구도":   "composition",
  "조명/렌즈":     "lighting",
  "분위기/스타일": "mood",
  "서사":          "story",
} as const

function normalizeElements(input?: Partial<SceneElements> | null, description?: string): SceneElements {
  return {
    ...EMPTY_ELEMENTS,
    ...(input ?? {}),
    story: input?.story || description || "",
  }
}

function buildDetailValuesFromElements(elements?: Partial<SceneElements> | null): Record<string, string> {
  const normalized = normalizeElements(elements)
  return ELEMENT_FIELDS.reduce<Record<string, string>>((acc, field) => {
    const key = DETAIL_TO_ELEMENT_KEY[field as keyof typeof DETAIL_TO_ELEMENT_KEY]
    acc[field] = key ? normalized[key] || "" : ""
    return acc
  }, {})
}

function composeScenePrompt(elements: SceneElements, fallbackDescription: string): string {
  const chunks = [
    elements.mainCharacter,
    elements.subCharacter,
    elements.action,
    elements.pose,
    elements.background,
    elements.time,
    elements.composition,
    elements.lighting,
    elements.mood,
  ].map((v) => v?.trim()).filter(Boolean)

  const head = chunks.join(", ")
  const tail = (elements.story || fallbackDescription || "").trim()
  if (!head) return tail
  if (!tail) return head
  return `${head}. ${tail}`
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
        elements: item.elements && typeof item.elements === "object" ? item.elements : undefined,
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
      duration: 4,
      status: "pending",
      elements: normalizeElements(scene.elements, scene.description),
    })),
    mode: "beginner",
  }
}

export default function SceneEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryScenes = useMemo(() => parseScenes(searchParams.get("scenes")), [searchParams])
  const queryIndex = Number.parseInt(searchParams.get("sceneIndex") ?? "0", 10)

  const initialReturnState = loadReturnState()
  const [sessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("aivideo:sessionId")
  })
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
  const [frameIndexByScene, setFrameIndexByScene] = useState<Record<string, number>>({})
  const [isEditingFrame, setIsEditingFrame] = useState(false)

  // 세부요소 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalField, setEditModalField] = useState<string | null>(null)
  const [editModalValue, setEditModalValue] = useState("")
  const editModalTextareaRef = useRef<HTMLTextAreaElement>(null)

  const projectScenes = Array.isArray(project?.scenes) ? project.scenes : []
  const scenes = projectScenes.length > 0 ? projectScenes : queryScenes
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, scenes.length - 1)))
  const selectedScene = scenes[safeSelectedIndex]
  const selectedSceneKey = String(selectedScene?.id ?? safeSelectedIndex)
  const selectedDetail = detailByScene[selectedSceneKey] ?? buildDetailValuesFromElements(selectedScene?.elements)
  const frames = selectedScene?.frames ?? []
  const totalFrames = Math.max(1, frames.length)
  const currentFrameIndex = Math.max(
    0,
    Math.min(frameIndexByScene[selectedSceneKey] ?? 0, Math.max(0, totalFrames - 1))
  )
  const currentFrame = frames[currentFrameIndex]

  const persistAndReturn = () => {
    const nextProject: ProjectState = {
      ...project,
      scenes: (project.scenes ?? []).map((scene, index) => {
        const sceneKey = String(scene.id ?? index)
        const edited = detailByScene[sceneKey]
        if (!edited) return scene

        const mergedElements = normalizeElements({
          ...(scene.elements ?? {}),
          mainCharacter: edited["주제/인물"] ?? scene.elements?.mainCharacter ?? "",
          subCharacter: edited["서브 인물"] ?? scene.elements?.subCharacter ?? "",
          action: edited["동작"] ?? scene.elements?.action ?? "",
          pose: edited["자세"] ?? scene.elements?.pose ?? "",
          background: edited["배경"] ?? scene.elements?.background ?? "",
          time: edited["시간대"] ?? scene.elements?.time ?? "",
          composition: edited["카메라/구도"] ?? scene.elements?.composition ?? "",
          lighting: edited["조명/렌즈"] ?? scene.elements?.lighting ?? "",
          mood: edited["분위기/스타일"] ?? scene.elements?.mood ?? "",
          story: edited["서사"] ?? scene.elements?.story ?? scene.description ?? "",
        }, scene.description)

        const nextDescription = (mergedElements.story || scene.description || "").trim()
        const nextPrompt = composeScenePrompt(mergedElements, nextDescription)
        return {
          ...scene,
          elements: mergedElements,
          description: nextDescription,
          prompt: nextPrompt,
        }
      }),
    }

    const returnState: ReturnState = {
      project: nextProject,
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
        // prev에 해당 씬 키가 없으면 DEFAULT_DETAIL_VALUES(빈값) 대신
        // 씬의 실제 elements 데이터로 초기화해야 다른 세부요소가 사라지지 않음
        ...(prev[selectedSceneKey] ?? buildDetailValuesFromElements(selectedScene?.elements)),
        [field]: value,
      },
    }))
  }

  const moveFrame = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(currentFrameIndex + delta, Math.max(0, totalFrames - 1)))
    setFrameIndexByScene((prev) => {
      if ((prev[selectedSceneKey] ?? 0) === nextIndex) return prev
      return { ...prev, [selectedSceneKey]: nextIndex }
    })
  }

  const handleSelectedFrameIndexChange = useCallback((index: number) => {
    setFrameIndexByScene((prev) => {
      if ((prev[selectedSceneKey] ?? 0) === index) return prev
      return { ...prev, [selectedSceneKey]: index }
    })
  }, [selectedSceneKey])

  const openDetailModal = (field: string) => {
    setEditModalField(field)
    setEditModalValue(selectedDetail[field] ?? "")
    setEditModalOpen(true)
    // 열리면 textarea 끝으로 포커스
    setTimeout(() => editModalTextareaRef.current?.focus(), 50)
  }

  const closeDetailModal = (save: boolean) => {
    if (save && editModalField !== null) {
      handleDetailChange(editModalField, editModalValue)
    }
    setEditModalOpen(false)
    setEditModalField(null)
    setEditModalValue("")
  }

  if (isEditingFrame) {
    return (
      <main className="h-screen bg-white p-4 sm:p-6">
        <FrameEdit
          key={safeSelectedIndex}
          project={project}
          setProject={setProject}
          sceneIndex={safeSelectedIndex}
          totalScenes={scenes.length}
          onComplete={() => setIsEditingFrame(false)}
          onBack={() => {
            if (safeSelectedIndex > 0) {
              setSelectedIndex(safeSelectedIndex - 1)
            } else {
              setIsEditingFrame(false)
            }
          }}
          onNext={() => {
            if (safeSelectedIndex < scenes.length - 1) {
              setSelectedIndex(safeSelectedIndex + 1)
            } else {
              setIsEditingFrame(false)
            }
          }}
          selectedFrameIndex={currentFrameIndex}
          onSelectedFrameIndexChange={handleSelectedFrameIndexChange}
          sessionId={sessionId}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-auto bg-white text-gray-900 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">

        {/* ── 씬 콘텐츠 영역 ── */}
        <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-none">
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">

              {/* 이미지 + 프레임 */}
              <div className="space-y-3 rounded-xl border border-[#E0E0E0] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 text-xs font-semibold text-gray-700">
                      {safeSelectedIndex + 1}
                    </span>
                    <h2 className="text-base font-semibold text-gray-900">{selectedScene?.title ?? "씬 제목"}</h2>
                  </div>
                  <button
                    onClick={() => setIsEditingFrame(true)}
                    className="rounded-full border border-[#E0E0E0] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    프레임 생성/추가
                  </button>
                </div>

                {/* 이미지 영역 */}
                <div className="overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-900">
                  <div className="relative h-[200px] overflow-hidden sm:h-[300px]">
                    {currentFrame?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentFrame.imageUrl}
                        alt={`${selectedScene?.title ?? "씬"} 프레임 ${currentFrameIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-white/60">
                        프레임 {currentFrameIndex + 1} 이미지 미생성
                      </div>
                    )}
                  </div>
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <button
                    onClick={() => moveFrame(-1)}
                    disabled={currentFrameIndex === 0}
                    className="h-7 w-7 flex items-center justify-center rounded-full border border-[#E0E0E0] bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-500">{currentFrameIndex + 1} / {totalFrames}</span>
                  <button
                    onClick={() => moveFrame(1)}
                    disabled={currentFrameIndex >= totalFrames - 1}
                    className="h-7 w-7 flex items-center justify-center rounded-full border border-[#E0E0E0] bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 스크립트 */}
              <aside className="rounded-xl border border-[#E0E0E0] bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <FileText className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
                  스크립트
                </h3>
                <div className="h-[280px] rounded-xl border border-[#E0E0E0] bg-[#F5F5F5] p-3 text-xs leading-6 text-gray-600 whitespace-pre-wrap overflow-auto">
                  {selectedScene?.description || "스크립트가 없습니다."}
                </div>
              </aside>
            </div>

            {/* 세부 요소 */}
            <div className="mt-5 space-y-4 border-t border-[#E0E0E0] pt-5">
              <h3 className="text-sm font-semibold text-gray-900">세부 요소</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {ELEMENT_FIELDS.map((label) => {
                  const val = selectedDetail[label] ?? ""
                  return (
                    <div key={label} className="space-y-1">
                      <span className="text-xs text-gray-500">{label}</span>
                      <button
                        type="button"
                        onClick={() => openDetailModal(label)}
                        title={val || "(default)"}
                        className="group relative h-9 w-full rounded-xl border border-[#E0E0E0] bg-white px-3 text-left text-sm text-gray-700 outline-none hover:border-gray-400 focus:border-gray-400 transition-colors flex items-center justify-between gap-1 overflow-hidden"
                      >
                        <span className="flex-1 truncate min-w-0">
                          {val || <span className="text-gray-400">(default)</span>}
                        </span>
                        <Pencil className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 세부요소 편집 모달 */}
            <Dialog open={editModalOpen} onOpenChange={(open) => { if (!open) closeDetailModal(false) }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    {editModalField} 편집
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-1">
                  <Textarea
                    ref={editModalTextareaRef}
                    value={editModalValue}
                    onChange={(e) => setEditModalValue(e.target.value)}
                    placeholder={`${editModalField ?? ""}을(를) 입력하세요`}
                    rows={5}
                    className="resize-none rounded-xl border-[#E0E0E0] text-sm text-gray-700 focus:border-gray-400"
                    onKeyDown={(e) => {
                      // Ctrl+Enter / Cmd+Enter로 저장
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault()
                        closeDetailModal(true)
                      }
                      // Escape로 취소
                      if (e.key === "Escape") {
                        e.preventDefault()
                        closeDetailModal(false)
                      }
                    }}
                  />
                  <p className="text-xs text-gray-400">Ctrl+Enter로 저장 · Esc로 취소</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => closeDetailModal(false)}
                      className="rounded-lg text-gray-600 border-[#E0E0E0] hover:bg-gray-50">
                      취소
                    </Button>
                    <Button size="sm" onClick={() => closeDetailModal(true)}
                      className="rounded-lg bg-black text-white hover:bg-gray-800 press-down btn-unified">
                      저장
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* 사물 섹션 */}
            <div className="mt-4 space-y-3 border-t border-[#E0E0E0] pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Box className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
                사물
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {["오브젝트1", "오브젝트2"].map((label) => (
                  <label key={label} className="space-y-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      placeholder="(default)"
                      className="h-9 w-full rounded-xl border border-[#E0E0E0] bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 transition-colors"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 씬 선택 탭 ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F0F0F0] border border-[#E0E0E0] p-2">
          {scenes.length === 0 && (
            <div className="rounded-full px-4 py-2 text-xs font-semibold text-gray-400">씬 없음</div>
          )}
          {scenes.map((scene, index) => (
            <button
              key={scene.id}
              onClick={() => setSelectedIndex(index)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                index === safeSelectedIndex
                  ? "bg-white text-gray-900 shadow-sm border border-[#E0E0E0]"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              S#{index + 1} {scene.title}
            </button>
          ))}
        </div>

        {/* ── 하단 네비게이션 ── */}
        <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-0 py-3">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={persistAndReturn}
              className="rounded-lg text-gray-500 hover:text-black hover:bg-gray-100 gap-2 w-full sm:w-auto h-10 px-4 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              이전 단계로
            </Button>
            <Button
              onClick={persistAndReturn}
              className="rounded-lg text-white font-semibold px-8 h-10 gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 transition-all shadow-md press-down btn-unified"
            >
              수정 완료
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </main>
  )
}
