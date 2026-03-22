"use client"

import type { ProjectState, Scene, SceneElements } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  RefreshCw, Download, FileText, SlidersHorizontal, Box, Check, ArrowRight, ArrowLeft, Pin, Video, Image as ImageIcon
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
  sessionId?: string | null
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
  project, setProject, onNext, onBack, selectedSceneIndex, onSceneSelect, sessionId,
}: StoryboardProps) {
  const router = useRouter()
  const apiBase = sessionId
    ? `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}/generation`
    : null

  const selectedScene = project.scenes[selectedSceneIndex]

  const resolvePlayableVideoUrl = (sceneId: string | number, videoUrl?: string): string | undefined => {
    if (!videoUrl || !videoUrl.trim()) return undefined
    if (!apiBase) return videoUrl.trim()
    return `${apiBase}/videos/${encodeURIComponent(String(sceneId))}/preview`
  }

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

  // ── 시작 프레임 이미지 생성 ──
  const handleGenerateStartFrame = async (sceneId: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sessionId) return
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: "generating" as const } : s),
    }))
    try {
      const scene = project.scenes.find(s => s.id === sceneId)
      const currentFrame = scene?.frames?.[0]
      const res = await fetch(
        `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}/generation/frames/${encodeURIComponent(String(sceneId))}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameId: currentFrame?.id,
            script: currentFrame?.script || scene?.description || scene?.prompt || "",
          }),
        }
      )
      if (res.ok) {
        const generatedFrame = await res.json()
        setProject(prev => {
          const updatedScenes = prev.scenes.map(s => {
            if (s.id !== sceneId) return s
            const existingFrames = s.frames ?? []
            const newFrames = [...existingFrames]
            if (newFrames.length === 0) newFrames.push(generatedFrame)
            else newFrames[0] = { ...newFrames[0], ...generatedFrame }
            return { ...s, status: "completed" as const, frames: newFrames, imageUrl: generatedFrame.imageUrl }
          })
          const updatedProject = { ...prev, scenes: updatedScenes }
          fetch(`http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedProject)
          }).catch(console.error)
          return updatedProject
        })
      } else {
        setProject(prev => ({ ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: "error" as const } : s) }))
      }
    } catch {
      setProject(prev => ({ ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: "error" as const } : s) }))
    }
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
      elements: scene.elements,
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
            const sceneThumbnail = scene.frames?.[0]?.imageUrl || scene.imageUrl;
            const isCompleted = !!sceneThumbnail;
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
              const sceneThumbnail = scene.frames?.[0]?.imageUrl || scene.imageUrl
              return (
                <div
                  key={scene.id}
                  id={`scene-card-${index}`}
                  onClick={() => handleSceneSelect(index)}
                  className={cn("storyboard-scene-card", selectedSceneIndex === index && "selected")}
                >
                  <div className="scene-card-header">
                    <div className="scene-card-header-left flex items-center gap-2">
                       <div className="flex items-center gap-2">
                         <span className="scene-badge">S#{index + 1}</span>
                         <span className="scene-title">{scene.title}</span>
                       </div>
                    </div>
                  </div>

                  {/* 카드 스크롤 영역 */}
                  <div className="scene-card-body">
                    {/* 미디어(비디오 혹은 이미지) + 호버 오버레이 */}
                    <div className="scene-image-wrapper">
                      {scene.status === "generating_video" ? (
                        <div className="scene-image-placeholder">
                          <span>비디오 생성 중...</span>
                        </div>
                      ) : scene.videoUrl ? (
                        <video
                          src={resolvePlayableVideoUrl(scene.id, scene.videoUrl)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="scene-image"
                        />
                      ) : sceneThumbnail ? (
                        <img src={sceneThumbnail} alt={scene.title} className="scene-image" />
                      ) : (
                        <div className="scene-image-placeholder">
                          <span>이미지 미생성</span>
                        </div>
                      )}
                      <div className="scene-image-overlay">
                        <div className="scene-overlay-buttons">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button 
                                className="scene-overlay-btn" 
                                onClick={(e) => handleGenerateStartFrame(scene.id, e)}
                                disabled={scene.status === "generating"}
                              >
                                {scene.status === "generating" ? (
                                  <RefreshCw size={16} className="animate-spin text-gray-500" />
                                ) : (
                                  <ImageIcon size={16} />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {scene.status === "generating" ? "프레임 생성 중..." : "이미지 생성"}
                            </TooltipContent>
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
                    <button 
                      className="scene-edit-btn disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" 
                      onClick={(e) => {
                        if (scene.status === "generating") return;
                        handleEdit(index, e);
                      }}
                      disabled={scene.status === "generating"}
                    >
                      {scene.status === "generating" ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" /> 이미지 생성 중...</>
                      ) : "수정하기"}
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
