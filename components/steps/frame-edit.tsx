"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, Edit3, Image as ImageIcon, Sparkles, Loader2, Plus, Trash2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, Frame } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MaskCanvas } from "@/components/ui/mask-canvas"
import { CharacterRefPanel } from "@/components/steps/character-ref-panel"

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
  const safeScenes = Array.isArray(project?.scenes) ? project.scenes : []
  const scene = safeScenes[sceneIndex]
  if (!scene) return null

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(selectedFrameIndexProp)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditingCanvas, setIsEditingCanvas] = useState(false)
  const [isRegenDialogOpen, setIsRegenDialogOpen] = useState(false)
  const [regenPrompt, setRegenPrompt] = useState("")
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
    if (frames.length !== 1) {
      const existingFrame = frames.length > 0 ? frames[0] : null
      const defaultFrames: Frame[] = [
        existingFrame ? existingFrame : { id: `f-${Date.now()}`, script: scene.description || "", imageUrl: scene.imageUrl }
      ]
      setProject((prev) => ({
        ...prev,
        scenes: (Array.isArray(prev.scenes) ? prev.scenes : []).map((s, i) => (i === sceneIndex ? { ...s, frames: defaultFrames } : s)),
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

  const readErrorMessage = async (response: Response): Promise<string> => {
    try {
      const json = await response.json()
      if (json && typeof json === "object") {
        const message =
          typeof json.userMessage === "string" && json.userMessage.trim()
            ? json.userMessage.trim()
            : (typeof json.message === "string" && json.message.trim() ? json.message.trim() : "")
        const requestId = typeof json.requestId === "string" ? json.requestId.trim() : ""
        if (message) {
          return requestId ? `${message}\n(오류 ID: ${requestId})` : message
        }
      }
    } catch {
      // ignore json parse failure
    }

    const text = await response.text().catch(() => "")
    if (text && text.trim()) return text.trim()
    return `프레임 생성에 실패했습니다. (HTTP ${response.status})`
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
      
      newScenes[sceneIndex] = {
        ...currentScene,
        frames: newFrames,
        imageUrl: newFrames[0]?.imageUrl || currentScene.imageUrl,
      }
      
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
        return {
          ...s,
          frames: newFrames,
          imageUrl: newFrames[0]?.imageUrl || s.imageUrl,
        }
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
      const createRes = await fetch("/api/v1/sessions", { method: "POST" })
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
      await fetch("/api/v1/sessions/" + encodeURIComponent(sid), {
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
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/frames/${encodeURIComponent(String(scene.id ?? sceneIndex))}`,
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
        const message = await readErrorMessage(response)
        throw new Error(message)
      }

      const generatedFrame = (await response.json()) as Frame

      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => {
          if (i !== sceneIndex) return s
          const existingFrames = s.frames ?? []
          if (existingFrames.length === 0) {
            return {
              ...s,
              frames: [generatedFrame],
              imageUrl: generatedFrame.imageUrl || s.imageUrl,
            }
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
          return {
            ...s,
            frames: nextFrames,
            imageUrl: nextFrames[0]?.imageUrl || s.imageUrl,
          }
        }),
      }))
    } catch (error) {
      console.error("Frame generation error:", error)
      const message = error instanceof Error && error.message?.trim()
        ? error.message.trim()
        : "프레임 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
      alert(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenWithReference = async () => {
    if (!currentFrame || !regenPrompt.trim()) return
    let sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    setIsRegenDialogOpen(false)
    setIsGenerating(true)
    try {
      const res = await fetch(`http://localhost:8080/api/v1/sessions/${encodeURIComponent(sid)}/generation/images/${encodeURIComponent(String(scene.id ?? sceneIndex))}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: currentFrame.id, prompt: regenPrompt.trim() })
      })
      if (!res.ok) {
        const message = await readErrorMessage(res)
        throw new Error(message)
      }
      const updatedFrame = await res.json()
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => {
          if (i !== sceneIndex) return s
          const newFrames = s.frames ? [...s.frames] : []
          const idx = newFrames.findIndex(f => f.id === currentFrame.id)
          if (idx >= 0) newFrames[idx] = updatedFrame
          return { ...s, frames: newFrames, imageUrl: newFrames[0]?.imageUrl || s.imageUrl }
        })
      }))
      setRegenPrompt("")
    } catch(e: any) {
      alert(e.message || "재생성 중 오류가 발생했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditFrame = async (maskBase64: string) => {
    if (!currentFrame) return
    let sid = resolveSessionId()
    if (!sid) {
      alert("세션이 확인되지 않습니다.")
      return
    }

    const editPrompt = window.prompt("수정할 내용을 입력하세요 (비워두면 AI가 문맥에 맞게 지우거나 채웁니다):") || ""
    setIsEditingCanvas(false)
    setIsGenerating(true)

    try {
      const res = await fetch(`http://localhost:8080/api/v1/sessions/${encodeURIComponent(sid)}/generation/images/${encodeURIComponent(String(scene.id ?? sceneIndex))}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maskBase64, prompt: editPrompt, frameId: currentFrame.id })
      })
      if (!res.ok) {
        const message = await readErrorMessage(res)
        throw new Error(message)
      }
      const updatedFrame = await res.json()
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => {
          if (i !== sceneIndex) return s
          const newFrames = s.frames ? [...s.frames] : []
          const idx = newFrames.findIndex(f => f.id === currentFrame.id)
          if (idx >= 0) newFrames[idx] = updatedFrame
          return {
            ...s,
            frames: newFrames,
            imageUrl: newFrames[0]?.imageUrl || s.imageUrl
          }
        })
      }))
    } catch(e: any) {
      alert(e.message || "프레임 부분 수정 중 오류가 발생했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  if (!currentFrame) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-sm text-muted-foreground">
        프레임을 준비하는 중입니다...
      </div>
    )
  }

  const hasCharacters = (project.characters ?? []).length > 0

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-180px)] flex flex-col">
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

      <div className={cn(
        "flex-1 grid gap-4 min-h-0",
        hasCharacters
          ? "grid-cols-[272px_1fr_auto] lg:grid-cols-[272px_1fr_320px]"
          : "grid-cols-1 lg:grid-cols-12"
      )}>
        {/* 왼쪽: 캐릭터 레퍼런스 사이드 패널 */}
        {hasCharacters && (
          <div className="rounded-xl border border-border/60 shadow-sm overflow-hidden flex flex-col">
            <CharacterRefPanel
              project={project}
              setProject={setProject}
              sessionId={sessionId}
            />
          </div>
        )}

        <Card className={cn(
          "flex flex-col border-border/60 shadow-sm glass-card",
          !hasCharacters && "col-span-1 lg:col-span-8"
        )}>
          <div className="relative flex-1 min-h-[220px] max-h-[420px] bg-black/5 flex items-center justify-center p-4">
            {currentFrame.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentFrame.imageUrl}
                  alt={`Frame ${safeSelectedFrameIndex + 1}`}
                  className="w-full h-full object-contain rounded-lg"
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm shadow-md"
                    onClick={() => setIsRegenDialogOpen(true)}
                  >
                    <Sparkles className="w-4 h-4" />
                    자세/동작 변경
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm shadow-md"
                    onClick={() => setIsEditingCanvas(true)}
                  >
                    <Pencil className="w-4 h-4" />
                    부분 수정
                  </Button>
                </div>
              </>
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
                      const reader = new FileReader()
                      reader.onload = () => {
                        const dataUrl = typeof reader.result === "string" ? reader.result : undefined
                        if (!dataUrl) return
                        setProject((prev) => ({
                          ...prev,
                          scenes: prev.scenes.map((s, i) => {
                            if (i !== sceneIndex || !s.frames) return s
                            const newFrames = [...s.frames]
                            newFrames[safeSelectedFrameIndex] = { ...newFrames[safeSelectedFrameIndex], imageUrl: dataUrl }
                            return {
                              ...s,
                              frames: newFrames,
                              imageUrl: newFrames[0]?.imageUrl || s.imageUrl,
                            }
                          })
                        }))
                      }
                      reader.readAsDataURL(file)
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
              <input type="checkbox" id="frame-flow" className="rounded border-gray-300 text-black h-3 w-3 focus:ring-black" defaultChecked disabled />
              <label htmlFor="frame-flow" className="text-xs font-semibold text-gray-700 tracking-wide">프레임 이미지 (4컷 통합)</label>
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
                  {/* 삭제 버튼 제거됨 */}
                  {(idx < frames.length - 1 || frames.length < 4) && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                </div>
              ))}
              {/* 추가 버튼 영역 제거됨 */}
            </div>
          </div>
        </Card>

        <Card className={cn(
          "flex flex-col border-border/60 shadow-sm glass-card",
          !hasCharacters && "col-span-1 lg:col-span-4"
        )}>
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

      <Dialog open={isRegenDialogOpen} onOpenChange={setIsRegenDialogOpen}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-lg border-white/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">자세 / 동작 변경</DialogTitle>
            <DialogDescription>
              현재 이미지를 외형 레퍼런스로 유지하면서 자세나 동작을 바꿔 재생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <Textarea
              value={regenPrompt}
              onChange={(e) => setRegenPrompt(e.target.value)}
              placeholder="예: 일어서서 팔짱을 낀 자세, 뒤를 돌아보는 자세, 앉아서 책을 읽는 자세..."
              className="min-h-[100px] resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsRegenDialogOpen(false)}>취소</Button>
              <Button
                size="sm"
                disabled={!regenPrompt.trim() || isGenerating}
                onClick={handleRegenWithReference}
                className="gap-2 bg-black hover:bg-gray-800 text-white"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                재생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingCanvas} onOpenChange={setIsEditingCanvas}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pt-6 bg-white/95 backdrop-blur-lg border-white/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">프레임 부분 수정 (Canvas Inpainting)</DialogTitle>
            <DialogDescription>
              수정하고 싶은 부분에 형광색 브러시를 칠해주세요. 이 영역만 AI가 다시 그리게 됩니다.
            </DialogDescription>
          </DialogHeader>
          
          {currentFrame.imageUrl && (
            <div className="flex-1 overflow-hidden min-h-[400px] mt-2 border rounded-xl bg-gray-50 shadow-inner">
              <MaskCanvas 
                imageUrl={currentFrame.imageUrl}
                onCancel={() => setIsEditingCanvas(false)}
                onSave={handleEditFrame}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
