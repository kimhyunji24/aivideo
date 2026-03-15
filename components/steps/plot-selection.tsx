"use client"

import type { ProjectState, Plot } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, RefreshCw, Pencil, ArrowRight, Film, Layers } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface PlotSelectionProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
  onBack: () => void
}

export function PlotSelection({ project, setProject, onNext, onBack }: PlotSelectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(project.selectedPlot?.id || null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratingPlotId, setRegeneratingPlotId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelectPlot = (plot: Plot) => {
    setSelectedId(plot.id)
    setProject({
      ...project,
      selectedPlot: plot,
      scenes: plot.scenes,
    })
  }

  const handleRegenerateAll = async () => {
    setIsRegenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsRegenerating(false)
  }

  const handleRegeneratePlot = async (plotId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRegeneratingPlotId(plotId)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRegeneratingPlotId(null)
  }

  const handleContinue = async () => {
    if (selectedId && project.selectedPlot) {
      setIsSaving(true)
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: project.idea,
            scenes: project.selectedPlot.scenes.map(s => ({
              title: s.title,
              description: s.description,
              prompt: s.prompt,
              duration: s.duration,
              elements: s.elements
            }))
          })
        })

        if (response.ok) {
          const savedProject = await response.json()
          setProject({
            ...project,
            id: savedProject.id,
            scenes: savedProject.scenes
          })
          onNext()
        } else {
          console.error("Failed to save project")
          // 에러 처리는 간소화 (필요시 토스트 추가 가능)
          onNext() // 데모 목적을 위해 실패해도 넘어감
        }
      } catch (error) {
        console.error("Error saving project:", error)
        onNext()
      } finally {
        setIsSaving(false)
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">플롯 선택</h2>
          <p className="text-sm text-muted-foreground">
            AI가 생성한 플롯 중 하나를 선택하세요
          </p>
        </div>
        <Badge variant="secondary" className="text-xs gap-1">
          <Layers className="h-3 w-3" />
          {project.generatedPlots.length}개 옵션
        </Badge>
      </div>

      {/* Original Idea Reference */}
      <Card className="glass-card">
        <CardContent className="py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">원본 아이디어</p>
              <p className="text-sm">{project.idea}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onBack}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>아이디어 수정</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Plot Options */}
      <div className="space-y-3">
        {project.generatedPlots.map((plot) => (
          <Card
            key={plot.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-sm glass-card group",
              selectedId === plot.id && "ring-1 ring-foreground/30 bg-accent/30"
            )}
            onClick={() => handleSelectPlot(plot)}
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <h3 className="text-sm font-medium">{plot.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">{plot.tone}</Badge>
                    <Badge variant="outline" className="text-[10px]">{plot.sceneCount}개 씬</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{plot.summary}</p>

                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Individual regenerate button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleRegeneratePlot(plot.id, e)}
                        disabled={regeneratingPlotId === plot.id}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", regeneratingPlotId === plot.id && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>이 플롯만 재생성</TooltipContent>
                  </Tooltip>

                  {/* Selection indicator */}
                  {selectedId === plot.id ? (
                    <div className="h-6 w-6 rounded-full bg-foreground flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-background" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border border-muted-foreground/30" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Regenerate & Custom Options */}
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateAll}
              disabled={isRegenerating}
              className="h-8"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRegenerating && "animate-spin")} />
              {isRegenerating ? "재생성 중..." : "전체 재생성"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>모든 플롯 옵션 재생성</TooltipContent>
        </Tooltip>

      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={handleContinue} disabled={!selectedId || isSaving} className="h-8">
          {isSaving ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              스토리보드로 계속
              <ArrowRight className="h-3.5 w-3.5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
