"use client"

import type { ProjectState, Plot } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, RefreshCw, Edit2, ArrowRight, Film } from "lucide-react"
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
    // In real app, would call AI to regenerate
    setIsRegenerating(false)
  }

  const handleContinue = () => {
    if (selectedId) {
      onNext()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Plot</h2>
        <p className="text-muted-foreground">
          Select one of the AI-generated plots, or customize your own.
        </p>
      </div>

      {/* Original Idea Reference */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your original idea:</p>
              <p className="text-sm font-medium">{project.idea}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plot Options */}
      <div className="grid gap-4 md:grid-cols-1">
        {project.generatedPlots.map((plot) => (
          <Card
            key={plot.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedId === plot.id && "ring-2 ring-primary"
            )}
            onClick={() => handleSelectPlot(plot)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{plot.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{plot.tone}</Badge>
                  <Badge variant="outline">{plot.scenes.length} scenes</Badge>
                  {selectedId === plot.id && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{plot.summary}</p>
              
              {/* Scene Preview */}
              {project.mode === "advanced" && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Scene breakdown:</p>
                  <div className="flex gap-2 flex-wrap">
                    {plot.scenes.map((scene, index) => (
                      <Badge key={scene.id} variant="outline" className="text-xs">
                        {index + 1}. {scene.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Regenerate & Custom Options */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex-1"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRegenerating && "animate-spin")} />
          {isRegenerating ? "Regenerating..." : "Generate Different Options"}
        </Button>
        
        {project.mode === "advanced" && (
          <Button
            variant="outline"
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="flex-1"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Write Custom Plot
          </Button>
        )}
      </div>

      {/* Custom Plot Input (Advanced Mode) */}
      {isCustomizing && project.mode === "advanced" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Plot</CardTitle>
            <CardDescription>
              Write your own plot outline. The AI will generate scenes based on your description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-plot">Plot Description</Label>
              <Textarea
                id="custom-plot"
                placeholder="Describe your plot structure, key moments, and the overall flow of the video..."
                value={customPlot}
                onChange={(e) => setCustomPlot(e.target.value)}
                rows={4}
              />
            </div>
            <Button disabled={!customPlot.trim()}>
              Generate Scenes from Custom Plot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!selectedId}
        >
          Continue to Storyboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
