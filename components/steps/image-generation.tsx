"use client"

import type { ProjectState, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, RefreshCw, Check, Loader2, AlertCircle, ImageIcon, Play, Pause } from "lucide-react"
import { useState, useEffect } from "react"
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

      // Set current scene to generating
      const updatingScenes = [...project.scenes]
      updatingScenes[i] = { ...scene, status: "generating" }
      setProject({ ...project, scenes: updatingScenes })

      // Simulate generation time
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

      // Randomly succeed or fail (90% success rate for demo)
      const success = Math.random() > 0.1
      const finalScenes = [...project.scenes]
      finalScenes[i] = {
        ...scene,
        status: success ? "done" : "error",
        imageUrl: success ? `/placeholder.svg?text=Scene+${i + 1}` : undefined,
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
      imageUrl: `/placeholder.svg?text=Scene+${sceneIndex + 1}+Regen`,
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

  const getStatusIcon = (status: Scene["status"]) => {
    switch (status) {
      case "done":
        return <Check className="h-4 w-4 text-green-600" />
      case "generating":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <ImageIcon className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: Scene["status"]) => {
    switch (status) {
      case "done":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Done</Badge>
      case "generating":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Generating</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Image Generation</h2>
        <p className="text-muted-foreground">
          Generate images for each scene. You can regenerate individual scenes if needed.
        </p>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {completedCount} of {project.scenes.length} images generated
                </p>
                {errorCount > 0 && (
                  <p className="text-xs text-red-600">{errorCount} failed - click to retry</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Button variant="outline" onClick={() => setIsPaused(true)}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : allDone ? (
                  <Button variant="outline" onClick={regenerateAll}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate All
                  </Button>
                ) : (
                  <Button onClick={generateImages}>
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
        {project.scenes.map((scene, index) => (
          <Card key={scene.id} className={cn(
            scene.status === "error" && "border-red-200 bg-red-50/50"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(scene.status)}
                  <CardTitle className="text-sm">Scene {index + 1}</CardTitle>
                </div>
                {getStatusBadge(scene.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Image Preview Area */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {scene.status === "done" && scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={scene.title}
                    className="w-full h-full object-cover"
                  />
                ) : scene.status === "generating" ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-xs">Generating...</span>
                  </div>
                ) : scene.status === "error" ? (
                  <div className="flex flex-col items-center gap-2 text-red-600">
                    <AlertCircle className="h-8 w-8" />
                    <span className="text-xs">Generation failed</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Pending</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>

              {/* Actions */}
              {(scene.status === "done" || scene.status === "error") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => regenerateScene(scene.id)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Continue Button */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onNext} disabled={completedCount === 0}>
          Continue to Video Generation
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
