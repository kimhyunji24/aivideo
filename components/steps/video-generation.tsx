"use client"

import type { ProjectState, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ArrowRight, 
  RefreshCw, 
  Check, 
  Loader2, 
  AlertCircle, 
  Video, 
  Play, 
  Pause, 
  Settings,
  Layers,
  Zap
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface VideoGenerationProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
  onBack: () => void
}

export function VideoGeneration({ project, setProject, onNext, onBack }: VideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [motionStrength, setMotionStrength] = useState(50)
  const [videoStyle, setVideoStyle] = useState("smooth")

  const scenesWithImages = project.scenes.filter((s) => s.imageUrl)
  const completedCount = scenesWithImages.filter((s) => s.videoUrl).length
  const progress = (completedCount / scenesWithImages.length) * 100
  const allDone = completedCount === scenesWithImages.length

  const generateVideos = async () => {
    setIsGenerating(true)

    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i]
      if (!scene.imageUrl || scene.videoUrl) continue

      const updatingScenes = [...project.scenes]
      updatingScenes[i] = { ...scene, status: "generating" }
      setProject({ ...project, scenes: updatingScenes })

      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500))

      const success = Math.random() > 0.05
      const finalScenes = [...project.scenes]
      finalScenes[i] = {
        ...scene,
        status: success ? "done" : "error",
        videoUrl: success ? `/placeholder-video-${i + 1}.mp4` : undefined,
      }
      setProject({ ...project, scenes: finalScenes })
    }

    setIsGenerating(false)
  }

  const regenerateVideo = async (sceneId: string) => {
    const sceneIndex = project.scenes.findIndex((s) => s.id === sceneId)
    if (sceneIndex === -1) return

    const updatingScenes = [...project.scenes]
    updatingScenes[sceneIndex] = { ...updatingScenes[sceneIndex], status: "generating", videoUrl: undefined }
    setProject({ ...project, scenes: updatingScenes })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const finalScenes = [...project.scenes]
    finalScenes[sceneIndex] = {
      ...finalScenes[sceneIndex],
      status: "done",
      videoUrl: `/placeholder-video-${sceneIndex + 1}-regen.mp4`,
    }
    setProject({ ...project, scenes: finalScenes })
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">영상 생성</h2>
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

      {/* Settings (Advanced Mode) */}
      {project.mode === "advanced" && (
        <Card className="glass-card">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              영상 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">모션 강도</label>
                  <span className="text-xs text-muted-foreground">{motionStrength}%</span>
                </div>
                <Slider
                  value={[motionStrength]}
                  onValueChange={([v]) => setMotionStrength(v)}
                  max={100}
                  step={10}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">애니메이션 스타일</label>
                <Select value={videoStyle} onValueChange={setVideoStyle}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smooth">부드러운 시네마틱</SelectItem>
                    <SelectItem value="dynamic">다이나믹 에너지</SelectItem>
                    <SelectItem value="subtle">미니멀 섬세함</SelectItem>
                    <SelectItem value="parallax">패럴랙스 깊이감</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      <Card className="glass-card">
        <CardContent className="py-4">
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
                  <Button size="sm" className="h-8" onClick={generateVideos}>
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
              "glass-card group",
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

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={onNext} disabled={completedCount === 0} className="h-8">
          최종 병합으로 계속
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </div>
    </div>
  )
}
