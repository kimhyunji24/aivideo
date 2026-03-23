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
  RefreshCw,
  Check,
  Loader2,
  Music,
  Clock,
  Film,
  RotateCcw,
  Volume2,
  CheckSquare,
  Square,
  Merge,
} from "lucide-react"
import { useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface FinalMergeProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onBack: () => void
  onRestart: () => void
  sessionId?: string | null
}

type MergeStatus = "idle" | "processing" | "completed" | "error"

export function FinalMerge({ project, setProject, onBack, onRestart, sessionId }: FinalMergeProps) {
  const mergeBase = sessionId
    ? `/api/v1/sessions/${encodeURIComponent(sessionId)}/merge`
    : null

  // 씬 선택
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set())

  // 병합 상태
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>("idle")
  const [mergeJobId, setMergeJobId] = useState<string | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const mergeVideoRef = useRef<HTMLVideoElement>(null)

  // 출력 설정
  const [addMusic, setAddMusic] = useState(false)
  const [musicVolume, setMusicVolume] = useState(70)
  const [transition, setTransition] = useState("crossfade")

  const scenesWithVideo = project.scenes.filter((s) => s.videoUrl)
  const mergeClipDurationSeconds = 8
  const totalDuration = scenesWithVideo.length * mergeClipDurationSeconds

  const toggleSceneSelection = (sceneId: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev)
      next.has(sceneId) ? next.delete(sceneId) : next.add(sceneId)
      return next
    })
  }

  const selectAll = () => {
    setSelectedSceneIds(new Set(scenesWithVideo.map(s => String(s.id))))
  }

  const startMerge = async () => {
    if (!mergeBase || selectedSceneIds.size < 2) return

    const orderedIds = project.scenes
      .filter(s => selectedSceneIds.has(String(s.id)))
      .map(s => String(s.id))

    setMergeStatus("processing")
    setMergeError(null)
    setMergeJobId(null)

    try {
      const res = await fetch(mergeBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIds: orderedIds,
          transitionType: transition,
          transitionDuration: transition === "cut" || transition === "none" ? 0 : 1.0,
        }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `요청 실패 (${res.status})`))
      const data = await res.json()
      setMergeJobId(data.jobId)
      pollStatus(data.jobId)
    } catch (e: unknown) {
      setMergeStatus("error")
      setMergeError(e instanceof Error ? e.message : "병합 요청 중 오류가 발생했습니다.")
    }
  }

  const pollStatus = (jobId: string) => {
    if (!mergeBase) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${mergeBase}/${encodeURIComponent(jobId)}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === "completed") {
          clearInterval(interval)
          setMergeStatus("completed")
        } else if (data.status === "error") {
          clearInterval(interval)
          setMergeStatus("error")
          setMergeError(data.errorMessage || "병합 중 오류가 발생했습니다.")
        }
      } catch {
        clearInterval(interval)
        setMergeStatus("error")
        setMergeError("상태 조회 중 네트워크 오류가 발생했습니다.")
      }
    }, 3000)
  }

  const downloadVideo = () => {
    if (!mergeBase || !mergeJobId) return
    const a = document.createElement("a")
    a.href = `${mergeBase}/${encodeURIComponent(mergeJobId)}/video?download=true`
    a.download = "merged.mp4"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 px-4 sm:px-0 animate-fade-up">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-black">최종 병합</h2>
        <p className="text-sm text-muted-foreground">
          영상 클립을 선택하고 하나로 합치세요
        </p>
      </div>

      {/* Summary */}
      <Card className="glass-surface">
        <CardContent className="py-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="flex items-center justify-center gap-2 text-xl font-semibold">
                <Film className="h-5 w-5 text-muted-foreground" />
                {scenesWithVideo.length}
              </div>
              <p className="text-xs text-muted-foreground">완료된 클립</p>
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
                {mergeStatus === "completed"
                  ? <Check className="h-5 w-5" />
                  : <span className="text-muted-foreground text-base">{selectedSceneIds.size}</span>
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {mergeStatus === "completed" ? "완료!" : "선택된 씬"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 씬 선택 */}
      <Card className="glass-surface">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">병합할 씬 선택</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
              전체 선택
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {scenesWithVideo.length === 0 ? (
              <p className="text-xs text-muted-foreground">완료된 영상 클립이 없습니다.</p>
            ) : (
              scenesWithVideo.map((scene, index) => {
                const sid = String(scene.id)
                const selected = selectedSceneIds.has(sid)
                return (
                  <button
                    key={sid}
                    onClick={() => toggleSceneSelection(sid)}
                    className={cn(
                      "flex-shrink-0 w-24 rounded-lg p-1.5 border-2 transition-all text-left",
                      selected ? "border-black bg-black/5" : "border-transparent"
                    )}
                  >
                    <div className="aspect-video bg-muted rounded overflow-hidden mb-1 relative">
                      {scene.imageUrl ? (
                        <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-1 right-1">
                        {selected
                          ? <CheckSquare className="h-3.5 w-3.5 text-black drop-shadow" />
                          : <Square className="h-3.5 w-3.5 text-white drop-shadow" />
                        }
                      </div>
                    </div>
                    <p className="text-xs truncate font-medium">씬 {index + 1}</p>
                    <p className="text-[10px] text-muted-foreground">{mergeClipDurationSeconds}초</p>
                  </button>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* 출력 설정 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-surface">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Music className="h-3.5 w-3.5" />
              배경음악 <span className="text-[10px] text-muted-foreground font-normal">(준비 중)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm">음악 추가</label>
              <Switch checked={addMusic} onCheckedChange={setAddMusic} disabled />
            </div>
            {addMusic && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    볼륨: {musicVolume}%
                  </label>
                </div>
                <Slider value={[musicVolume]} onValueChange={([v]) => setMusicVolume(v)} max={100} step={5} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">전환 효과</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <Select value={transition} onValueChange={setTransition}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crossfade">크로스페이드</SelectItem>
                <SelectItem value="fadeblack">페이드 투 블랙</SelectItem>
                <SelectItem value="slideleft">슬라이드</SelectItem>
                <SelectItem value="cut">하드 컷</SelectItem>
                <SelectItem value="none">없음</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* 병합 액션 */}
      <Card className="glass-surface">
        <CardContent className="py-4">
          {mergeStatus === "processing" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              영상을 병합하는 중입니다… (시간이 걸릴 수 있습니다)
            </div>
          ) : mergeStatus === "completed" && mergeJobId && mergeBase ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">영상 준비 완료!</span>
              </div>
              <video
                ref={mergeVideoRef}
                src={`${mergeBase}/${encodeURIComponent(mergeJobId)}/video`}
                controls
                preload="metadata"
                className="w-full rounded-lg bg-black aspect-video"
              />
              <div className="flex gap-2">
                <Button className="flex-1 bg-black hover:bg-gray-800 text-white press-down" onClick={downloadVideo}>
                  <Download className="h-4 w-4 mr-2" />
                  다운로드
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => { setMergeStatus("idle"); setMergeJobId(null) }}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>다시 병합</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full bg-black hover:bg-gray-800 text-white press-down btn-unified"
                disabled={selectedSceneIds.size < 2 || !mergeBase}
                onClick={startMerge}
              >
                <Merge className="h-4 w-4 mr-2" />
                최종 영상 생성 {selectedSceneIds.size >= 2 ? `(${selectedSceneIds.size}개 씬)` : ""}
              </Button>
              {mergeStatus === "error" && mergeError && (
                <p className="text-xs text-destructive text-center">{mergeError}</p>
              )}
              {selectedSceneIds.size < 2 && (
                <p className="text-xs text-muted-foreground text-center">씬을 2개 이상 선택해주세요</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 press-down">
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
