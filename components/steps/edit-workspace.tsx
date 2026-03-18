"use client"

import { useCallback, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, ArrowLeft } from "lucide-react"
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
    <div className="h-full overflow-auto bg-[#f6f6f6] text-[#141414] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">2. 시각화</h1>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[#f2f2f2]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            수정 완료
          </button>
        </div>

        <section className="rounded-2xl border border-[#d5d5d5] bg-[#f8f8f8] px-3 py-3 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3 rounded-xl border border-[#dedede] bg-white p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{selectedScene.title}</h2>
                <button
                  onClick={() => setIsEditingFrame(true)}
                  className="rounded-full border border-[#dadada] bg-white px-3 py-1 text-xs font-medium"
                >
                  프레임 생성/추가
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#d8d8d8] bg-gradient-to-br from-[#1e232d] via-[#2a2f39] to-[#15181f] p-4">
                <div className="relative h-[200px] overflow-hidden rounded bg-black/30 sm:h-[320px]">
                  {currentFrame?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentFrame.imageUrl}
                      alt={`${selectedScene.title} 프레임 ${currentFrameIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-white/65">
                      프레임 {currentFrameIndex + 1} 이미지 미생성
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 text-sm text-[#555]">
                <button
                  onClick={() => moveFrame(-1)}
                  disabled={currentFrameIndex === 0}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#d8d8d8] bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>{currentFrameIndex + 1} / {totalFrames}</span>
                <button
                  onClick={() => moveFrame(1)}
                  disabled={currentFrameIndex >= totalFrames - 1}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#d8d8d8] bg-white"
                >
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
                {fixedSceneScript}
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
            {project.scenes.length === 0 && (
              <div className="rounded-full bg-[#111] px-3 py-2 ring-1 ring-white/30">S#1 씬 없음</div>
            )}
            {project.scenes.map((scene, index) => (
              <button
                key={scene.id}
                onClick={() => onSceneSelect(index)}
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
    </div>
  )
}
