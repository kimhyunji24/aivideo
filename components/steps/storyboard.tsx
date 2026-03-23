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
import { CharacterRefPanel } from "@/components/steps/character-ref-panel"

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
  { left: { key: "mainCharacter", label: "주제/인물" },  right: { key: "subCharacter",  label: "서브 인물" } },
  { left: { key: "action",        label: "동작" },        right: { key: "pose",          label: "자세" } },
  { left: { key: "background",    label: "배경" },        right: { key: "time",          label: "시간대" } },
  { left: { key: "composition",   label: "카메라/구도" },  right: { key: "lighting",      label: "조명/렌즈" } },
  { left: { key: "mood",          label: "분위기/스타일" }, right: { key: "story",         label: "서사" } },
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
    try {
      sessionStorage.setItem("aivideo:return-state", JSON.stringify(returnState))
    } catch (err) {
      console.error("Failed to persist return state for edit page", err)
    }
    // scenes 전체를 querystring으로 넘기면 URL이 과도하게 길어져 라우팅/렌더링이 깨질 수 있다.
    router.push(`/edit?sceneIndex=${globalIndex}`)
  }

  const hasCharacters = (project.characters ?? []).length > 0

  return (
    <div className="storyboard-root bg-white h-full flex flex-col">

      {/* ── 콘텐츠 영역: 캐릭터 레퍼런스 사이드바 + 스토리보드 ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* 캐릭터 레퍼런스 사이드바 */}
        {hasCharacters && (
          <div className="w-[260px] flex-shrink-0 overflow-y-auto border-r border-gray-100">
            <CharacterRefPanel
              project={project}
              setProject={setProject}
              sessionId={sessionId}
            />
          </div>
        )}

        {/* 스토리보드 본문 */}
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
                        <div className="scene-overlay-buttons" />
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

        {/* 스토리보드 본문 div 닫힘 */}
        </div>

      {/* flex-1 flex overflow-hidden (콘텐츠+사이드바 행) 닫힘 */}
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
