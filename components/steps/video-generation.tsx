"use client"

import type { ProjectState, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowRight, RefreshCw, Check, Loader2, AlertCircle, Video, Play, Pause, Settings } from "lucide-react"
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

      // Set current scene to generating
      const updatingScenes = [...project.scenes]
      updatingScenes[i] = { ...scene, status: "generating" }
      setProject({ ...project, scenes: updatingScenes })

      // Simulate video generation (longer than images)
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

  const getStatusIcon = (scene: Scene) => {
    if (scene.videoUrl) return <Check className="h-4 w-4 text-green-600" />
    if (scene.status === "generating") return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    if (scene.status === "error") return <AlertCircle className="h-4 w-4 text-red-600" />
    return <Video className="h-4 w-4 text-muted-foreground" />
  }

  const getStatusBadge = (scene: Scene) => {
    if (scene.videoUrl) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Done</Badge>
    if (scene.status === "generating") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Generating</Badge>
    if (scene.status === "error") return <Badge variant="destructive">Error</Badge>
    return <Badge variant="secondary">Pending</Badge>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Video Generation</h2>
        <p className="text-muted-foreground">
          Animate your images into video clips. Adjust motion settings if needed.
        </p>
      </div>

      {/* Settings (Advanced Mode) */}
      {project.mode === "advanced" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Video Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Motion Strength: {motionStrength}%</Label>
                <Slider
                  value={[motionStrength]}
                  onValueChange={([v]) => setMotionStrength(v)}
                  max={100}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values create more dramatic camera movement
                </p>
              </div>
              <div className="space-y-3">
                <Label>Animation Style</Label>
                <Select value={videoStyle} onValueChange={setVideoStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smooth">Smooth & Cinematic</SelectItem>
                    <SelectItem value="dynamic">Dynamic & Energetic</SelectItem>
                    <SelectItem value="subtle">Subtle & Minimal</SelectItem>
                    <SelectItem value="parallax">Parallax Depth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {completedCount} of {scenesWithImages.length} videos generated
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Button variant="outline" onClick={() => setIsGenerating(false)}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : allDone ? (
                  <Button variant="outline" onClick={() => {
                    const resetScenes = project.scenes.map((s) => ({ ...s, videoUrl: undefined, status: s.imageUrl ? "pending" as const : s.status }))
                    setProject({ ...project, scenes: resetScenes })
                  }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate All
                  </Button>
                ) : (
                  <Button onClick={generateVideos}>
                    <Play className="h-4 w-4 mr-2" />
                    {completedCount > 0 ? "Continue" : "Start"} Generation
                  </Button>
                )}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Scene Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {project.scenes.map((scene, index) => {
          if (!scene.imageUrl) return null

          return (
            <Card key={scene.id} className={cn(
              scene.status === "error" && !scene.videoUrl && "border-red-200 bg-red-50/50"
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(scene)}
                    <CardTitle className="text-sm">Scene {index + 1}</CardTitle>
                  </div>
                  {getStatusBadge(scene)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Video/Image Preview */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
                  {scene.videoUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="h-6 w-6 text-black ml-1" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-green-600">Video Ready</Badge>
                    </div>
                  ) : scene.status === "generating" ? (
                    <div className="relative w-full h-full">
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover opacity-50"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                        <span className="text-xs text-white mt-2">Animating...</span>
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

                <p className="text-xs text-muted-foreground">{scene.duration}s duration</p>

                {/* Actions */}
                {scene.videoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => regenerateVideo(scene.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate Video
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Continue Button */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onNext} disabled={completedCount === 0}>
          Continue to Final Merge
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
