"use client"

import type { ProjectState, Plot, Scene } from "@/app/page"
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

function generateMockPlots(idea: string): Plot[] {
  const createScenes = (plotId: string, sceneCount: number): Scene[] => {
    const sceneTitles = [
      ["오프닝", "첫 만남", "전개", "클라이맥스", "엔딩"],
      ["시작", "긴장 고조", "대결", "반전", "결말", "에필로그"],
      ["도입", "분위기 조성", "전환점", "마무리"],
    ]
    const titles = sceneTitles[Math.floor(Math.random() * sceneTitles.length)]
    
    return Array.from({ length: sceneCount }, (_, i) => ({
      id: `${plotId}-scene-${i + 1}`,
      title: titles[i] || `씬 ${i + 1}`,
      description: `"${idea}"를 기반으로 한 자동 생성된 씬 설명`,
      prompt: `${idea}에 대한 씬 ${i + 1} 프롬프트`,
      duration: 3,
      status: "pending" as const,
    }))
  }

  return [
    {
      id: "plot-1",
      title: "드라마틱 내러티브",
      summary: `"${idea}"의 감정적인 해석으로, 캐릭터의 깊이와 시각적 스토리텔링에 초점을 맞춘 드라마틱한 전개`,
      tone: "드라마틱 / 감성적",
      sceneCount: 5,
      scenes: createScenes("plot-1", 5),
    },
    {
      id: "plot-2",
      title: "액션 중심 버전",
      summary: `"${idea}"의 역동적인 해석으로, 다이나믹한 카메라 워크와 흥미진진한 시각적 시퀀스 중심`,
      tone: "에너지틱 / 역동적",
      sceneCount: 6,
      scenes: createScenes("plot-2", 6),
    },
    {
      id: "plot-3",
      title: "분위기 있는 시네마틱",
      summary: `"${idea}"의 슬로우번 시네마틱 접근으로, 분위기와 예술적 비주얼을 강조`,
      tone: "시네마틱 / 예술적",
      sceneCount: 4,
      scenes: createScenes("plot-3", 4),
    },
  ]
}

export function IdeaInput({ project, setProject, onNext }: IdeaInputProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!project.idea.trim()) return

    setIsGenerating(true)
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
