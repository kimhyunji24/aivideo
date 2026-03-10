"use client"

import type { ProjectState, Plot, Scene } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sparkles, Lightbulb, ArrowRight } from "lucide-react"
import { useState } from "react"

interface IdeaInputProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
}

const EXAMPLE_IDEAS = [
  "A romantic reunion between two characters from my favorite anime",
  "An epic battle scene with dramatic music and effects",
  "A peaceful slice-of-life moment in a fantasy world",
  "A music video tribute to a beloved character",
]

function generateMockPlots(idea: string): Plot[] {
  const createScenes = (plotId: string, sceneCount: number): Scene[] => {
    return Array.from({ length: sceneCount }, (_, i) => ({
      id: `${plotId}-scene-${i + 1}`,
      title: `Scene ${i + 1}`,
      description: `Auto-generated scene description for scene ${i + 1}`,
      prompt: `Scene ${i + 1} prompt based on the idea`,
      duration: 3,
      status: "pending" as const,
    }))
  }

  return [
    {
      id: "plot-1",
      title: "Dramatic Narrative",
      summary: `A dramatic interpretation of "${idea}" with emotional highs and lows, focusing on character depth and visual storytelling.`,
      tone: "Dramatic / Emotional",
      scenes: createScenes("plot-1", 5),
    },
    {
      id: "plot-2",
      title: "Action-Packed Version",
      summary: `An action-oriented take on "${idea}" with dynamic camera movements and exciting visual sequences.`,
      tone: "Energetic / Exciting",
      scenes: createScenes("plot-2", 6),
    },
    {
      id: "plot-3",
      title: "Atmospheric & Cinematic",
      summary: `A slow-burn cinematic approach to "${idea}" emphasizing mood, atmosphere, and artistic visuals.`,
      tone: "Cinematic / Artistic",
      scenes: createScenes("plot-3", 4),
    },
  ]
}

export function IdeaInput({ project, setProject, onNext }: IdeaInputProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!project.idea.trim()) return

    setIsGenerating(true)
    // Simulate AI generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    const plots = generateMockPlots(project.idea)
    setProject({
      ...project,
      generatedPlots: plots,
    })
    setIsGenerating(false)
    onNext()
  }

  const handleExampleClick = (example: string) => {
    setProject({ ...project, idea: example })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">What video do you want to create?</h2>
        <p className="text-muted-foreground">
          Describe your idea in a few sentences. The AI will generate plot options for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Your Idea
          </CardTitle>
          <CardDescription>
            {project.mode === "beginner" 
              ? "Just describe what you want to see. Keep it simple!"
              : "Be as detailed as you like. Include characters, mood, setting, and style."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea">Video Concept</Label>
            <Textarea
              id="idea"
              placeholder="Example: A dramatic scene where two rivals finally meet after years apart, with rain and dramatic lighting..."
              value={project.idea}
              onChange={(e) => setProject({ ...project, idea: e.target.value })}
              rows={4}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!project.idea.trim() || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                Generating Plot Options...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Plot Options
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Example Ideas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need inspiration?</CardTitle>
          <CardDescription>Click an example to use it as a starting point</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {EXAMPLE_IDEAS.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-3 rounded-lg border hover:bg-muted transition-colors text-sm"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
