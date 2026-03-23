"use client"

import type { ProjectState, Scene } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Check,
  Loader2,
  AlertCircle,
  ImageIcon,
  Play,
  Pause,
  Palette,
  User,
  Layers
} from "lucide-react"
import { useState, Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import { updateSession } from "@/lib/api"

interface ImageGenerationProps {
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  onNext: () => void
  onBack: () => void
  sessionId?: string | null
}

export function ImageGeneration({ project, setProject, onNext, onBack, sessionId }: ImageGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [keepStyle, setKeepStyle] = useState<string | null>(null)
  const [keepCharacter, setKeepCharacter] = useState<string | null>(null)
  const [sceneErrors, setSceneErrors] = useState<Record<string, string>>({})
  const apiBase = sessionId
    ? `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}/generation`
    : null
  const sessionBase = sessionId
    ? `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}`
    : null

  const completedCount = project.scenes.filter((s) => s.status === "done").length
  const errorCount = project.scenes.filter((s) => s.status === "error").length
  const progress = (completedCount / project.scenes.length) * 100
  const allDone = completedCount === project.scenes.length

  const readErrorMessage = async (response: Response) => {
    try {
      const json = await response.json()
      if (json && typeof json === "object") {
        const message = typeof json.userMessage === "string" && json.userMessage.trim()
          ? json.userMessage.trim()
          : (typeof json.message === "string" && json.message.trim() ? json.message.trim() : "")
        const requestId = typeof json.requestId === "string" ? json.requestId.trim() : ""
        if (message) {
          return requestId ? `${message} (오류 ID: ${requestId})` : message
        }
      }
    } catch {
      // ignore json parse failure
    }
    const text = await response.text().catch(() => "")
    if (text && text.trim()) return text.trim()
    return `요청 실패 (${response.status})`
  }

  const pollSceneStatus = (sceneId: string | number): Promise<void> => {
    if (!apiBase) return Promise.resolve()
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/images/${encodeURIComponent(String(sceneId))}/status`)
          if (!res.ok) throw new Error("Status check failed")
          const updatedScene = await res.json()
          setProject((prev: ProjectState) => ({
            ...prev,
            scenes: prev.scenes.map((s) => s.id === sceneId ? updatedScene : s),
          }))
          if (updatedScene.status === "done" || updatedScene.status === "error") {
            if (updatedScene.status === "error") {
              const message = updatedScene.lastErrorMessage
                ? (updatedScene.lastErrorRequestId
                  ? `${updatedScene.lastErrorMessage} (오류 ID: ${updatedScene.lastErrorRequestId})`
                  : updatedScene.lastErrorMessage)
                : "이미지 생성에 실패했습니다."
              setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: message }))
            } else {
              setSceneErrors((prev) => {
                const next = { ...prev }
                delete next[String(sceneId)]
                return next
              })
            }
            clearInterval(interval)
            resolve()
          }
        } catch {
          clearInterval(interval)
          setProject((prev: ProjectState) => ({
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.id === sceneId ? { ...s, status: "error" as const } : s
            ),
          }))
          setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: "상태 확인 중 네트워크 오류가 발생했습니다." }))
          resolve()
        }
      }, 2000)
    })
  }

  const generateImages = async () => {
    if (!apiBase) {
      alert("세션이 준비되지 않아 이미지 생성을 시작할 수 없습니다.")
      return
    }

    setIsGenerating(true)
    setIsPaused(false)

    const pendingScenes = project.scenes.filter((s) => s.status !== "done")

    for (const scene of pendingScenes) {
      if (isPaused) break

      setProject((prev: ProjectState) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === scene.id
            ? { ...s, status: "generating" as const, lastErrorCode: undefined, lastErrorMessage: undefined, lastErrorRetryable: undefined, lastErrorRequestId: undefined }
            : s
        ),
      }))

      try {
        const res = await fetch(`${apiBase}/images/${encodeURIComponent(String(scene.id))}`, { method: "POST" })
        if (res.ok) {
          await pollSceneStatus(scene.id)
        } else {
          const message = await readErrorMessage(res)
          setProject((prev: ProjectState) => ({
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.id === scene.id ? { ...s, status: "error" as const } : s
            ),
          }))
          setSceneErrors((prev) => ({ ...prev, [String(scene.id)]: message }))
        }
      } catch {
        setProject((prev: ProjectState) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id ? { ...s, status: "error" as const } : s
          ),
        }))
        setSceneErrors((prev) => ({ ...prev, [String(scene.id)]: "이미지 생성 중 네트워크 오류가 발생했습니다." }))
      }
    }

    setIsGenerating(false)
  }

  const regenerateScene = async (sceneId: string) => {
    if (!apiBase) {
      alert("세션이 준비되지 않아 이미지를 재생성할 수 없습니다.")
      return
    }

    setProject((prev: ProjectState) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        s.id === sceneId
          ? { ...s, status: "generating" as const, lastErrorCode: undefined, lastErrorMessage: undefined, lastErrorRetryable: undefined, lastErrorRequestId: undefined }
          : s
      ),
    }))

    try {
      const res = await fetch(`${apiBase}/images/${encodeURIComponent(String(sceneId))}`, { method: "POST" })
      if (res.ok) {
        await pollSceneStatus(sceneId)
      } else {
        const message = await readErrorMessage(res)
        setProject((prev: ProjectState) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, status: "error" as const } : s
          ),
        }))
        setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: message }))
      }
    } catch {
      setProject((prev: ProjectState) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, status: "error" as const } : s
        ),
      }))
      setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: "이미지 재생성 중 네트워크 오류가 발생했습니다." }))
    }
  }

  const regenerateAll = () => {
    const resetScenes = project.scenes.map((scene) => ({
      ...scene,
      status: "pending" as const,
      imageUrl: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      lastErrorRetryable: undefined,
      lastErrorRequestId: undefined,
    }))
    setProject({ ...project, scenes: resetScenes })
    setSceneErrors({})
  }

  const handleKeepStyle = async (sceneId: string) => {
    const newKeepStyle = keepStyle === sceneId ? null : sceneId
    setKeepStyle(newKeepStyle)

    // [일관성 강화] 선택한 씬의 이미지를 세션 backgroundReferenceImageUrl로 저장
    if (newKeepStyle && sessionBase) {
      const selectedScene = project.scenes.find(s => String(s.id) === newKeepStyle)
      const imageUrl = selectedScene?.imageUrl
      if (imageUrl) {
        try {
          const updatedProject = {
            ...project,
            backgroundReferenceImageUrl: imageUrl,
          }
          await fetch(sessionBase, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedProject),
          })
          setProject(updatedProject)
        } catch {
          console.error("스타일 기준 씬 저장 실패")
        }
      }
    }
  }

  const handleKeepCharacter = async (sceneId: string) => {
    const newKeepCharacter = keepCharacter === sceneId ? null : sceneId
    setKeepCharacter(newKeepCharacter)

    // [일관성 강화] 선택한 씬의 이미지를 세션 backgroundReferenceImageUrl로 저장 (캐릭터 기준)
    if (newKeepCharacter && sessionBase) {
      const selectedScene = project.scenes.find(s => String(s.id) === newKeepCharacter)
      const imageUrl = selectedScene?.imageUrl
      if (imageUrl) {
        try {
          const updatedProject = {
            ...project,
            backgroundReferenceImageUrl: imageUrl,
          }
          await fetch(sessionBase, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedProject),
          })
          setProject(updatedProject)
        } catch {
          console.error("캐릭터 기준 씬 저장 실패")
        }
      }
    }
  }

  const getStatusIcon = (status: Scene["status"]) => {
    switch (status) {
      case "done":
        return <Check className="h-3.5 w-3.5" />
      case "generating":
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case "error":
        return <AlertCircle className="h-3.5 w-3.5" />
      default:
        return <ImageIcon className="h-3.5 w-3.5" />
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">이미지 생성</h2>
          <p className="text-sm text-muted-foreground">
            각 씬에 대한 이미지를 생성합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Layers className="h-3 w-3" />
            {completedCount} / {project.scenes.length}
          </Badge>
        </div>
      </div>

      {/* Progress Summary */}
      <Card className="glass-surface">
        <CardContent className="py-4 px-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {allDone ? "모든 이미지 생성 완료" : `${completedCount}개 이미지 생성됨`}
                </p>
                {errorCount > 0 && (
                  <p className="text-xs text-destructive">{errorCount}개 실패 - 개별 재시도 가능</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => setIsPaused(true)}>
                        <Pause className="h-3.5 w-3.5 mr-2" />
                        일시정지
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>생성 일시정지</TooltipContent>
                  </Tooltip>
                ) : allDone ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8" onClick={regenerateAll}>
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        전체 재생성
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>모든 이미지 재생성</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button size="sm" className="h-8 bg-black hover:bg-gray-800 text-white press-down" onClick={generateImages}>
                    <Play className="h-3.5 w-3.5 mr-2" />
                    {completedCount > 0 ? "계속" : "생성 시작"}
                  </Button>
                )}
              </div>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Consistency Options */}
      {(keepStyle || keepCharacter) && (
          <Card className="glass-surface border-dashed">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">일관성 유지:</span>
              {keepStyle && (
                <Badge variant="secondary" className="gap-1">
                  <Palette className="h-3 w-3" />
                  스타일 - 씬 {project.scenes.findIndex(s => s.id === keepStyle) + 1}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={() => setKeepStyle(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {keepCharacter && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  캐릭터 - 씬 {project.scenes.findIndex(s => s.id === keepCharacter) + 1}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={() => setKeepCharacter(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scene Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {project.scenes.map((scene, index) => (
          <Card key={scene.id} className={cn(
            "glass-surface group hover-lift",
            scene.status === "error" && "border-destructive/50"
          )}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px]",
                    scene.status === "done" && "bg-foreground text-background",
                    scene.status === "generating" && "bg-muted text-foreground",
                    scene.status === "error" && "bg-destructive text-destructive-foreground",
                    scene.status === "pending" && "bg-muted text-muted-foreground"
                  )}>
                    {getStatusIcon(scene.status)}
                  </div>
                  <span className="text-sm font-medium">씬 {index + 1}</span>
                </div>
                {(scene.status === "done" || scene.status === "error") && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => regenerateScene(String(scene.id))}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>이 씬 재생성</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Image Preview Area */}
              <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
                {scene.status === "done" && scene.imageUrl ? (
                  <>
                    <img
                      src={scene.imageUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                    {/* Hover Actions */}
                    <div className="hover-overlay" />
                    <div className="hover-actions">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={cn(
                              "h-8 w-8 glass-button",
                              keepStyle === scene.id && "bg-foreground text-background"
                            )}
                            onClick={() => handleKeepStyle(String(scene.id))}
                          >
                            <Palette className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>스타일 유지</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={cn(
                              "h-8 w-8 glass-button",
                              keepCharacter === scene.id && "bg-foreground text-background"
                            )}
                            onClick={() => handleKeepCharacter(String(scene.id))}
                          >
                            <User className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>캐릭터 유지</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 glass-button"
                            onClick={() => regenerateScene(String(scene.id))}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>이미지 재생성</TooltipContent>
                      </Tooltip>
                    </div>
                  </>
                ) : scene.status === "generating" ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs">생성 중...</span>
                  </div>
                ) : scene.status === "error" ? (
                  <div className="flex flex-col items-center gap-2 text-destructive">
                    <AlertCircle className="h-6 w-6" />
                    <span className="text-xs">실패</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">대기 중</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground truncate">{scene.title}</p>
              {scene.status === "error" && sceneErrors[String(scene.id)] && (
                <div className="mt-2 text-[11px] text-destructive flex flex-col gap-2">
                  <p className="line-clamp-2">{sceneErrors[String(scene.id)]}</p>
                  <div className="flex flex-col gap-2 mt-1">
                    <textarea
                      className="w-full text-xs p-2 border border-destructive/30 rounded bg-white text-black"
                      rows={2}
                      value={scene.description || ""}
                      onChange={(e) => {
                        setProject(prev => ({
                          ...prev,
                          scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, description: e.target.value } : s)
                        }))
                      }}
                      placeholder="수정할 씬 대본을 입력하세요..."
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs border-destructive/50 hover:bg-destructive/10 text-destructive w-full"
                      onClick={async () => {
                        if (sessionId) {
                          await updateSession(sessionId, project);
                        }
                        regenerateScene(String(scene.id));
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      수정 대본으로 재시도
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-4 py-3 sm:px-6 sm:py-4 mt-10 mb-6">
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
            disabled={completedCount === 0} 
            className="rounded-lg text-white font-semibold px-8 h-10 gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 transition-all shadow-md press-down"
          >
            영상 생성으로 계속
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
