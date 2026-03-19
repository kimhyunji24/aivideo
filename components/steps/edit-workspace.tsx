"use client"

import { useCallback, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FrameEdit } from "@/components/steps/frame-edit"
import type { ProjectState } from "@/lib/types"

interface EditWorkspaceProps {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  selectedSceneIndex: number
  onSceneSelect: (index: number) => void
  onClose: () => void
}

const ELEMENT_FIELDS = ["주제", "동작", "배경", "비율", "색감", "조명", "구도", "날씨", "시간"]
const DEFAULT_DETAIL_VALUES = ELEMENT_FIELDS.reduce<Record<string, string>>((acc, field) => {
  acc[field] = ""
  return acc
}, {})

export function EditWorkspace({
  project,
  setProject,
  selectedSceneIndex,
  onSceneSelect,
  onClose,
}: EditWorkspaceProps) {
  const [detailByScene, setDetailByScene] = useState<Record<string, Record<string, string>>>({})
  const [frameIndexByScene, setFrameIndexByScene] = useState<Record<string, number>>({})
  const [isEditingFrame, setIsEditingFrame] = useState(false)

  const safeSelectedIndex = Math.max(0, Math.min(selectedSceneIndex, Math.max(0, project.scenes.length - 1)))
  const selectedScene = project.scenes[safeSelectedIndex]
  if (!selectedScene) return null

  const selectedSceneKey = String(selectedScene.id)
  const selectedDetail = detailByScene[selectedSceneKey] ?? DEFAULT_DETAIL_VALUES
  const frames = selectedScene.frames ?? []
  const totalFrames = Math.max(1, frames.length)
  const currentFrameIndex = Math.max(
    0,
    Math.min(frameIndexByScene[selectedSceneKey] ?? 0, Math.max(0, totalFrames - 1))
  )
  const currentFrame = frames[currentFrameIndex]
  const fixedSceneScript = selectedScene.description || "스크립트가 없습니다."

  const handleDetailChange = (field: string, value: string) => {
    setDetailByScene((prev) => ({
      ...prev,
      [selectedSceneKey]: {
        ...(prev[selectedSceneKey] ?? DEFAULT_DETAIL_VALUES),
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

  if (isEditingFrame) {
    return (
      <div className="h-full bg-white p-4 sm:p-6">
        <FrameEdit
          project={project}
          setProject={setProject}
          sceneIndex={safeSelectedIndex}
          onComplete={() => setIsEditingFrame(false)}
          onBack={() => setIsEditingFrame(false)}
          onNext={() => setIsEditingFrame(false)}
          selectedFrameIndex={currentFrameIndex}
          onSelectedFrameIndexChange={handleSelectedFrameIndexChange}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-white text-gray-900 px-4 py-6 sm:px-6 sm:py-8">
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
                    <h2 className="text-base font-semibold text-gray-900">{selectedScene.title}</h2>
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
                        alt={`${selectedScene.title} 프레임 ${currentFrameIndex + 1}`}
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
                  {fixedSceneScript}
                </div>
              </aside>
            </div>

            {/* 세부 요소 */}
            <div className="mt-5 space-y-4 border-t border-[#E0E0E0] pt-5">
              <h3 className="text-sm font-semibold text-gray-900">세부 요소</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {ELEMENT_FIELDS.map((label) => (
                  <label key={label} className="space-y-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      value={selectedDetail[label] ?? ""}
                      onChange={(e) => handleDetailChange(label, e.target.value)}
                      placeholder="(default)"
                      className="h-9 w-full rounded-xl border border-[#E0E0E0] bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 transition-colors"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* 사물 섹션 */}
            <div className="mt-4 space-y-3 border-t border-[#E0E0E0] pt-4">
              <h3 className="text-sm font-semibold text-gray-900">사물</h3>
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
          {project.scenes.map((scene, index) => (
            <button
              key={scene.id}
              onClick={() => onSceneSelect(index)}
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

        {/* ── 하단 네비게이션 (기획 페이지와 동일) ── */}
        <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-0 py-3">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={onClose}
              className="rounded-lg text-gray-500 hover:text-black hover:bg-gray-100 gap-2 w-full sm:w-auto h-10 px-4 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              이전 단계로
            </Button>
            <Button
              onClick={onClose}
              className="rounded-lg text-white font-semibold px-8 h-10 gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 transition-all shadow-md press-down btn-unified"
            >
              수정 완료
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
