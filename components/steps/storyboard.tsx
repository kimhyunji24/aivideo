"use client"

import type { ProjectState, Scene, SceneElements } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  RefreshCw, Download, FileText, SlidersHorizontal, Box, Check
} from "lucide-react"
import { Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

// ── Props ─────────────────────────────────────────────────────────────────────

interface StoryboardProps {
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  onNext: () => void
  onBack: () => void
  selectedSceneIndex: number
  onSceneSelect: (i: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DETAIL_ROWS: { left: { key: keyof SceneElements; label: string }; right: { key: keyof SceneElements; label: string } }[] = [
  { left: { key: "mainCharacter", label: "주제" },  right: { key: "story",       label: "품질" } },
  { left: { key: "action",       label: "동작" },  right: { key: "lighting",     label: "조명" } },
  { left: { key: "background",   label: "배경" },  right: { key: "pose",         label: "영글" } },
  { left: { key: "composition",  label: "렌즈" },  right: { key: "subCharacter", label: "날짜" } },
  { left: { key: "mood",         label: "색감" },  right: { key: "time",         label: "시간" } },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function getElementValue(elements: SceneElements, key: keyof SceneElements): string {
  return elements[key] || "(value)"
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Storyboard({
  project, setProject, onNext, onBack, selectedSceneIndex, onSceneSelect,
}: StoryboardProps) {
  const router = useRouter()

  const selectedScene = project.scenes[selectedSceneIndex]

  // ── 씬 선택 및 스크롤 포커싱 ──
  const handleSceneSelect = (index: number) => {
    onSceneSelect(index)
    // 약간의 딜레이 후 해당 씬 카드로 스크롤 이동
    setTimeout(() => {
      const cardId = `scene-card-${index}`
      const element = document.getElementById(cardId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }, 50)
  }

  // ── 이미지 재생성 ──
  const handleRegenerate = async (sceneId: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId ? { ...s, status: "generating" as const } : s
      ),
    }))
    try {
      const res = await fetch(`/api/generate-image?id=${sceneId}`, { method: "POST" })
      if (res.ok) {
        const interval = setInterval(async () => {
          try {
            const sr = await fetch(`/api/status/${sceneId}`)
            if (sr.ok) {
              const updated = await sr.json()
              setProject(prev => ({
                ...prev,
                scenes: prev.scenes.map(s => (s.id === sceneId ? updated : s)),
              }))
              if (updated.status === "done" || updated.status === "error") clearInterval(interval)
            }
          } catch { clearInterval(interval) }
        }, 2000)
      }
    } catch { /* silently fail */ }
  }

  // ── 이미지 다운로드 ──
  const handleDownload = (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!scene.imageUrl) return
    const a = document.createElement("a")
    a.href = scene.imageUrl
    a.download = `${scene.title}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ── 수정하기 ──
  const handleEdit = (globalIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    handleSceneSelect(globalIndex)
    const returnState = {
      project,
      currentStep: 2,
      planPhase: "workspace" as const,
      readyToMerge: false,
      selectedSceneIndex: globalIndex,
    }
    sessionStorage.setItem("aivideo:return-state", JSON.stringify(returnState))

    const scenesPayload = project.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      description: scene.description,
    }))
    const params = new URLSearchParams({
      sceneIndex: String(globalIndex),
      scenes: JSON.stringify(scenesPayload),
    })
    router.push(`/edit?${params.toString()}`)
  }

  return (
    <div className="storyboard-root bg-white h-full flex flex-col">
      {/* ── 상단: 타이틀 및 탭 ── */}
      <div className="flex-shrink-0 border-b border-[#E0E0E0] bg-white">
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-[1440px] mx-auto w-full">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">2. 시각화</h1>
          <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-[#E0E0E0] w-full sm:w-auto">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-[#F0F0F0] hover:bg-[#E8E8E8] rounded-l-md"
            >
              기획
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-black"
            >
              시각화
            </button>
            <button
              type="button"
              onClick={onNext}
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-[#F0F0F0] hover:bg-[#E8E8E8] rounded-r-md"
            >
              영상화
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
        {/* ── 개별 씬 인디케이터 (1, 2, 3...) ── */}
        <div className="storyboard-indicators mb-6">
          {project.scenes.map((scene, i) => {
            const isCompleted = !!scene.imageUrl;
            return (
              <button
                key={i}
                onClick={() => handleSceneSelect(i)}
                className={cn("page-indicator flex items-center justify-center shrink-0 transition-all", 
                  selectedSceneIndex === i 
                    ? "bg-black text-white w-10 h-10 rounded-full shadow-md" 
                    : "bg-white text-gray-800 border border-gray-300 w-10 h-10 rounded-full hover:border-gray-500"
                )}
              >
                {isCompleted && selectedSceneIndex !== i ? <Check size={16} /> : (i + 1)}
              </button>
            )
          })}
        </div>

      {/* ── 다크 카드 컨테이너 ── */}
      <div className="storyboard-container">
        <div className="storyboard-scroll">
          <div className="storyboard-cards-row">
            {project.scenes.map((scene, index) => {
              return (
                <div
                  key={scene.id}
                  id={`scene-card-${index}`}
                  onClick={() => handleSceneSelect(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const assetId = e.dataTransfer.getData("assetId")
                    if (assetId) {
                      setProject((prev) => ({
                        ...prev,
                        scenes: prev.scenes.map((s) => (s.id === scene.id ? { ...s, pinnedAsset: assetId } : s)),
                      }))
                    }
                  }}
                  className={cn("storyboard-scene-card", selectedSceneIndex === index && "selected")}
                >
                  {/* 카드 헤더 */}
                  <div className="scene-card-header">
                    <div className="scene-card-header-left">
                      <span className="scene-badge">S#{index + 1}</span>
                      <span className="scene-title">{scene.title}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="scene-header-btn"
                          onClick={(e) => handleRegenerate(scene.id, e)}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>전체 재생성</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* 카드 스크롤 영역 */}
                  <div className="scene-card-body">
                    {/* 이미지 + 호버 오버레이 */}
                    <div className="scene-image-wrapper">
                      {scene.imageUrl ? (
                        <img src={scene.imageUrl} alt={scene.title} className="scene-image" />
                      ) : (
                        <div className="scene-image-placeholder">
                          <span>이미지 미생성</span>
                        </div>
                      )}
                      <div className="scene-image-overlay">
                        <div className="scene-overlay-buttons">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button className="scene-overlay-btn" onClick={(e) => handleRegenerate(scene.id, e)}>
                                <RefreshCw size={16} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">이미지 재생성</TooltipContent>
                          </Tooltip>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button className="scene-overlay-btn" onClick={(e) => handleDownload(scene, e)}>
                                <Download size={16} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">이미지 다운로드</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* 스크립트 */}
                    <div className="scene-section">
                      <div className="scene-section-label">
                        <FileText size={12} />
                        <span>스크립트</span>
                      </div>
                      <p className="scene-description">{scene.description}</p>

                      {/* 캐릭터 아바타 */}
                      {project.characters && project.characters.length > 0 && (
                        <div className="scene-characters">
                          {project.characters.slice(0, 3).map(c => (
                            <div key={c.id} className="scene-avatar">
                              {c.imageUrl
                                ? <img src={c.imageUrl} alt={c.name} />
                                : c.name.charAt(0)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 세부 요소 */}
                    <div className="scene-section scene-details">
                      <div className="scene-section-label">
                        <SlidersHorizontal size={12} />
                        <span>세부 요소</span>
                      </div>
                      <div className="scene-detail-grid">
                        {DETAIL_ROWS.map(row => (
                          <div key={row.left.key} className="scene-detail-row">
                            <span className="scene-detail-item">
                              <span className="detail-label">{row.left.label}:</span>
                              <span className="detail-value">{getElementValue(scene.elements, row.left.key)}</span>
                            </span>
                            <span className="scene-detail-item">
                              <span className="detail-label">{row.right.label}:</span>
                              <span className="detail-value">{getElementValue(scene.elements, row.right.key)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 사물 */}
                    <div className="scene-section scene-audio border-t border-gray-100 mt-2 pt-2">
                      <div className="scene-section-label">
                        <Box size={12} />
                        <span>사물</span>
                      </div>
                      <div className="scene-audio-content space-y-1 mt-2">
                        {project.characters && project.characters.length > 0 ? (
                           project.characters.slice(0, 3).map(c => (
                             <div key={c.id} className="scene-detail-item">
                               <span className="detail-label w-12 flex-shrink-0 text-gray-800 font-medium">{c.name || "인물"}:</span>
                               <span className="detail-value text-gray-600">{"세부적인"}</span>
                             </div>
                           ))
                        ) : (
                          <>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0 text-gray-800 font-medium">잭:</span><span className="detail-value text-gray-600">{"세부적인"}</span></div>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0 text-gray-800 font-medium">엘라:</span><span className="detail-value text-gray-600">{"세부적인"}</span></div>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0 text-gray-800 font-medium">벤:</span><span className="detail-value text-gray-600">{"세부적인"}</span></div>
                          </>
                        )}
                        <div className="scene-detail-item mt-2"><span className="detail-label w-12 flex-shrink-0 text-gray-800 font-medium">효과음:</span><span className="detail-value text-gray-600">{"{value}"}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* 수정하기 */}
                  <div className="scene-card-footer">
                    <button className="scene-edit-btn" onClick={(e) => handleEdit(index, e)}>
                      수정하기
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
