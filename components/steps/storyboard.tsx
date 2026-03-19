"use client"

import type { ProjectState, Scene, SceneElements } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  RefreshCw, Download, FileText, SlidersHorizontal, Box, Check, ArrowRight, ArrowLeft, Pin, X
} from "lucide-react"
import { Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { ASSETS } from "@/lib/constants"

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
  { left: { key: "mainCharacter", label: "주제" },  right: { key: "quality",       label: "품질" } },
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
  const handleRemoveAsset = (sceneId: string | number, assetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => {
        if (s.id !== sceneId) return s
        return {
          ...s,
          pinnedAssets: (s.pinnedAssets || []).filter(id => id !== assetId)
        }
      }),
    }))
  }

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
                        scenes: prev.scenes.map((s) => {
                          if (s.id !== scene.id) return s
                          const currentPins = s.pinnedAssets || []
                          if (currentPins.includes(assetId)) return s
                          return { ...s, pinnedAssets: [...currentPins, assetId] }
                        }),
                      }))
                    }
                  }}
                  className={cn("storyboard-scene-card", selectedSceneIndex === index && "selected")}
                >
                  <div className="scene-card-header">
                    <div className="scene-card-header-left flex items-center gap-2">
                       <div className="flex items-center gap-2">
                         <span className="scene-badge">S#{index + 1}</span>
                         <span className="scene-title">{scene.title}</span>
                       </div>
                       <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 max-w-[200px] sm:max-w-[300px]">
                         {scene.pinnedAssets?.map((pinnedId) => {
                           const pinnedAssetItem = ASSETS.find(a => a.id === pinnedId);
                           if (!pinnedAssetItem) return null;
                           const customImg = project.customAssets?.[pinnedId]?.imageUrl;
                           return (
                             <div 
                               key={pinnedId} 
                               className="group/pin flex items-center gap-1.5 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded-md flex-shrink-0 cursor-default"
                             >
                               {customImg ? (
                                 <img src={customImg} alt={pinnedAssetItem.label} className="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0" />
                               ) : (
                                 <pinnedAssetItem.icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
                               )}
                               <span className="text-[10px] font-medium text-gray-600 truncate max-w-[60px]">
                                 {pinnedAssetItem.label}
                                </span>
                               <button 
                                 onClick={(e) => handleRemoveAsset(scene.id, pinnedId, e)}
                                 className="opacity-0 group-hover/pin:opacity-100 ml-0.5 hover:text-indigo-900 transition-opacity"
                                >
                                 <X size={10} />
                               </button>
                             </div>
                           );
                         })}
                       </div>
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
                               <span className="detail-label w-12 flex-shrink-0">{c.name || "인물"}:</span>
                               <span className="detail-value">{"세부적인"}</span>
                             </div>
                           ))
                        ) : (
                          <>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0">사물1:</span><span className="detail-value">{"설명"}</span></div>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0">사물2:</span><span className="detail-value">{"설명"}</span></div>
                             <div className="scene-detail-item"><span className="detail-label w-12 flex-shrink-0">사물3:</span><span className="detail-value">{"설명"}</span></div>
                          </>
                        )}
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

      {/* flex-1 overflow-auto (B) 닫힘 */}
      </div>

      {/* ── 하단 네비게이션 ── */}
      <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-5xl mx-auto flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="rounded-lg text-gray-500 hover:text-black hover:bg-gray-100 gap-2 w-full sm:w-auto h-10 px-4 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            이전 단계로
          </Button>
          <Button
            onClick={onNext}
            className="rounded-lg text-white font-semibold px-8 h-10 gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 transition-all shadow-md press-down btn-unified"
          >
            다음 단계로
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* storyboard-root (A) 닫힘 */}
    </div>
  )
}
