"use client"

import type { ProjectState, Scene } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowRight,
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
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ImageGenerationProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
  onBack: () => void
}

export function ImageGeneration({ project, setProject, onNext, onBack }: ImageGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [keepStyle, setKeepStyle] = useState<string | null>(null)
  const [keepCharacter, setKeepCharacter] = useState<string | null>(null)

  const completedCount = project.scenes.filter((s) => s.status === "done").length
  const errorCount = project.scenes.filter((s) => s.status === "error").length
  const progress = (completedCount / project.scenes.length) * 100
  const allDone = completedCount === project.scenes.length

  const generateImages = async () => {
    setIsGenerating(true)
    setIsPaused(false)

    for (let i = 0; i < project.scenes.length; i++) {
      if (isPaused) break

      const scene = project.scenes[i]
      if (scene.status === "done") continue

      const updatingScenes = [...project.scenes]
      updatingScenes[i] = { ...scene, status: "generating" }
      setProject({ ...project, scenes: updatingScenes })

      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

      const success = Math.random() > 0.1
      const finalScenes = [...project.scenes]
      finalScenes[i] = {
        ...scene,
        status: success ? "done" : "error",
        imageUrl: success ? `/placeholder.svg?text=씬+${i + 1}` : undefined,
      }
      setProject({ ...project, scenes: finalScenes })
    }

    setIsGenerating(false)
  }

  const regenerateScene = async (sceneId: string) => {
    const sceneIndex = project.scenes.findIndex((s) => s.id === sceneId)
    if (sceneIndex === -1) return

    const updatingScenes = [...project.scenes]
    updatingScenes[sceneIndex] = { ...updatingScenes[sceneIndex], status: "generating" }
    setProject({ ...project, scenes: updatingScenes })

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const finalScenes = [...project.scenes]
    finalScenes[sceneIndex] = {
      ...finalScenes[sceneIndex],
      status: "done",
      imageUrl: `/placeholder.svg?text=씬+${sceneIndex + 1}+재생성`,
    }
    setProject({ ...project, scenes: finalScenes })
  }

  const regenerateAll = () => {
    const resetScenes = project.scenes.map((scene) => ({
      ...scene,
      status: "pending" as const,
      imageUrl: undefined,
    }))
    setProject({ ...project, scenes: resetScenes })
  }

  const handleKeepStyle = (sceneId: string) => {
    setKeepStyle(keepStyle === sceneId ? null : sceneId)
  }

  const handleKeepCharacter = (sceneId: string) => {
    setKeepCharacter(keepCharacter === sceneId ? null : sceneId)
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">이미지 생성</h2>
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
      <Card className="glass-card">
        <CardContent className="py-4">
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
                  <Button size="sm" className="h-8" onClick={generateImages}>
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
        <Card className="glass-card border-dashed">
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
            "glass-card group",
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={onNext} disabled={completedCount === 0} className="h-8">
          영상 생성으로 계속
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </div>
    </div>
  )
}
