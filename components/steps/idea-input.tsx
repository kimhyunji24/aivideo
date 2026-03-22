"use client"

import type { ProjectState, Plot } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles, ArrowRight, Lightbulb } from "lucide-react"
import { useState } from "react"

interface IdeaInputProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onNext: () => void
}

const EXAMPLE_IDEAS = [
  "내가 좋아하는 애니메이션 캐릭터들의 로맨틱한 재회 장면",
  "드라마틱한 배경음악과 함께하는 화려한 액션 배틀 씬",
  "판타지 세계에서의 평화로운 일상 모먼트",
  "사랑받는 캐릭터를 위한 뮤직비디오 트리뷰트",
]

export function IdeaInput({ project, setProject, onNext }: IdeaInputProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!project.idea.trim()) return

    setIsGenerating(true)
    try {
      const response = await fetch("/api/plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project.idea),
      })

      if (!response.ok) throw new Error("API call failed")

      const plots: Plot[] = await response.json()
      setProject({
        ...project,
        generatedPlots: plots,
        selectedPlot: null,
        scenes: [],
      })
      onNext()
    } catch (error) {
      console.error("Plot generation failed:", error)
      // 에러 처리 필요시 여기에 추가
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setProject({ ...project, idea: example })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">어떤 영상을 만들고 싶으신가요?</h2>
        <p className="text-sm text-muted-foreground">
          아이디어를 간단히 설명해주세요. AI가 플롯 옵션을 생성해드립니다.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            아이디어
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="예시: 오랜 시간이 지난 후 두 라이벌이 드디어 만나는 드라마틱한 장면, 비가 내리고 극적인 조명..."
            value={project.idea}
            onChange={(e) => setProject({ ...project, idea: e.target.value })}
            rows={4}
            className="resize-none text-sm"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleGenerate}
                disabled={!project.idea.trim() || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                    플롯 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    플롯 옵션 생성
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI가 여러 플롯 옵션을 생성합니다</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      {/* Example Ideas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">영감이 필요하신가요?</CardTitle>
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
