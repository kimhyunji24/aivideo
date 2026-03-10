"use client"

import type { ProjectState, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowRight, Pencil, Trash2, Plus, GripVertical, Clock, RefreshCw } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface StoryboardProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
  onBack: () => void
}

export function Storyboard({ project, setProject, onNext, onBack }: StoryboardProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: "", description: "", prompt: "", duration: 3 })
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const totalDuration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0)

  const handleEditScene = (scene: Scene) => {
    setEditingScene(scene)
    setEditForm({
      title: scene.title,
      description: scene.description,
      prompt: scene.prompt,
      duration: scene.duration,
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!editingScene) return

    const updatedScenes = project.scenes.map((scene) =>
      scene.id === editingScene.id
        ? { ...scene, ...editForm }
        : scene
    )
    setProject({ ...project, scenes: updatedScenes })
    setEditDialogOpen(false)
    setEditingScene(null)
  }

  const handleDeleteScene = (sceneId: string) => {
    const updatedScenes = project.scenes.filter((scene) => scene.id !== sceneId)
    setProject({ ...project, scenes: updatedScenes })
  }

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      title: `씬 ${project.scenes.length + 1}`,
      description: "새로운 씬 설명",
      prompt: "새로운 씬 프롬프트",
      duration: 3,
      status: "pending",
    }
    setProject({ ...project, scenes: [...project.scenes, newScene] })
  }

  const handleRegeneratePrompt = async (sceneId: string) => {
    setRegeneratingId(sceneId)
    await new Promise((resolve) => setTimeout(resolve, 800))
    const updatedScenes = project.scenes.map((scene) =>
      scene.id === sceneId
        ? { ...scene, prompt: `${scene.title}에 대한 재생성된 프롬프트 - ${Date.now()}` }
        : scene
    )
    setProject({ ...project, scenes: updatedScenes })
    setRegeneratingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">스토리보드</h2>
        <p className="text-sm text-muted-foreground">
          이미지 생성 전에 씬을 검토하고 편집하세요.
        </p>
      </div>

      {/* Summary Bar */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-xs">
                {project.scenes.length}개 씬
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                약 {totalDuration}초
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleAddScene}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>씬 추가</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Scene List */}
      <div className="space-y-3">
        {project.scenes.map((scene, index) => (
          <Card key={scene.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                {project.mode === "advanced" && (
                  <div className="pt-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </div>
                )}
                
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium flex-shrink-0">
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium">{scene.title}</h4>
                    <span className="text-xs text-muted-foreground">{scene.duration}초</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{scene.description}</p>
                  
                  {project.mode === "advanced" && (
                    <div className="bg-muted/50 rounded p-2 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">생성 프롬프트:</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleRegeneratePrompt(scene.id)}
                              disabled={regeneratingId === scene.id}
                            >
                              <RefreshCw className={cn("h-3 w-3", regeneratingId === scene.id && "animate-spin")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>프롬프트 재생성</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{scene.prompt}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditScene(scene)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>씬 편집</TooltipContent>
                  </Tooltip>
                  
                  {project.scenes.length > 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteScene(scene.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>씬 삭제</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>씬 편집</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">제목</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
            {project.mode === "advanced" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">이미지 프롬프트</label>
                <Textarea
                  value={editForm.prompt}
                  onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">재생 시간 (초)</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editForm.duration}
                onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 3 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveEdit}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={onNext} className="h-8">
          이미지 생성
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </div>
    </div>
  )
}
