"use client"

import type { ProjectState, Scene, SceneElements } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { FrameEdit } from "@/components/steps/frame-edit"
import {
  RefreshCw, Download, FileText, SlidersHorizontal,
} from "lucide-react"
import { useState, Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"

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
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null)

  // ── 플롯 단계 기반 씬 그룹핑 ──
  const stages = project.plotPlan?.stages ?? []
  const totalStages = Math.max(1, stages.length)
  const scenesPerStage = Math.ceil(project.scenes.length / totalStages)
  const startIdx = currentStageIdx * scenesPerStage
  const visibleScenes = project.scenes.slice(startIdx, startIdx + scenesPerStage)
  const currentStage = stages[currentStageIdx]
  const selectedScene = project.scenes[selectedSceneIndex]

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
    onSceneSelect(globalIndex)
    setEditingSceneIndex(globalIndex)
  }

  // ── FrameEdit 서브뷰 ──
  if (editingSceneIndex !== null) {
    return (
      <FrameEdit
        project={project}
        setProject={setProject}
        sceneIndex={editingSceneIndex}
        onComplete={() => setEditingSceneIndex(null)}
        onBack={() => setEditingSceneIndex(null)}
        onNext={onNext}
      />
    )
  }

  return (
    <div className="storyboard-root">

      {/* ── 단계 인디케이터 (도입/전개/결말) ── */}
      <div className="storyboard-indicators">
        {Array.from({ length: totalStages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStageIdx(i)}
            className={cn("page-indicator", currentStageIdx === i ? "active" : "inactive")}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* ── 다크 카드 컨테이너 ── */}
      <div className="storyboard-container">
        <div className="storyboard-scroll">
          <div className="storyboard-cards-row">
            {visibleScenes.map((scene, index) => {
              const gi = startIdx + index
              return (
                <div
                  key={scene.id}
                  onClick={() => onSceneSelect(gi)}
                  className={cn("storyboard-scene-card", selectedSceneIndex === gi && "selected")}
                >
                  {/* 카드 헤더 */}
                  <div className="scene-card-header">
                    <div className="scene-card-header-left">
                      <span className="scene-badge">S#{gi + 1}</span>
                      <span className="scene-title">{scene.title}</span>
                    </div>
                    <button
                      className="scene-header-btn"
                      onClick={(e) => handleRegenerate(scene.id, e)}
                    >
                      <RefreshCw size={14} />
                    </button>
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
                          <button className="scene-overlay-btn" onClick={(e) => handleRegenerate(scene.id, e)} title="재생성">
                            <RefreshCw size={16} />
                          </button>
                          <button className="scene-overlay-btn" onClick={(e) => handleDownload(scene, e)} title="다운로드">
                            <Download size={16} />
                          </button>
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
                  </div>

                  {/* 수정하기 */}
                  <div className="scene-card-footer">
                    <button className="scene-edit-btn" onClick={(e) => handleEdit(gi, e)}>
                      수정하기
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 하단: 현재 단계 스크립트 ── */}
      <div className="storyboard-script-section">
        <h3 className="script-title">
          {currentStageIdx + 1}. {currentStage?.label || "도입"}
        </h3>
        <p className="script-content">
          {currentStage?.content || selectedScene?.description || "씬 설명이 없습니다."}
        </p>
      </div>

      {/* ── 네비게이션 ── */}
      <div className="storyboard-nav">
        <Button variant="outline" onClick={onBack} className="storyboard-nav-btn">
          ← 이전 단계로
        </Button>
        <Button onClick={onNext} className="storyboard-nav-btn storyboard-nav-next">
          다음 단계로 →
        </Button>
      </div>
    </div>
  )
}
