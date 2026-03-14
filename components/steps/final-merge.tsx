"use client"

import type { ProjectState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  Play,
  RefreshCw,
  Check,
  Loader2,
  Music,
  Clock,
  Film,
  Share2,
  RotateCcw,
  Volume2,
} from "lucide-react"
import { useState } from "react"

interface FinalMergeProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onBack: () => void
  onRestart: () => void
}

export function FinalMerge({ project, setProject, onBack, onRestart }: FinalMergeProps) {
  const [isMerging, setIsMerging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState(0)
  const [isMerged, setIsMerged] = useState(false)

  // Settings
  const [addMusic, setAddMusic] = useState(true)
  const [musicTrack, setMusicTrack] = useState("epic-orchestral")
  const [musicVolume, setMusicVolume] = useState(70)
  const [transition, setTransition] = useState("crossfade")
  const [outputQuality, setOutputQuality] = useState("1080p")

  const videosReady = project.scenes.filter((s) => s.videoUrl).length
  const totalDuration = project.scenes.reduce((sum, s) => sum + s.duration, 0)

  const handleMerge = async () => {
    setIsMerging(true)
    setMergeProgress(0)

    for (let i = 0; i <= 100; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      setMergeProgress(i)
    }

    if (project.id) {
      const mockFinalVideoUrl = "/final-video-merged.mp4"
      try {
        await fetch(`http://localhost:8080/api/projects/${project.id}/video?finalVideoUrl=${encodeURIComponent(mockFinalVideoUrl)}`, {
          method: "PATCH"
        })
      } catch (error) {
        console.error("Error saving final video:", error)
      }
    }

    setIsMerging(false)
    setIsMerged(true)
  }

  const handleDownload = () => {
    alert("다운로드가 시작되었습니다! (프로토타입)")
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">최종 병합</h2>
        <p className="text-sm text-muted-foreground">
          영상 클립을 하나로 합치고 배경음악과 전환 효과를 추가하세요.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="flex items-center justify-center gap-2 text-xl font-semibold">
                <Film className="h-5 w-5 text-muted-foreground" />
                {videosReady}
              </div>
              <p className="text-xs text-muted-foreground">영상 클립</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="flex items-center justify-center gap-2 text-xl font-semibold">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {totalDuration}초
              </div>
              <p className="text-xs text-muted-foreground">총 재생시간</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="flex items-center justify-center gap-2 text-xl font-semibold">
                {isMerged ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isMerged ? "완료!" : "대기 중"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scene Timeline Preview */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">타임라인 미리보기</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {project.scenes.map((scene, index) => (
              <div key={String(scene.id)} className="flex-shrink-0 w-20">
                <div className="aspect-video bg-muted rounded overflow-hidden mb-1">
                  {scene.imageUrl ? (
                    <img
                      src={scene.imageUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Film className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-center truncate">{scene.title}</p>
                <p className="text-xs text-center text-muted-foreground">{scene.duration}초</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Music Settings */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Music className="h-3.5 w-3.5" />
              배경음악
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm">음악 추가</label>
              <Switch checked={addMusic} onCheckedChange={setAddMusic} />
            </div>

            {addMusic && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium">음악 트랙</label>
                  <Select value={musicTrack} onValueChange={setMusicTrack}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="epic-orchestral">웅장한 오케스트라</SelectItem>
                      <SelectItem value="emotional-piano">감성 피아노</SelectItem>
                      <SelectItem value="upbeat-electronic">업비트 일렉트로닉</SelectItem>
                      <SelectItem value="ambient-chill">앰비언트 칠</SelectItem>
                      <SelectItem value="dramatic-tension">드라마틱 텐션</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Volume2 className="h-3 w-3" />
                      볼륨: {musicVolume}%
                    </label>
                  </div>
                  <Slider
                    value={[musicVolume]}
                    onValueChange={([v]) => setMusicVolume(v)}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Output Settings */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">출력 설정</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">전환 스타일</label>
              <Select value={transition} onValueChange={setTransition}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crossfade">크로스페이드</SelectItem>
                  <SelectItem value="cut">하드 컷</SelectItem>
                  <SelectItem value="fade-black">페이드 투 블랙</SelectItem>
                  <SelectItem value="slide">슬라이드</SelectItem>
                  <SelectItem value="none">없음</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">출력 품질</label>
              <Select value={outputQuality} onValueChange={setOutputQuality}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p HD</SelectItem>
                  <SelectItem value="1080p">1080p Full HD</SelectItem>
                  <SelectItem value="4k">4K Ultra HD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Merge Progress / Actions */}
      <Card>
        <CardContent className="py-4">
          {isMerging ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">영상 클립 병합 중...</span>
                </div>
                <span className="text-xs text-muted-foreground">{mergeProgress}%</span>
              </div>
              <Progress value={mergeProgress} className="h-1.5" />
            </div>
          ) : isMerged ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">영상 준비 완료!</span>
              </div>

              {/* Video Preview Placeholder */}
              <div className="aspect-video bg-muted rounded flex items-center justify-center">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-foreground/10 flex items-center justify-center mx-auto mb-2">
                    <Play className="h-6 w-6 ml-0.5" />
                  </div>
                  <p className="text-xs text-muted-foreground">클릭하여 미리보기</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="flex-1" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      다운로드
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>영상 파일 다운로드</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>공유하기</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsMerged(false)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>다시 병합</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={handleMerge}>
              <Film className="h-4 w-4 mr-2" />
              최종 영상 생성
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
          영상 생성으로 돌아가기
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onRestart} className="h-8">
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              새 프로젝트 시작
            </Button>
          </TooltipTrigger>
          <TooltipContent>처음부터 새 영상 만들기</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
