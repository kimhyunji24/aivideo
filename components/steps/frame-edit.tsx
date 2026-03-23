"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Edit3, Image as ImageIcon, Sparkles, Loader2, Pencil, Wand2, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, Frame } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MaskCanvas } from "@/components/ui/mask-canvas"
import { CharacterRefPanel } from "@/components/steps/character-ref-panel"

interface FrameEditProps {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  sceneIndex: number
  onComplete: () => void
  onBack: () => void
  onNext: () => void
  selectedFrameIndex?: number
  onSelectedFrameIndexChange?: (index: number) => void
  sessionId?: string | null
}

type GenStatus = "idle" | "generating" | "done" | "error"

export function FrameEdit({
  project,
  setProject,
  sceneIndex,
  onComplete,
  onBack,
  onNext,
  sessionId,
}: FrameEditProps) {
  const safeScenes = Array.isArray(project?.scenes) ? project.scenes : []
  const scene = safeScenes[sceneIndex]
  if (!scene) return null

  const BASE = sessionId
    ? `/api/v1/sessions/${encodeURIComponent(sessionId)}`
    : null

  // Start / End frame 상태
  const frames = scene.frames ?? []
  const startFrame: Frame = frames[0] ?? { id: `f-start-${Date.now()}`, script: scene.description || "", imageUrl: undefined }
  const endFrame: Frame   = frames[1] ?? { id: `f-end-${Date.now()}`,   script: "", imageUrl: undefined }

  const [startScript, setStartScript] = useState(startFrame.script || scene.description || "")
  const [endScript, setEndScript]     = useState(endFrame.script || "")

  const [splitLoading, setSplitLoading] = useState(false)
  const [splitError, setSplitError]     = useState<string | null>(null)

  const [startStatus, setStartStatus] = useState<GenStatus>("idle")
  const [endStatus, setEndStatus]     = useState<GenStatus>("idle")
  const [genError, setGenError]       = useState<string | null>(null)

  // 부분수정 / 자세변경 다이얼로그
  const [editTarget, setEditTarget]         = useState<"start" | "end" | null>(null)
  const [regenTarget, setRegenTarget]       = useState<"start" | "end" | null>(null)
  const [regenPrompt, setRegenPrompt]       = useState("")

  const hasCharacters = (project.characters ?? []).length > 0

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────

  const readError = async (res: Response) => {
    try {
      const j = await res.json()
      const msg = j?.userMessage || j?.message || ""
      return msg || `요청 실패 (${res.status})`
    } catch {
      return `요청 실패 (${res.status})`
    }
  }

  const syncSession = async () => {
    if (!BASE) return
    try {
      await fetch(`${BASE}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
    } catch { /* silent */ }
  }

  const updateFrameInProject = (which: "start" | "end", updatedFrame: Frame) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const fs = s.frames ? [...s.frames] : [
          { id: startFrame.id, script: startScript, imageUrl: startFrame.imageUrl },
          { id: endFrame.id,   script: endScript,   imageUrl: endFrame.imageUrl },
        ]
        if (which === "start") {
          fs[0] = updatedFrame
          return { ...s, frames: fs, imageUrl: updatedFrame.imageUrl || s.imageUrl }
        } else {
          if (fs.length < 2) fs.push(updatedFrame)
          else fs[1] = updatedFrame
          return { ...s, frames: fs }
        }
      }),
    }))
  }

  // ── AI 분리 ──────────────────────────────────────────────────────────────

  const handleSplit = async () => {
    if (!BASE) return
    setSplitLoading(true)
    setSplitError(null)
    try {
      const res = await fetch(`${BASE}/generation/frames/${encodeURIComponent(String(scene.id ?? sceneIndex))}/split`, {
        method: "POST",
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = await res.json()
      setStartScript(data.startScript || "")
      setEndScript(data.endScript || "")
    } catch (e: unknown) {
      setSplitError(e instanceof Error ? e.message : "분리 중 오류가 발생했습니다.")
    } finally {
      setSplitLoading(false)
    }
  }

  // ── 프레임 생성 ───────────────────────────────────────────────────────────

  const generateFrame = async (which: "start" | "end", frameId: string, script: string): Promise<Frame | null> => {
    if (!BASE || !script.trim()) return null
    const sceneId = String(scene.id ?? sceneIndex)
    const res = await fetch(`${BASE}/generation/frames/${encodeURIComponent(sceneId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameId, script: script.trim() }),
    })
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }

  const handleGenerateBoth = async () => {
    if (!BASE) return
    if (!startScript.trim()) { setGenError("Start Frame 스크립트를 입력해주세요."); return }
    if (!endScript.trim())   { setGenError("End Frame 스크립트를 입력해주세요."); return }
    setGenError(null)

    // 먼저 최신 스크립트를 세션에 동기화
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const newFrames: Frame[] = [
          { id: startFrame.id, script: startScript, imageUrl: startFrame.imageUrl },
          { id: endFrame.id,   script: endScript,   imageUrl: endFrame.imageUrl },
        ]
        return { ...s, frames: newFrames }
      }),
    }))
    await syncSession()

    // Start Frame 생성
    setStartStatus("generating")
    try {
      const sf = await generateFrame("start", startFrame.id, startScript)
      if (sf) {
        updateFrameInProject("start", sf)
        setStartStatus("done")
      }
    } catch (e: unknown) {
      setStartStatus("error")
      setGenError((e instanceof Error ? e.message : "") || "Start Frame 생성에 실패했습니다.")
      return
    }

    // End Frame 자동 연속 생성
    setEndStatus("generating")
    try {
      const ef = await generateFrame("end", endFrame.id, endScript)
      if (ef) {
        updateFrameInProject("end", ef)
        setEndStatus("done")
      }
    } catch (e: unknown) {
      setEndStatus("error")
      setGenError((e instanceof Error ? e.message : "") || "End Frame 생성에 실패했습니다.")
    }
  }

  const handleGenerateOne = async (which: "start" | "end") => {
    if (!BASE) return
    const script = which === "start" ? startScript : endScript
    const frame  = which === "start" ? startFrame  : endFrame
    if (!script.trim()) { setGenError(`${which === "start" ? "Start" : "End"} Frame 스크립트를 입력해주세요.`); return }
    setGenError(null)
    which === "start" ? setStartStatus("generating") : setEndStatus("generating")
    try {
      const result = await generateFrame(which, frame.id, script)
      if (result) {
        updateFrameInProject(which, result)
        which === "start" ? setStartStatus("done") : setEndStatus("done")
      }
    } catch (e: unknown) {
      which === "start" ? setStartStatus("error") : setEndStatus("error")
      setGenError((e instanceof Error ? e.message : "") || "생성에 실패했습니다.")
    }
  }

  // ── 자세/동작 변경 ─────────────────────────────────────────────────────────

  const handleRegen = async () => {
    if (!BASE || !regenTarget || !regenPrompt.trim()) return
    const frame = regenTarget === "start" ? startFrame : endFrame
    regenTarget === "start" ? setStartStatus("generating") : setEndStatus("generating")
    setRegenTarget(null)
    try {
      const res = await fetch(`${BASE}/generation/images/${encodeURIComponent(String(scene.id ?? sceneIndex))}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: frame.id, prompt: regenPrompt.trim() }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const updated = await res.json()
      updateFrameInProject(regenTarget!, updated)
      regenTarget === "start" ? setStartStatus("done") : setEndStatus("done")
      setRegenPrompt("")
    } catch (e: unknown) {
      regenTarget === "start" ? setStartStatus("error") : setEndStatus("error")
      setGenError((e instanceof Error ? e.message : "") || "재생성에 실패했습니다.")
    }
  }

  // ── 부분 수정 ──────────────────────────────────────────────────────────────

  const handleEdit = async (maskBase64: string) => {
    if (!BASE || !editTarget) return
    const frame = editTarget === "start" ? startFrame : endFrame
    if (!frame.imageUrl) return
    editTarget === "start" ? setStartStatus("generating") : setEndStatus("generating")
    setEditTarget(null)
    try {
      const res = await fetch(`${BASE}/generation/images/${encodeURIComponent(String(scene.id ?? sceneIndex))}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: frame.id, maskBase64, prompt: "" }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const updated = await res.json()
      updateFrameInProject(editTarget!, updated)
      editTarget === "start" ? setStartStatus("done") : setEndStatus("done")
    } catch (e: unknown) {
      editTarget === "start" ? setStartStatus("error") : setEndStatus("error")
      setGenError((e instanceof Error ? e.message : "") || "부분 수정에 실패했습니다.")
    }
  }

  const handleComplete = () => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex) return s
        const newFrames: Frame[] = [
          { id: startFrame.id, script: startScript, imageUrl: s.frames?.[0]?.imageUrl },
          { id: endFrame.id,   script: endScript,   imageUrl: s.frames?.[1]?.imageUrl },
        ]
        return { ...s, frames: newFrames, imageUrl: newFrames[0]?.imageUrl || s.imageUrl }
      }),
    }))
    onComplete()
  }

  const isGenerating = startStatus === "generating" || endStatus === "generating"

  // ── 프레임 카드 렌더러 ────────────────────────────────────────────────────

  const FrameCard = ({
    label, which, frame, script, setScript, status,
  }: {
    label: string
    which: "start" | "end"
    frame: Frame
    script: string
    setScript: (s: string) => void
    status: GenStatus
  }) => (
    <Card className="flex flex-col glass-card border-border/60 shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Badge variant={which === "start" ? "default" : "secondary"} className="text-xs">
              {label}
            </Badge>
            {status === "done" && <Check className="h-3.5 w-3.5 text-green-600" />}
            {status === "generating" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {status === "error" && <span className="text-xs text-destructive">오류</span>}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            disabled={isGenerating}
            onClick={() => handleGenerateOne(which)}
          >
            <Sparkles className="h-3 w-3" />
            단독 생성
          </Button>
        </div>
      </CardHeader>

      {/* 이미지 영역 */}
      <div className="relative mx-4 mb-3 bg-black/5 rounded-lg overflow-hidden flex items-center justify-center h-[150px]">
        {status === "generating" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-xs text-white mt-2">생성 중...</span>
          </div>
        ) : frame.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.imageUrl} alt={label} className="w-full h-full object-contain rounded-lg" />
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                onClick={() => { setRegenTarget(which); setRegenPrompt("") }}
              >
                <Sparkles className="h-3 w-3" />
                자세 변경
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                onClick={() => setEditTarget(which)}
              >
                <Pencil className="h-3 w-3" />
                부분 수정
              </Button>
            </div>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-black/5 transition-colors rounded-lg">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-1" />
            <span className="text-xs text-muted-foreground">클릭하여 이미지 업로드</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const url = typeof reader.result === "string" ? reader.result : undefined
                if (!url) return
                updateFrameInProject(which, { ...frame, imageUrl: url })
              }
              reader.readAsDataURL(file)
            }} />
          </label>
        )}
      </div>

      {/* 스크립트 */}
      <CardContent className="pt-0 px-4 pb-4">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">스크립트</label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={`${label} 장면을 묘사하세요...`}
          rows={3}
          className="text-sm resize-none"
        />
      </CardContent>
    </Card>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 text-sm font-semibold rounded-full">
            S#{sceneIndex + 1}
          </Badge>
          <h2 className="text-xl font-bold">{scene.title}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleComplete}
          className="gap-2 px-4 shadow-sm border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-black rounded-lg press-down"
        >
          <Edit3 className="h-4 w-4" />
          수정 완료
        </Button>
      </div>

      {/* AI 분리 버튼 */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 text-sm"
          disabled={splitLoading || isGenerating}
          onClick={handleSplit}
        >
          {splitLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          AI로 Start/End 스크립트 분리
        </Button>
        {splitError && <span className="text-xs text-destructive">{splitError}</span>}
        {genError   && <span className="text-xs text-destructive">{genError}</span>}
      </div>

      {/* 메인 레이아웃 */}
      <div className={cn(
        "flex-1 grid gap-4 min-h-0",
        hasCharacters ? "grid-cols-[260px_1fr_1fr]" : "grid-cols-1 md:grid-cols-2"
      )}>
        {/* 캐릭터 레퍼런스 패널 */}
        {hasCharacters && (
          <div className="rounded-xl border border-border/60 shadow-sm overflow-hidden flex flex-col">
            <CharacterRefPanel project={project} setProject={setProject} sessionId={sessionId} />
          </div>
        )}

        {/* Start Frame */}
        <FrameCard
          label="Start Frame"
          which="start"
          frame={{ ...startFrame, imageUrl: scene.frames?.[0]?.imageUrl }}
          script={startScript}
          setScript={setStartScript}
          status={startStatus}
        />

        {/* End Frame */}
        <FrameCard
          label="End Frame"
          which="end"
          frame={{ ...endFrame, imageUrl: scene.frames?.[1]?.imageUrl }}
          script={endScript}
          setScript={setEndScript}
          status={endStatus}
        />
      </div>

      {/* 하단 생성 버튼 */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 hover:text-black">
          ← 이전
        </Button>

        <Button
          className="flex-1 max-w-xs bg-black hover:bg-gray-800 text-white press-down btn-unified h-10 gap-2"
          disabled={isGenerating || (!startScript.trim() && !endScript.trim())}
          onClick={handleGenerateBoth}
        >
          {isGenerating
            ? <><Loader2 className="h-4 w-4 animate-spin" />생성 중...</>
            : <><Sparkles className="h-4 w-4" />Start → End 순차 생성</>
          }
        </Button>

        <Button variant="outline" size="sm" onClick={onNext} className="text-gray-700 hover:text-black">
          다음 →
        </Button>
      </div>

      {/* 자세/동작 변경 다이얼로그 */}
      <Dialog open={regenTarget !== null} onOpenChange={(open) => { if (!open) setRegenTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>자세/동작 변경</DialogTitle>
            <DialogDescription>원하는 새 자세나 동작을 설명해주세요. 얼굴과 의상은 유지됩니다.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={regenPrompt}
            onChange={(e) => setRegenPrompt(e.target.value)}
            placeholder="예: 팔짱을 끼고 당당하게 서있는 자세"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setRegenTarget(null)}>취소</Button>
            <Button disabled={!regenPrompt.trim()} onClick={handleRegen}>재생성</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 부분 수정 다이얼로그 */}
      {editTarget !== null && (() => {
        const editFrame = editTarget === "start"
          ? { ...startFrame, imageUrl: scene.frames?.[0]?.imageUrl }
          : { ...endFrame,   imageUrl: scene.frames?.[1]?.imageUrl }
        return editFrame.imageUrl ? (
          <Dialog open onOpenChange={() => setEditTarget(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>부분 수정</DialogTitle>
                <DialogDescription>수정할 영역을 마스크로 칠하세요.</DialogDescription>
              </DialogHeader>
              <MaskCanvas
                imageUrl={editFrame.imageUrl}
                onConfirm={handleEdit}
                onCancel={() => setEditTarget(null)}
              />
            </DialogContent>
          </Dialog>
        ) : null
      })()}
    </div>
  )
}
