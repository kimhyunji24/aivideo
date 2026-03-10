"use client"

import type { ProjectState, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowRight, Edit2, Trash2, Plus, GripVertical, Clock, RefreshCw } from "lucide-react"
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
  const [editForm, setEditForm] = useState({ title: "", description: "", prompt: "", duration: 3 })

  const totalDuration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0)

  const handleEditScene = (scene: Scene) => {
    setEditingScene(scene)
    setEditForm({
      title: scene.title,
      description: scene.description,
      prompt: scene.prompt,
      duration: scene.duration,
    })
  }

  const handleSaveEdit = () => {
    if (!editingScene) return

    const updatedScenes = project.scenes.map((scene) =>
      scene.id === editingScene.id
        ? { ...scene, ...editForm }
        : scene
    )
    setProject({ ...project, scenes: updatedScenes })
    setEditingScene(null)
  }

  const handleDeleteScene = (sceneId: string) => {
    const updatedScenes = project.scenes.filter((scene) => scene.id !== sceneId)
    setProject({ ...project, scenes: updatedScenes })
  }

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      title: `Scene ${project.scenes.length + 1}`,
      description: "New scene description",
      prompt: "New scene prompt",
      duration: 3,
      status: "pending",
    }
    setProject({ ...project, scenes: [...project.scenes, newScene] })
  }

  const handleRegeneratePrompt = async (sceneId: string) => {
    // Simulate AI regeneration
    await new Promise((resolve) => setTimeout(resolve, 800))
    const updatedScenes = project.scenes.map((scene) =>
      scene.id === sceneId
        ? { ...scene, prompt: `Regenerated prompt for ${scene.title} - ${Date.now()}` }
        : scene
    )
    setProject({ ...project, scenes: updatedScenes })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Storyboard</h2>
        <p className="text-muted-foreground">
          Review and edit your scenes before generating images.
        </p>
      </div>

      {/* Summary Bar */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {project.scenes.length} Scenes
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                ~{totalDuration} seconds total
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleAddScene}>
                <Plus className="h-4 w-4 mr-1" />
                Add Scene
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scene List */}
      <div className="space-y-4">
        {project.scenes.map((scene, index) => (
          <Card key={scene.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {project.mode === "advanced" && (
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  )}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <CardTitle className="text-base">{scene.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{scene.duration}s duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleEditScene(scene)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Scene</DialogTitle>
                        <DialogDescription>
                          Modify the scene details and prompt for image generation.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-title">Title</Label>
                          <Input
                            id="edit-title"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-description">Description</Label>
                          <Textarea
                            id="edit-description"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={2}
                          />
                        </div>
                        {project.mode === "advanced" && (
                          <div className="space-y-2">
                            <Label htmlFor="edit-prompt">Image Prompt</Label>
                            <Textarea
                              id="edit-prompt"
                              value={editForm.prompt}
                              onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                              rows={3}
                              className="font-mono text-sm"
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="edit-duration">Duration (seconds)</Label>
                          <Input
                            id="edit-duration"
                            type="number"
                            min={1}
                            max={10}
                            value={editForm.duration}
                            onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 3 })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {project.scenes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteScene(scene.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{scene.description}</p>
              
              {project.mode === "advanced" && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Generated Prompt:</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleRegeneratePrompt(scene.id)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{scene.prompt}</p>
                </div>
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
        <Button size="lg" onClick={onNext}>
          Generate Images
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
