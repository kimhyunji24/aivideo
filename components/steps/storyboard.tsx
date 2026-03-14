"use client"

import type { ProjectState, Scene } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sparkles,
  Settings2
} from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface StoryboardProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
  onBack: () => void
}

export function Storyboard({ project, setProject, onNext, onBack }: StoryboardProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Scene>>({
    title: "",
    description: "",
    prompt: "",
    duration: 3,
    elements: {
      mainCharacter: "",
      subCharacter: "",
      action: "",
      pose: "",
      background: "",
      time: "",
      composition: "",
      lighting: "",
      mood: "",
      story: "",
    }
  })
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const totalDuration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const selectedScene = project.scenes[selectedSceneIndex]

  const handleEditScene = (scene: Scene) => {
    setEditingScene(scene)
    setEditForm({
      title: scene.title,
      description: scene.description,
      prompt: scene.prompt,
      duration: scene.duration,
      elements: scene.elements ? { ...scene.elements } : {
        mainCharacter: "",
        subCharacter: "",
        action: "",
        pose: "",
        background: "",
        time: "",
        composition: "",
        lighting: "",
        mood: "",
        story: "",
      }
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingScene) return

    const applyLocal = () => {
      const updatedScenes = project.scenes.map((scene) =>
        scene.id === editingScene.id ? { ...scene, ...editForm } : scene
      )
      setProject({ ...project, scenes: updatedScenes })
      setEditDialogOpen(false)
      setEditingScene(null)
    }

    if (!project.id) {
      applyLocal()
      return
    }

    try {
      const response = await fetch(`http://localhost:8080/api/scenes/${editingScene.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        const updatedScene = await response.json()
        const updatedScenes = project.scenes.map((scene) =>
          scene.id === editingScene.id ? updatedScene : scene
        )
        setProject({ ...project, scenes: updatedScenes })
        setEditDialogOpen(false)
        setEditingScene(null)
      } else {
        console.error("Failed to update scene in backend")
        applyLocal()
      }
    } catch (error) {
      console.error("Error updating scene:", error)
      applyLocal()
    }
  }

  const handleDeleteScene = (sceneId: string) => {
    const updatedScenes = project.scenes.filter((scene) => scene.id !== sceneId)
    setProject({ ...project, scenes: updatedScenes })
    if (selectedSceneIndex >= updatedScenes.length) {
      setSelectedSceneIndex(Math.max(0, updatedScenes.length - 1))
    }
  }

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      title: `씬 ${project.scenes.length + 1}`,
      description: "새로운 씬 설명을 입력하세요",
      prompt: "새로운 씬에 대한 이미지 생성 프롬프트",
      duration: 3,
      status: "pending",
      elements: {
        mainCharacter: "",
        subCharacter: "",
        action: "",
        pose: "",
        background: "",
        time: "",
        composition: "",
        lighting: "",
        mood: "",
        story: "",
      }
    }
    setProject({ ...project, scenes: [...project.scenes, newScene] })
  }

  const handleRegenerateScene = async (sceneId: string) => {
    setRegeneratingId(sceneId)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const updatedScenes = project.scenes.map((scene) =>
      scene.id === sceneId
        ? {
          ...scene,
          description: `${scene.title}에 대한 새로운 설명 - 재생성됨`,
          prompt: `${scene.title}에 대한 재생성된 프롬프트 - ${Date.now()}`
        }
        : scene
    )
    setProject({ ...project, scenes: updatedScenes })
    setRegeneratingId(null)
  }

  const handleRegenerateAllScenes = async () => {
    setRegeneratingId("all")
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const updatedScenes = project.scenes.map((scene, index) => ({
      ...scene,
      description: `씬 ${index + 1}에 대한 새로운 설명`,
      prompt: `씬 ${index + 1}에 대한 재생성된 프롬프트 - ${Date.now()}`
    }))
    setProject({ ...project, scenes: updatedScenes })
    setRegeneratingId(null)
  }

  const pollSceneStatus = async (sceneId: string | number) => {
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
            setIsGeneratingImage(false)
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
        clearInterval(pollInterval)
        setIsGeneratingImage(false)
      }
    }, 2000)
  }

  const handleGenerateImage = async (sceneId: string | number) => {
    setIsGeneratingImage(true)
    try {
      const response = await fetch(`/api/generate-image?id=${sceneId}`, {
        method: "POST"
      })

      if (response.ok) {
        const initialScene = await response.json()
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map(s => s.id === sceneId ? initialScene : s)
        }))

        // 폴링 시작
        pollSceneStatus(sceneId)
      } else {
        setIsGeneratingImage(false)
      }
    } catch (error) {
      console.error("Generate image error:", error)
      setIsGeneratingImage(false)
    }
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">스토리보드</h2>
          <p className="text-sm text-muted-foreground">
            씬을 검토하고 편집한 후 이미지 생성을 시작하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Layers className="h-3 w-3" />
            {project.scenes.length}개 씬
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            약 {totalDuration}초
          </Badge>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Left: Scene List */}
        <div className="col-span-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">씬 목록</span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleRegenerateAllScenes}
                    disabled={regeneratingId === "all"}
                  >
                    <RefreshCw className={cn("h-3 w-3", regeneratingId === "all" && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>전체 씬 재생성</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddScene}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>씬 추가</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="space-y-2 pb-4">
              {project.scenes.map((scene, index) => (
                <Card
                  key={scene.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-sm glass-card",
                    selectedSceneIndex === index && "ring-1 ring-foreground/20 bg-accent/50"
                  )}
                  onClick={() => setSelectedSceneIndex(index)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {project.mode === "advanced" && (
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab mt-0.5 flex-shrink-0" />
                      )}

                      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-sm font-medium truncate">{scene.title}</h4>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{scene.duration}초</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRegenerateScene(String(scene.id))
                              }}
                              disabled={regeneratingId === scene.id}
                            >
                              <RefreshCw className={cn("h-3 w-3", regeneratingId === scene.id && "animate-spin")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>씬 재생성</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center: Scene Detail / Preview */}
        <div className="col-span-8 flex flex-col min-h-0">
          {selectedScene && (
            <>
              {/* Preview Area */}
              <div className="flex-1 min-h-0 mb-4">
                <Card className="h-full glass-card overflow-hidden">
                  <div className="h-full flex flex-col">
                    {/* Scene Preview Placeholder */}
                    <div className="flex-1 bg-muted/30 relative flex items-center justify-center pattern-dots">
                      {/* Geometric accent */}
                      <div className="accent-shape top-4 left-4 w-24 h-24 border-2 border-foreground rotate-12" />
                      <div className="accent-shape bottom-8 right-8 w-16 h-16 rounded-full border-2 border-foreground" />

                      <div className="text-center z-10">
                        <div className="w-16 h-16 rounded-xl bg-muted/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">이미지 생성 단계에서 미리보기가 표시됩니다</p>
                      </div>

                      {/* Navigation */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 glass-button"
                              onClick={() => setSelectedSceneIndex(Math.max(0, selectedSceneIndex - 1))}
                              disabled={selectedSceneIndex === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>이전 씬</TooltipContent>
                        </Tooltip>

                        <span className="text-sm font-medium px-3">
                          {selectedSceneIndex + 1} / {project.scenes.length}
                        </span>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 glass-button"
                              onClick={() => setSelectedSceneIndex(Math.min(project.scenes.length - 1, selectedSceneIndex + 1))}
                              disabled={selectedSceneIndex === project.scenes.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>다음 씬</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Scene Details & 10 Elements */}
              <div className="grid grid-cols-1 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <Tabs defaultValue="overview" className="w-full">
                      <div className="flex items-center justify-between mb-4">
                        <TabsList className="grid w-[400px] grid-cols-2">
                          <TabsTrigger value="overview">개요 및 편집</TabsTrigger>
                          <TabsTrigger value="elements">10대 핵심 제작 요소</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleGenerateImage(String(selectedScene.id))}
                            disabled={selectedScene.status === "generating"}
                            className="h-8 gap-2 bg-foreground text-background hover:bg-foreground/90"
                          >
                            {selectedScene.status === "generating" ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            이미지 생성 및 갱신
                          </Button>
                        </div>
                      </div>

                      <TabsContent value="overview" className="mt-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-base font-medium">{selectedScene.title}</h3>
                              <Badge variant="outline" className="text-xs">{selectedScene.duration}초</Badge>
                              {selectedScene.status === "done" && <Badge className="bg-green-500/10 text-green-500 border-green-500/20">생성 완료</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{selectedScene.description}</p>

                            {project.mode === "advanced" && (
                              <div className="bg-muted/30 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">AI 전용 영문 프롬프트 (자동 생성)</span>
                                </div>
                                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed italic">{selectedScene.prompt}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditScene(selectedScene)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {project.scenes.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteScene(String(selectedScene.id))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="elements" className="mt-0">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            { key: 'mainCharacter', label: '메인캐릭터', icon: '👤' },
                            { key: 'subCharacter', label: '보조캐릭터', icon: '👥' },
                            { key: 'action', label: '행동', icon: '🏃' },
                            { key: 'pose', label: '포즈', icon: '🧘' },
                            { key: 'background', label: '배경', icon: '🏞️' },
                            { key: 'time', label: '시간대', icon: '⏰' },
                            { key: 'composition', label: '구도', icon: '📷' },
                            { key: 'lighting', label: '조명', icon: '💡' },
                            { key: 'mood', label: '분위기', icon: '✨' },
                            { key: 'story', label: '스토리', icon: '📝' },
                          ].map((item) => (
                            <div key={item.key} className="space-y-1.5">
                              <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                <span>{item.icon}</span> {item.label}
                              </label>
                              <div className="h-8 px-2 rounded border bg-muted/20 text-xs flex items-center truncate">
                                {(selectedScene.elements as any)?.[item.key] || "미지정"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>씬 편집</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">기본 정보</label>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">제목</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">상황 설명</label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                {project.mode === "advanced" && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium">이미지 프롬프트 (Advanced)</label>
                    <Textarea
                      value={editForm.prompt}
                      onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                      rows={3}
                      className="font-mono text-[10px] resize-none"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">재생 시간 (초)</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 3 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-muted-foreground">10대 핵심 제작 요소</label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'mainCharacter', label: '메인캐릭터', placeholder: '주인공 이름 또는 특징' },
                  { key: 'background', label: '배경', placeholder: '장소 및 배경 특징' },
                  { key: 'action', label: '행동', placeholder: '수행 중인 동작' },
                  { key: 'lighting', label: '조명', placeholder: '광원 소스 및 종류' },
                  { key: 'mood', label: '분위기', placeholder: '전체적인 느낌' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <label className="text-[11px] font-medium">{item.label}</label>
                    <Input
                      value={(editForm.elements as any)[item.key]}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        elements: { ...editForm.elements, [item.key]: e.target.value } as any
                      })}
                      placeholder={item.placeholder}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                {/* 나머지 요소들 생략 (편의상 주요 5개만 먼저 노출하거나 스크롤 처리) */}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>저장 및 적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex justify-between pt-4 mt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={onNext} className="h-8">
          영상 생성으로 계속
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </div>
    </div>
  )
}
