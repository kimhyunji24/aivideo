"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, Edit3, Image as ImageIcon, Sparkles, Loader2, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, Frame } from "@/lib/types"

interface FrameEditProps {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  sceneIndex: number
  onComplete: () => void
  onBack: () => void
  onNext: () => void
  selectedFrameIndex?: number
  onSelectedFrameIndexChange?: (index: number) => void
  sessionId?: string | null
}

export function FrameEdit({
  project,
  setProject,
  sceneIndex,
  onComplete,
  onBack,
  onNext,
  selectedFrameIndex: selectedFrameIndexProp = 0,
  onSelectedFrameIndexChange,
  sessionId,
}: FrameEditProps) {
  const scene = project.scenes[sceneIndex]
  if (!scene) return null

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(selectedFrameIndexProp)
  const [isGenerating, setIsGenerating] = useState(false)
  const frames = scene.frames ?? []
  const safeSelectedFrameIndex =
    frames.length === 0 ? 0 : Math.max(0, Math.min(selectedFrameIndex, frames.length - 1))
  const currentFrame = frames[safeSelectedFrameIndex]
  const isMiddleFrame =
    frames.length >= 3 && safeSelectedFrameIndex > 0 && safeSelectedFrameIndex < frames.length - 1
  const startGenerated = Boolean(frames[0]?.imageUrl?.trim())
  const endGenerated = Boolean(frames[frames.length - 1]?.imageUrl?.trim())
  const canGenerateCurrentFrame = !isMiddleFrame || (startGenerated && endGenerated)

  useEffect(() => {
    setSelectedFrameIndex(selectedFrameIndexProp)
  }, [selectedFrameIndexProp])

  useEffect(() => {
    if (frames.length === 0) {
      const defaultFrames: Frame[] = [
        { id: `f-${Date.now()}`, script: scene.description || "", imageUrl: scene.imageUrl },
      ]
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => (i === sceneIndex ? { ...s, frames: defaultFrames } : s)),
      }))
    }
  }, [frames.length, scene.description, scene.imageUrl, sceneIndex, setProject])

  useEffect(() => {
    if (safeSelectedFrameIndex !== selectedFrameIndex) {
      setSelectedFrameIndex(safeSelectedFrameIndex)
    }
  }, [safeSelectedFrameIndex, selectedFrameIndex])

  const syncSelectedFrameIndex = (nextIndex: number) => {
    setSelectedFrameIndex(nextIndex)
    onSelectedFrameIndexChange?.(nextIndex)
  }

  const resolveSessionId = () => {
    if (sessionId && sessionId.trim()) return sessionId
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("aivideo:sessionId")
  }

  const updateFrameScript = (script: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const existingFrames = s.frames ?? []
        if (existingFrames.length === 0) return s
        const newFrames = [...existingFrames]
        newFrames[safeSelectedFrameIndex] = { ...newFrames[safeSelectedFrameIndex], script }
        return { ...s, frames: newFrames }
      }),
    }))
  }

  // ── Drag and Drop Handlers ──
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnter = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }

    setProject(prev => {
      const newScenes = [...prev.scenes]
      const currentScene = newScenes[sceneIndex]
      if (!currentScene.frames) return prev
      
      const newFrames = [...currentScene.frames]
      const [moved] = newFrames.splice(draggedIdx, 1)
      newFrames.splice(targetIdx, 0, moved)
      
      newScenes[sceneIndex] = { ...currentScene, frames: newFrames }
      
      if (safeSelectedFrameIndex === draggedIdx) {
        syncSelectedFrameIndex(targetIdx)
      } else if (safeSelectedFrameIndex > draggedIdx && safeSelectedFrameIndex <= targetIdx) {
        syncSelectedFrameIndex(safeSelectedFrameIndex - 1)
      } else if (safeSelectedFrameIndex < draggedIdx && safeSelectedFrameIndex >= targetIdx) {
        syncSelectedFrameIndex(safeSelectedFrameIndex + 1)
      }
      
      return { ...prev, scenes: newScenes }
    })
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleAddFrame = () => {
    if (frames.length >= 4) return
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const existingFrames = s.frames ?? []
        const seedScript = s.description?.trim() || s.prompt?.trim() || ""
        const newFrames = [
          ...existingFrames,
          { id: `f-${Date.now()}-${existingFrames.length + 1}`, script: seedScript, imageUrl: undefined },
        ]
        return { ...s, frames: newFrames }
      }),
    }))
    syncSelectedFrameIndex(frames.length)
  }

  const handleRemoveFrame = (idx: number) => {
    if (frames.length <= 1) return
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const existingFrames = s.frames ?? []
        if (existingFrames.length <= 1) return s
        const newFrames = [...existingFrames]
        newFrames.splice(idx, 1)
        return { ...s, frames: newFrames }
      }),
    }))
    if (selectedFrameIndex >= frames.length - 1) {
      syncSelectedFrameIndex(Math.max(0, frames.length - 2))
    }
  }

  const handleGenerateFrame = async () => {
    if (!currentFrame) return
    if (!canGenerateCurrentFrame) {
      alert("프레임이 3개 이상이면 Start/End 프레임 이미지를 먼저 생성해야 합니다.")
      return
    }
    const script = currentFrame.script?.trim() || scene.description?.trim() || scene.prompt?.trim() || ""
    if (!script) {
      alert("프레임 생성에 사용할 스크립트가 없습니다. 스크립트를 입력해 주세요.")
      return
    }

    let sid = resolveSessionId()
    if (!sid) {
      const createRes = await fetch("http://localhost:8080/api/v1/sessions", { method: "POST" })
      if (!createRes.ok) {
        alert("세션 생성에 실패해 프레임 이미지를 만들 수 없습니다.")
        return
      }

      sid = (await createRes.text()).replace(/"/g, "").trim()
      if (typeof window !== "undefined") {
        sessionStorage.setItem("aivideo:sessionId", sid)
      }
    }

    // Always ensure the latest edited script and frames are saved to the backend before generating image
    try {
      await fetch("http://localhost:8080/api/v1/sessions/" + encodeURIComponent(sid), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
    } catch(e) {
      console.warn("Failed to sync project state before generating frame", e)
    }

    setIsGenerating(true)
    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sid)}/generation/frames/${encodeURIComponent(String(scene.id ?? sceneIndex))}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameId: currentFrame.id,
            script: script || undefined,
          }),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "")
        throw new Error(errorBody || `HTTP ${response.status}`)
      }

      const generatedFrame = (await response.json()) as Frame

      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => {
          if (i !== sceneIndex) return s
          const existingFrames = s.frames ?? []
          if (existingFrames.length === 0) {
            return { ...s, frames: [generatedFrame] }
          }

          const nextFrames = [...existingFrames]
          const frameIndex = nextFrames.findIndex((f) => f.id === generatedFrame.id)
          const indexToUpdate = frameIndex >= 0 ? frameIndex : safeSelectedFrameIndex
          nextFrames[indexToUpdate] = {
            ...nextFrames[indexToUpdate],
            ...generatedFrame,
            script:
              nextFrames[indexToUpdate].script ||
              generatedFrame.script ||
              script ||
              scene.description ||
              scene.prompt ||
              "",
          }
          return { ...s, frames: nextFrames }
        }),
      }))
    } catch (error) {
      console.error("Frame generation error:", error)
      alert("프레임 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleComplete = () => {
    if (frames.length === 1) {
      const confirmProceed = window.confirm(
        "시작(start)과 끝(end) 프레임 없이 1개의 프레임만으로 영상 제작 시, 원하는 결과가 나오지 않을 수 있습니다.\n\n그래도 완료하시겠습니까?"
      )
      if (!confirmProceed) return
    }
    onComplete()
  }

  if (!currentFrame) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-sm text-muted-foreground">
        프레임을 준비하는 중입니다...
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 text-sm font-semibold rounded-full">
            S#{sceneIndex + 1}
          </Badge>
          <h2 className="text-xl font-bold">{scene.title}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleComplete}
          className="gap-2 px-4 shadow-sm border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-black rounded-lg press-down"
        >
          <Edit3 className="h-4 w-4" />
          수정 완료
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        <Card className="col-span-1 lg:col-span-8 flex flex-col border-border/60 shadow-sm glass-card">
          <div className="relative flex-1 min-h-[220px] max-h-[420px] bg-black/5 flex items-center justify-center p-4">
            {currentFrame.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentFrame.imageUrl}
                alt={`Frame ${safeSelectedFrameIndex + 1}`}
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-black/5 transition-colors rounded-lg group">
                <ImageIcon className="w-16 h-16 mb-2 opacity-50 group-hover:opacity-80 transition-opacity text-gray-500" />
                <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700">여기를 클릭하여 이미지 업로드</p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const url = URL.createObjectURL(file)
                      setProject((prev) => ({
                        ...prev,
                        scenes: prev.scenes.map((s, i) => {
                          if (i !== sceneIndex || !s.frames) return s
                          const newFrames = [...s.frames]
                          newFrames[safeSelectedFrameIndex] = { ...newFrames[safeSelectedFrameIndex], imageUrl: url }
                          return { ...s, frames: newFrames }
                        })
                      }))
                    }
                  }}
                />
              </label>
            )}
            <div className="absolute top-6 left-6">
              <Badge className="bg-black/70 hover:bg-black/70 text-white backdrop-blur-md border-0 gap-1.5 py-1.5 px-3">
                <Edit3 className="h-3.5 w-3.5" />
                {safeSelectedFrameIndex === 0 ? "Start Frame" : `Frame ${safeSelectedFrameIndex + 1}`} 편집 중
              </Badge>
            </div>
          </div>

          <div className="p-4 bg-white border-t">
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="frame-flow" className="rounded border-gray-300 text-black h-3 w-3 focus:ring-black" defaultChecked />
              <label htmlFor="frame-flow" className="text-xs font-semibold text-gray-700 tracking-wide">프레임 흐름 (최대 4개)</label>
            </div>

            <div className="flex items-center gap-4">
              {frames.map((frame, idx) => (
                <div 
                  key={frame.id} 
                  className={cn("flex items-center gap-4 flex-1 relative group transition-all", dragOverIdx === idx ? "opacity-40 scale-95" : "")}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    onClick={() => syncSelectedFrameIndex(idx)}
                    className={cn(
                      "relative aspect-video w-full rounded-lg overflow-hidden border transition-all p-0 focus:outline-none cursor-grab active:cursor-grabbing",
                      safeSelectedFrameIndex === idx
                        ? "border-black ring-2 ring-black/10 shadow-md transform scale-[1.02]"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100 opacity-60 hover:opacity-100"
                    )}
                  >
                    {frame.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frame.imageUrl} alt={`F${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-200">
                        <div className="absolute inset-0 bg-white/40 mask-diagonal-stripes" />
                      </div>
                    )}
                  </button>
                  {frames.length > 1 && safeSelectedFrameIndex === idx && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFrame(idx)
                      }}
                      className="absolute -top-2 -right-2 bg-red-500/90 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-sm"
                      title="프레임 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {(idx < frames.length - 1 || frames.length < 4) && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                </div>
              ))}
              {frames.length < 4 && (
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={handleAddFrame}
                    className="relative aspect-video w-full rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-400 transition-all focus:outline-none"
                    title="프레임 추가"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2">
              {frames.map((_, idx) => (
                <div key={idx} className="flex items-center gap-4 flex-1">
                  <div className="w-full text-center">
                    <span className={cn("text-[11px] font-bold tracking-wider", safeSelectedFrameIndex === idx ? "text-black" : "text-gray-400")}>
                      F{idx + 1}
                    </span>
                  </div>
                  {(idx < frames.length - 1 || frames.length < 4) && <div className="w-4 flex-shrink-0" />}
                </div>
              ))}
              {frames.length < 4 && (
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-full text-center">
                    <span className="text-[11px] font-medium text-gray-400">프레임 추가</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="col-span-1 lg:col-span-4 flex flex-col border-border/60 shadow-sm glass-card">
          <div className="p-4 border-b flex items-center justify-between bg-white rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold text-black">T</span>
              <span className="font-semibold text-sm tracking-wide text-gray-800">스크립트</span>
            </div>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 font-medium">F{safeSelectedFrameIndex + 1} 종속</Badge>
          </div>
          <ScrollArea className="flex-1 p-4 flex flex-col">
            <Textarea
              value={currentFrame.script}
              onChange={(e) => updateFrameScript(e.target.value)}
              placeholder={`F${safeSelectedFrameIndex + 1} 프레임에 대한 스크립트를 입력하세요...`}
              className="min-h-[250px] resize-none border-0 focus-visible:ring-0 p-0 text-sm leading-relaxed text-gray-700 bg-transparent mb-4"
            />
            <div className="mt-8 pt-4 border-t border-border/50">
              <Button
                size="sm"
                onClick={handleGenerateFrame}
                disabled={isGenerating || !canGenerateCurrentFrame}
                className="w-full gap-2 bg-black hover:bg-gray-800 text-white shadow-md h-11 rounded-lg press-down text-sm font-semibold"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                F{safeSelectedFrameIndex + 1} 프레임 생성하기
              </Button>
              {!canGenerateCurrentFrame && (
                <p className="mt-2 text-xs text-red-500">
                  프레임이 3개 이상이면 Start/End 프레임 이미지를 먼저 생성해야 합니다.
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

    </div>
  )
}
