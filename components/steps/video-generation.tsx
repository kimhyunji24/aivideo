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
  Play,
  Pause,
  Layers,
  Zap
} from "lucide-react"
import { useState, Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"

interface VideoGenerationProps {
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  onNext: () => void
  onBack: () => void
}

export function VideoGeneration({ project, setProject, onNext, onBack }: VideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const scenesWithImages = project.scenes.filter((s) => s.imageUrl)
  const completedCount = scenesWithImages.filter((s) => s.videoUrl).length
  const progress = (completedCount / scenesWithImages.length) * 100
  const allDone = completedCount === scenesWithImages.length

  const pollVideoStatus = async (sceneId: string | number) => {
    return new Promise<void>((resolve) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${sceneId}`)
          if (response.ok) {
            const updatedScene = await response.json()

            setProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map(s => s.id === sceneId ? updatedScene : s)
            }))

            if (updatedScene.status === "done" || updatedScene.status === "error") {
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
    setIsGenerating(true)

    // 병렬로 모든 비디오 생성 요청 (또는 순차)
    const pendingScenes = project.scenes.filter(s => s.imageUrl && !s.videoUrl)

    const requests = pendingScenes.map(async (scene) => {
      try {
        const response = await fetch(`/api/generate-video?id=${scene.id}`, {
          method: "POST"
        })
        if (response.ok) {
          const initialScene = await response.json()
          setProject((prev) => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === scene.id ? initialScene : s)
          }))
          await pollVideoStatus(scene.id)
        }
      } catch (error) {
        console.error("Generate video error:", error)
      }
    })

    await Promise.all(requests)
    setIsGenerating(false)
  }

  const regenerateVideo = async (sceneId: string | number) => {
    try {
      const response = await fetch(`/api/generate-video?id=${sceneId}`, {
        method: "POST"
      })
      if (response.ok) {
        const initialScene = await response.json()
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map(s => s.id === sceneId ? initialScene : s)
        }))
        await pollVideoStatus(sceneId)
      }
    } catch (error) {
      console.error("Regenerate video error:", error)
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
    if (scene.status === "generating") return <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
          if (!scene.imageUrl) return null

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
                      scene.status === "generating" && "bg-muted text-foreground",
                      scene.status === "error" && !scene.videoUrl && "bg-destructive text-destructive-foreground",
                      !scene.videoUrl && scene.status !== "generating" && scene.status !== "error" && "bg-muted text-muted-foreground"
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
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center">
                          <Play className="h-5 w-5 ml-0.5" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 text-[10px] bg-foreground text-background">완료</Badge>

                      {/* Hover actions */}
                      <div className="hover-overlay" />
                      <div className="hover-actions">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 glass-button"
                              onClick={() => regenerateVideo(scene.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>영상 재생성</TooltipContent>
                        </Tooltip>
                      </div>
                    </>
                  ) : scene.status === "generating" ? (
                    <div className="relative w-full h-full">
                      <img
                        src={scene.imageUrl}
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
                        src={scene.imageUrl}
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
                      src={scene.imageUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate">{scene.title}</p>
                  <span className="text-[10px] text-muted-foreground">{scene.duration}초</span>
                </div>
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
