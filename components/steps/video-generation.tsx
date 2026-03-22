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
  Video,
  Pause,
  Layers,
  Zap
} from "lucide-react"
import { useState, Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import { updateSession } from "@/lib/api"

interface VideoGenerationProps {
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  onNext: () => void
  onBack: () => void
  sessionId?: string | null
}

export function VideoGeneration({ project, setProject, onNext, onBack, sessionId }: VideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [sceneErrors, setSceneErrors] = useState<Record<string, string>>({})
  const apiBase = sessionId
    ? `http://localhost:8080/api/v1/sessions/${encodeURIComponent(sessionId)}/generation`
    : null

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

  const resolveSceneBaseImage = (scene: Scene): string | undefined => {
    const startFrameImage = scene.frames?.[0]?.imageUrl
    if (startFrameImage && startFrameImage.trim()) return startFrameImage.trim()
    if (scene.imageUrl && scene.imageUrl.trim()) return scene.imageUrl.trim()
    const pinned = scene.pinnedAssets ?? []
    if (!pinned.length) return undefined
    for (const assetId of pinned) {
      const imageUrl = project.customAssets?.[assetId]?.imageUrl
      if (imageUrl && imageUrl.trim()) return imageUrl.trim()
    }
    return undefined
  }

  const scenesWithImages = project.scenes.filter((s) => Boolean(resolveSceneBaseImage(s)))
  const completedCount = scenesWithImages.filter((s) => s.videoUrl).length
  const progress = scenesWithImages.length > 0 ? (completedCount / scenesWithImages.length) * 100 : 0
  const allDone = scenesWithImages.length > 0 && completedCount === scenesWithImages.length

  const resolvePlayableVideoUrl = (scene: Scene): string | undefined => {
    if (!scene.videoUrl || !scene.videoUrl.trim()) return undefined
    if (!apiBase) return scene.videoUrl.trim()
    return `${apiBase}/videos/${encodeURIComponent(String(scene.id))}/preview`
  }

  const pollVideoStatus = async (sceneId: string | number) => {
    if (!apiBase) return
    return new Promise<void>((resolve) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${apiBase}/images/${encodeURIComponent(String(sceneId))}/status`)
          if (response.ok) {
            const updatedScene = await response.json()

            setProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map(s => s.id === sceneId ? updatedScene : s)
            }))

            if (updatedScene.status === "completed" || updatedScene.status === "done" || updatedScene.status === "error") {
              if (updatedScene.status === "error") {
                const message = updatedScene.lastErrorMessage
                  ? (updatedScene.lastErrorRequestId
                    ? `${updatedScene.lastErrorMessage} (오류 ID: ${updatedScene.lastErrorRequestId})`
                    : updatedScene.lastErrorMessage)
                  : "영상 생성에 실패했습니다."
                setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: message }))
              }
              clearInterval(pollInterval)
              resolve()
            }
          }
        } catch (error) {
          console.error("Polling error:", error)
          clearInterval(pollInterval)
          resolve()
        }
      }, 2000)
    })
  }

  const generateVideos = async () => {
    if (!apiBase) {
      alert("세션이 준비되지 않아 영상 생성을 시작할 수 없습니다.")
      return
    }

    setIsGenerating(true)

    // scene.imageUrl이 비어 있어도 pinned custom asset 이미지로 보정
    const hydratedProject: ProjectState = {
      ...project,
      scenes: project.scenes.map((s) => {
        const base = resolveSceneBaseImage(s)
        return base ? { ...s, imageUrl: s.imageUrl ?? base } : s
      }),
    }
    setProject(hydratedProject)
    if (sessionId) {
      try {
        await updateSession(sessionId, hydratedProject)
      } catch (e) {
        console.error("Failed to sync hydrated scenes before video generation", e)
      }
    }

    // 병렬로 모든 비디오 생성 요청 (또는 순차)
    const pendingScenes = hydratedProject.scenes.filter(s => resolveSceneBaseImage(s) && !s.videoUrl)

    const requests = pendingScenes.map(async (scene) => {
      try {
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id
              ? { ...s, status: "generating_video" as const, lastErrorCode: undefined, lastErrorMessage: undefined, lastErrorRetryable: undefined, lastErrorRequestId: undefined }
              : s
          ),
        }))

        const response = await fetch(`${apiBase}/videos/${encodeURIComponent(String(scene.id))}`, {
          method: "POST"
        })
        if (response.ok) {
          setSceneErrors((prev) => {
            const next = { ...prev }
            delete next[String(scene.id)]
            return next
          })
          await pollVideoStatus(scene.id)
        } else {
          const message = await readErrorMessage(response)
          setProject((prev) => ({
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.id === scene.id ? { ...s, status: "error" as const } : s
            ),
          }))
          setSceneErrors((prev) => ({ ...prev, [String(scene.id)]: message }))
        }
      } catch (error) {
        console.error("Generate video error:", error)
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id ? { ...s, status: "error" as const } : s
          ),
        }))
        setSceneErrors((prev) => ({ ...prev, [String(scene.id)]: "영상 생성 중 네트워크 오류가 발생했습니다." }))
      }
    })

    await Promise.all(requests)
    setIsGenerating(false)
  }

  const regenerateVideo = async (sceneId: string | number) => {
    if (!apiBase) {
      alert("세션이 준비되지 않아 영상을 재생성할 수 없습니다.")
      return
    }

    try {
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, status: "generating_video" as const, lastErrorCode: undefined, lastErrorMessage: undefined, lastErrorRetryable: undefined, lastErrorRequestId: undefined }
            : s
        ),
      }))

      const response = await fetch(`${apiBase}/videos/${encodeURIComponent(String(sceneId))}`, {
        method: "POST"
      })
      if (response.ok) {
        setSceneErrors((prev) => {
          const next = { ...prev }
          delete next[String(sceneId)]
          return next
        })
        await pollVideoStatus(sceneId)
      } else {
        const message = await readErrorMessage(response)
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, status: "error" as const } : s
          ),
        }))
        setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: message }))
      }
    } catch (error) {
      console.error("Regenerate video error:", error)
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, status: "error" as const } : s
        ),
      }))
      setSceneErrors((prev) => ({ ...prev, [String(sceneId)]: "영상 재생성 중 네트워크 오류가 발생했습니다." }))
    }
  }

  const regenerateAll = () => {
    const resetScenes = project.scenes.map((s) => ({
      ...s,
      videoUrl: undefined,
      status: s.imageUrl ? "pending" as const : s.status
    }))
    setProject({ ...project, scenes: resetScenes })
  }

  const getStatusIcon = (scene: Scene) => {
    if (scene.videoUrl) return <Check className="h-3.5 w-3.5" />
    if (scene.status === "generating_video") return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    if (scene.status === "error") return <AlertCircle className="h-3.5 w-3.5" />
    return <Video className="h-3.5 w-3.5" />
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-auto">
        <div className="w-full max-w-5xl mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8 animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">영상 생성</h2>
          <p className="text-sm text-muted-foreground">
            이미지를 영상 클립으로 애니메이션화합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Layers className="h-3 w-3" />
            {completedCount} / {scenesWithImages.length}
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
                  {allDone ? "모든 영상 클립 생성 완료" : `${completedCount}개 영상 생성됨`}
                </p>
                {scenesWithImages.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    생성 가능한 기준 이미지가 없습니다. 씬 이미지 생성 또는 에셋 핀 고정(이미지 포함) 후 다시 시도하세요.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setIsGenerating(false)}>
                    <Pause className="h-3.5 w-3.5 mr-2" />
                    일시정지
                  </Button>
                ) : allDone ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8" onClick={regenerateAll}>
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        전체 재생성
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>모든 영상 재생성</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button size="sm" className="h-8 bg-black hover:bg-gray-800 text-white press-down" onClick={generateVideos}>
                    <Zap className="h-3.5 w-3.5 mr-2" />
                    {completedCount > 0 ? "계속" : "생성 시작"}
                  </Button>
                )}
              </div>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Scene Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {project.scenes.map((scene, index) => {
          const baseImageUrl = resolveSceneBaseImage(scene)
          if (!baseImageUrl) return null

          return (
            <Card key={scene.id} className={cn(
              "glass-surface group hover-lift",
              scene.status === "error" && !scene.videoUrl && "border-destructive/50"
            )}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center",
                      scene.videoUrl && "bg-foreground text-background",
                      scene.status === "generating_video" && "bg-muted text-foreground",
                      scene.status === "error" && !scene.videoUrl && "bg-destructive text-destructive-foreground",
                      !scene.videoUrl && scene.status !== "generating_video" && scene.status !== "error" && "bg-muted text-muted-foreground"
                    )}>
                      {getStatusIcon(scene)}
                    </div>
                    <span className="text-sm font-medium">씬 {index + 1}</span>
                  </div>
                  {(scene.videoUrl || scene.status === "error") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => regenerateVideo(scene.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>이 영상 재생성</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Video/Image Preview */}
                <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center overflow-hidden relative mb-2">
                  {scene.videoUrl ? (
                    <>
                      <video
                        src={resolvePlayableVideoUrl(scene)}
                        controls
                        preload="metadata"
                        className="w-full h-full object-cover bg-black"
                      />
                      <Badge className="absolute top-2 right-2 text-[10px] bg-foreground text-background">완료</Badge>

                    </>
                  ) : scene.status === "generating_video" ? (
                    <div className="relative w-full h-full">
                      <img
                        src={baseImageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover opacity-50"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                        <span className="text-xs text-white mt-1.5">애니메이션 중...</span>
                      </div>
                    </div>
                  ) : scene.status === "error" ? (
                    <div className="relative w-full h-full">
                      <img
                        src={baseImageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover opacity-30"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <span className="text-xs text-destructive mt-1">실패</span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={baseImageUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate">{scene.title}</p>
                  <span className="text-[10px] text-muted-foreground">{scene.duration}초</span>
                </div>
                {scene.status === "error" && sceneErrors[String(scene.id)] && (
                  <p className="mt-1 text-[11px] text-destructive line-clamp-2">
                    {sceneErrors[String(scene.id)]}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
        </div>
      </div>

      {/* Navigation - 하단 고정 */}
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
            disabled={completedCount === 0} 
            className="rounded-lg text-white font-semibold px-8 h-10 gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 transition-all shadow-md press-down btn-unified"
          >
            최종 병합으로 계속
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
