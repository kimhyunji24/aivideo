"use client"

import type { ProjectState, Plot } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, RefreshCw, Pencil, ArrowRight, Film, CircleCheck } from "lucide-react"
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
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [customPlot, setCustomPlot] = useState("")
  const [isRegenerating, setIsRegenerating] = useState(false)

  const handleSelectPlot = (plot: Plot) => {
    setSelectedId(plot.id)
    setProject({
      ...project,
      selectedPlot: plot,
      scenes: plot.scenes,
    })
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsRegenerating(false)
  }

  const handleContinue = () => {
    if (selectedId) {
      onNext()
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">플롯 선택</h2>
        <p className="text-sm text-muted-foreground">
          AI가 생성한 플롯 중 하나를 선택하거나 직접 작성하세요.
        </p>
      </div>

      {/* Original Idea Reference */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">원본 아이디어:</p>
              <p className="text-sm truncate">{project.idea}</p>
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
              "cursor-pointer transition-all hover:shadow-sm",
              selectedId === plot.id && "ring-1 ring-foreground"
            )}
            onClick={() => handleSelectPlot(plot)}
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <h3 className="text-sm font-medium">{plot.title}</h3>
                    <Badge variant="secondary" className="text-xs">{plot.tone}</Badge>
                    <Badge variant="outline" className="text-xs">{plot.sceneCount}개 씬</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{plot.summary}</p>
                  
                  {/* Scene Preview - Advanced Mode */}
                  {project.mode === "advanced" && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">씬 구성:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {plot.scenes.map((scene, index) => (
                          <Badge key={scene.id} variant="outline" className="text-xs font-normal">
                            {index + 1}. {scene.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-shrink-0">
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
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="h-8"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRegenerating && "animate-spin")} />
              {isRegenerating ? "재생성 중..." : "다른 옵션 생성"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>모든 플롯 옵션 재생성</TooltipContent>
        </Tooltip>
        
        {project.mode === "advanced" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomizing(!isCustomizing)}
                className="h-8"
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                직접 작성
              </Button>
            </TooltipTrigger>
            <TooltipContent>나만의 플롯 직접 작성</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Custom Plot Input (Advanced Mode) */}
      {isCustomizing && project.mode === "advanced" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">커스텀 플롯</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="플롯 구조, 주요 장면, 전체적인 흐름을 설명해주세요..."
              value={customPlot}
              onChange={(e) => setCustomPlot(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <Button size="sm" disabled={!customPlot.trim()} className="h-8">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              커스텀 플롯으로 씬 생성
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          이전
        </Button>
        <Button size="sm" onClick={handleContinue} disabled={!selectedId} className="h-8">
          스토리보드로 계속
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function Sparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}
