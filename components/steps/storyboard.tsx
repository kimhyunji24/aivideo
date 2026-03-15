"use client"

import type { ProjectState, Scene, SceneElements, SceneParams } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ArrowRight, Plus, Trash2, Clock, RefreshCw, Layers,
  Sparkles, Wand2, CheckCircle2, Code2, Loader2, Pin,
} from "lucide-react"
import { useState, useMemo, Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"

// ─── Props ────────────────────────────────────────────────────────────────────

interface StoryboardProps {
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  onNext: () => void
  onBack: () => void
  selectedSceneIndex: number
  onSceneSelect: (i: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLE_CHIPS = [
  { id: "cinematic", label: "🎬 시네마틱", value: "cinematic, dramatic lighting, film grain, anamorphic" },
  { id: "anime", label: "✨ 애니메이션", value: "anime style, vibrant colors, sharp clean linework" },
  { id: "photo", label: "📸 실사", value: "photorealistic, 8K, sharp detail, DSLR quality" },
  { id: "watercolor", label: "🎨 수채화", value: "watercolor painting, soft edges, wet brush strokes" },
  { id: "noir", label: "🌑 누아르", value: "film noir, high contrast, dramatic black and white" },
  { id: "fantasy", label: "🔮 판타지", value: "fantasy concept art, magical atmosphere, ethereal glow" },
]

const ELEMENTS_CONFIG: { key: keyof SceneElements; label: string; enLabel: string; icon: string; placeholder: string }[] = [
  { key: "mainCharacter", label: "주인공", enLabel: "Subject",     icon: "👤", placeholder: "e.g. young woman in red coat" },
  { key: "action",        label: "행동",   enLabel: "Action",      icon: "🏃", placeholder: "e.g. running through rain" },
  { key: "lighting",      label: "조명",   enLabel: "Lighting",    icon: "💡", placeholder: "e.g. soft golden backlight" },
  { key: "composition",   label: "카메라", enLabel: "Camera",      icon: "📷", placeholder: "e.g. close-up shot" },
  { key: "background",    label: "배경",   enLabel: "Environment", icon: "🏞️", placeholder: "e.g. rainy city street" },
  { key: "time",          label: "시간대", enLabel: "Time",        icon: "⏰", placeholder: "e.g. twilight, golden hour" },
  { key: "pose",          label: "포즈",   enLabel: "Pose",        icon: "🧘", placeholder: "e.g. looking over shoulder" },
  { key: "subCharacter",  label: "보조",   enLabel: "Supporting",  icon: "👥", placeholder: "e.g. mysterious stranger" },
  { key: "mood",          label: "분위기", enLabel: "Mood",        icon: "✨", placeholder: "e.g. tense, suspenseful" },
]

const SAMPLERS = ["Euler a", "DPM++ 2M Karras", "DDIM", "LMS", "Heun"]

const DEFAULT_PARAMS: SceneParams = { seed: 42, steps: 30, cfgScale: 7.5, sampler: "Euler a" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function assemblePrompt(elements: SceneElements, styleValue?: string): string {
  const parts: string[] = []
  if (elements.mainCharacter) parts.push(elements.mainCharacter)
  if (elements.action)        parts.push(`is ${elements.action}`)
  if (elements.pose)          parts.push(`in ${elements.pose} pose`)
  if (elements.background)    parts.push(`at ${elements.background}`)
  if (elements.time)          parts.push(`during ${elements.time}`)
  if (elements.lighting)      parts.push(`${elements.lighting} lighting`)
  if (elements.composition)   parts.push(`${elements.composition} shot`)
  if (elements.mood)          parts.push(`${elements.mood} mood`)
  if (styleValue)             parts.push(styleValue)
  if (elements.story)         parts.push(elements.story)
  return parts.filter(Boolean).join(", ")
}

function guessElementsFromDescription(description: string): Partial<SceneElements> {
  // Heuristic auto-fill for demo – in production this would call the AI API
  const lower = description.toLowerCase()
  return {
    mainCharacter:  lower.includes("주인공") ? "main protagonist" : "central character",
    action:         description.length > 30 ? "stands contemplatively" : "moves forward",
    background:     lower.includes("도시") ? "urban city backdrop" : lower.includes("자연") ? "lush nature scenery" : "atmospheric setting",
    time:           lower.includes("밤") ? "night" : lower.includes("아침") ? "early morning" : "golden hour",
    lighting:       lower.includes("어두") ? "dim moody lighting" : "soft diffused lighting",
    composition:    "medium shot",
    mood:           lower.includes("슬") ? "melancholic, emotional" : lower.includes("설레") ? "exciting, hopeful" : "dramatic, cinematic",
    pose:           "natural stance",
    subCharacter:   "",
    story:          description.slice(0, 80),
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Storyboard({ project, setProject, onNext, onBack, selectedSceneIndex, onSceneSelect }: StoryboardProps) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // Double-prompting animation state
  const [expandStage, setExpandStage] = useState(0)   // 0=idle 1=analyzing 2=revealing 3=assembling 4=done
  const [revealedCount, setRevealedCount] = useState(0)

  const totalDuration = project.scenes.reduce((s, sc) => s + sc.duration, 0)
  const selectedScene = project.scenes[selectedSceneIndex]

  const rawPrompt = useMemo(() => {
    if (!selectedScene) return ""
    const styleVal = STYLE_CHIPS.find((c) => c.id === selectedScene.styleChip)?.value
    return assemblePrompt(selectedScene.elements, styleVal)
  }, [selectedScene])

  // ── Scene updaters ────────────────────────────────────────────────────────

  const updateElement = (key: keyof SceneElements, value: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) =>
        i === selectedSceneIndex ? { ...s, elements: { ...s.elements, [key]: value } } : s
      ),
    }))
  }

  const updateField = (field: keyof Scene, value: unknown) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => (i === selectedSceneIndex ? { ...s, [field]: value } : s)),
    }))
  }

  const updateParam = (field: keyof SceneParams, value: unknown) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) =>
        i === selectedSceneIndex ? { ...s, params: { ...DEFAULT_PARAMS, ...s.params, [field]: value } } : s
      ),
    }))
  }

  // ── Double Prompting ──────────────────────────────────────────────────────

  const handleDoublePrompt = async () => {
    if (!selectedScene) return
    setExpandStage(1)
    setRevealedCount(0)
    await sleep(700)

    const guessed = guessElementsFromDescription(selectedScene.description)
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) =>
        i === selectedSceneIndex ? { ...s, elements: { ...s.elements, ...guessed } } : s
      ),
    }))

    setExpandStage(2)
    for (let i = 1; i <= ELEMENTS_CONFIG.length; i++) {
      await sleep(200)
      setRevealedCount(i)
    }

    setExpandStage(3)
    await sleep(400)

    const styleVal = STYLE_CHIPS.find((c) => c.id === selectedScene.styleChip)?.value
    const newPrompt = assemblePrompt({ ...selectedScene.elements, ...guessed }, styleVal)
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) =>
        i === selectedSceneIndex ? { ...s, prompt: newPrompt } : s
      ),
    }))
    setExpandStage(4)
  }

  // ── Scene list ops ────────────────────────────────────────────────────────

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      title: `씬 ${project.scenes.length + 1}`,
      description: "새로운 씬 설명을 입력하세요",
      prompt: "",
      duration: 3,
      status: "pending",
      elements: { mainCharacter: "", subCharacter: "", action: "", pose: "", background: "", time: "", composition: "", lighting: "", mood: "", story: "" },
    }
    setProject((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }))
  }

  const handleDeleteScene = (id: string | number) => {
    setProject((prev) => ({ ...prev, scenes: prev.scenes.filter((s) => s.id !== id) }))
    if (selectedSceneIndex >= project.scenes.length - 1)
      onSceneSelect(Math.max(0, selectedSceneIndex - 1))
  }

  // ── Asset drop ────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent, sceneId: string | number) => {
    e.preventDefault()
    const assetId = e.dataTransfer.getData("assetId")
    if (!assetId) return
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, pinnedAsset: assetId } : s)),
    }))
  }

  // ── Image generation ──────────────────────────────────────────────────────

  const handleGenerateImage = async (sceneId: string | number) => {
    setIsGeneratingImage(true)
    try {
      const res = await fetch(`/api/generate-image?id=${sceneId}`, { method: "POST" })
      if (res.ok) {
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/status/${sceneId}`)
            if (statusRes.ok) {
              const updated = await statusRes.json()
              setProject((prev) => ({
                ...prev,
                scenes: prev.scenes.map((s) => (s.id === sceneId ? updated : s)),
              }))
              if (updated.status === "done" || updated.status === "error") {
                clearInterval(interval)
                setIsGeneratingImage(false)
              }
            }
          } catch { clearInterval(interval); setIsGeneratingImage(false) }
        }, 2000)
      } else { setIsGeneratingImage(false) }
    } catch { setIsGeneratingImage(false) }
  }

  if (!selectedScene) return null
  const sceneParams = { ...DEFAULT_PARAMS, ...selectedScene.params }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">스토리보드</h2>
          <p className="text-sm text-muted-foreground">
            {project.mode === "beginner" ? "자연어로 씬을 묘사하면 AI가 프롬프트를 완성합니다" : "10대 요소를 직접 편집하고 파라미터를 세밀하게 조정하세요"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1"><Layers className="h-3 w-3" />{project.scenes.length}개 씬</Badge>
          <Badge variant="outline" className="text-xs gap-1"><Clock className="h-3 w-3" />약 {totalDuration}초</Badge>
        </div>
      </div>

      {/* Workspace: 반응형 — md 이하에서는 세로 스택 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* ── Scene list (left) ── */}
        <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[200px] lg:min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">씬 목록</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddScene}>
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>씬 추가</TooltipContent>
            </Tooltip>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 pb-4 pr-1">
              {project.scenes.map((scene, index) => (
                <Card
                  key={scene.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-sm glass-card group relative",
                    selectedSceneIndex === index && "ring-1 ring-purple-400/40 bg-accent/50"
                  )}
                  onClick={() => { onSceneSelect(index); setExpandStage(0) }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, scene.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-sm font-medium truncate">{scene.title}</h4>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{scene.duration}s</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {scene.status === "done" && (
                            <Badge className="text-[9px] h-4 bg-green-500/10 text-green-400 border-green-500/20">생성완료</Badge>
                          )}
                          {scene.pinnedAsset && (
                            <Badge className="text-[9px] h-4 gap-0.5 bg-purple-500/10 text-purple-400 border-purple-400/20">
                              <Pin className="h-2 w-2" />핀
                            </Badge>
                          )}
                          {scene.styleChip && (
                            <Badge variant="outline" className="text-[9px] h-4">
                              {STYLE_CHIPS.find((c) => c.id === scene.styleChip)?.label.split(" ")[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {project.scenes.length > 1 && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── Edit panel (right) ── */}
        <div className="col-span-1 lg:col-span-8 min-h-0">
          <Card className="glass-card h-full overflow-hidden">
            <ScrollArea className="h-full">
              <CardContent className="p-5">
                {/* Scene title + generate */}
                <div className="flex items-center justify-between mb-5">
                  <Input
                    value={selectedScene.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="h-8 text-sm font-semibold w-48 bg-transparent border-transparent hover:border-border focus:border-border"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleGenerateImage(selectedScene.id)}
                    disabled={selectedScene.status === "generating" || isGeneratingImage}
                    className="h-8 gap-2 bg-purple-600 hover:bg-purple-500 text-white border-0"
                  >
                    {(selectedScene.status === "generating" || isGeneratingImage)
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    이미지 생성
                  </Button>
                </div>

                {/* Mode panels */}
                {project.mode === "beginner"
                  ? <BeginnerPanel
                      scene={selectedScene}
                      expandStage={expandStage}
                      revealedCount={revealedCount}
                      rawPrompt={rawPrompt}
                      onDescriptionChange={(v) => updateField("description", v)}
                      onStyleSelect={(id) => { updateField("styleChip", id); setExpandStage(0) }}
                      onDoublePrompt={handleDoublePrompt}
                    />
                  : <ExpertPanel
                      scene={selectedScene}
                      sceneParams={sceneParams}
                      rawPrompt={rawPrompt}
                      onElementChange={updateElement}
                      onParamChange={updateParam}
                    />
                }
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 mt-4 border-t border-border/50">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8">이전</Button>
        <Button size="sm" onClick={onNext} className="h-8 gap-2">
          영상 생성으로 계속 <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Beginner Panel ───────────────────────────────────────────────────────────

interface BeginnerPanelProps {
  scene: Scene
  expandStage: number
  revealedCount: number
  rawPrompt: string
  onDescriptionChange: (v: string) => void
  onStyleSelect: (id: string) => void
  onDoublePrompt: () => void
}

function BeginnerPanel({ scene, expandStage, revealedCount, rawPrompt, onDescriptionChange, onStyleSelect, onDoublePrompt }: BeginnerPanelProps) {
  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          상황 설명
        </label>
        <Textarea
          placeholder="이 씬에서 어떤 일이 벌어지고 있나요? 한국어로 자연스럽게 설명해주세요."
          value={scene.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="text-sm bg-muted/20 border-border/50 resize-none"
        />
      </div>

      {/* Style chips */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          스타일 선택
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => onStyleSelect(chip.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-all",
                scene.styleChip === chip.id
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expand button */}
      {expandStage === 0 && (
        <Button
          onClick={onDoublePrompt}
          disabled={!scene.description.trim()}
          className="w-full gap-2 bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white border-0 h-10"
        >
          <Wand2 className="h-4 w-4" />
          AI 디렉터로 확장 (Double Prompting)
        </Button>
      )}

      {/* Double Prompting reveal */}
      {expandStage >= 1 && (
        <div className="rounded-xl border border-purple-400/20 bg-purple-950/20 overflow-hidden">
          {/* Status bar */}
          <div className="px-4 py-2.5 border-b border-purple-400/20 bg-purple-900/20 flex items-center gap-2">
            {expandStage < 4
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
              : <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            }
            <span className="text-xs font-medium text-purple-300">
              {expandStage === 1 && "AI 디렉터 입력 분석 중..."}
              {expandStage === 2 && "10대 핵심 요소 추출 중..."}
              {expandStage === 3 && "영문 프롬프트 조합 중..."}
              {expandStage === 4 && "✨ 프롬프트 생성 완료"}
            </span>
            {expandStage === 4 && (
              <button
                onClick={onDoublePrompt}
                className="ml-auto text-[10px] text-purple-400 hover:text-purple-200 transition-colors"
              >
                재실행 ↺
              </button>
            )}
          </div>

          {/* Elements reveal */}
          {expandStage >= 2 && (
            <div className="p-4 grid grid-cols-2 gap-y-2 gap-x-4">
              {ELEMENTS_CONFIG.slice(0, revealedCount).map((el) => (
                <div key={el.key} className="flex items-center gap-2 text-xs">
                  <span className="text-base leading-none">{el.icon}</span>
                  <span className="text-muted-foreground w-12 flex-shrink-0">{el.label}</span>
                  <span className={cn(
                    "flex-1 truncate text-foreground/80",
                    expandStage < 4 && "animate-pulse"
                  )}>
                    {(scene.elements as any)[el.key] || "·····"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Final prompt */}
          {expandStage === 4 && rawPrompt && (
            <div className="px-4 pb-4">
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Code2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">생성된 영문 프롬프트</span>
                </div>
                <p className="text-[11px] font-mono leading-relaxed text-foreground/80 italic break-words">
                  {rawPrompt}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Expert Panel ─────────────────────────────────────────────────────────────

interface ExpertPanelProps {
  scene: Scene
  sceneParams: SceneParams
  rawPrompt: string
  onElementChange: (key: keyof SceneElements, value: string) => void
  onParamChange: (field: keyof SceneParams, value: unknown) => void
}

function ExpertPanel({ scene, sceneParams, rawPrompt, onElementChange, onParamChange }: ExpertPanelProps) {
  return (
    <div className="space-y-6">
      {/* 10-element grid */}
      <div className="space-y-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          10대 핵심 요소
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ELEMENTS_CONFIG.map((el) => (
            <div key={el.key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span>{el.icon}</span>
                <span className="font-medium">{el.label}</span>
                <span className="text-muted-foreground/50 text-[9px]">/ {el.enLabel}</span>
              </label>
              <Input
                value={(scene.elements as any)[el.key]}
                onChange={(e) => onElementChange(el.key, e.target.value)}
                placeholder={el.placeholder}
                className="h-7 text-xs bg-muted/20 border-border/50 placeholder:text-muted-foreground/40"
              />
            </div>
          ))}
        </div>

        {/* Story – full width */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span>📝</span>
            <span className="font-medium">스토리 맥락</span>
            <span className="text-muted-foreground/50 text-[9px]">/ Story Context</span>
          </label>
          <Textarea
            value={scene.elements.story}
            onChange={(e) => onElementChange("story", e.target.value)}
            placeholder="이 씬의 스토리 맥락을 입력하세요 (한글/영문 가능)"
            rows={2}
            className="text-xs bg-muted/20 border-border/50 resize-none"
          />
        </div>
      </div>

      {/* Parameters */}
      <div className="space-y-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          생성 파라미터
        </label>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Seed</span>
              <span className="font-mono text-foreground/70">{sceneParams.seed}</span>
            </div>
            <Slider value={[sceneParams.seed]} onValueChange={([v]) => onParamChange("seed", v)}
              min={0} max={9999} step={1} className="h-1.5" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Steps</span>
              <span className="font-mono text-foreground/70">{sceneParams.steps}</span>
            </div>
            <Slider value={[sceneParams.steps]} onValueChange={([v]) => onParamChange("steps", v)}
              min={10} max={50} step={1} className="h-1.5" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">CFG Scale</span>
              <span className="font-mono text-foreground/70">{sceneParams.cfgScale.toFixed(1)}</span>
            </div>
            <Slider value={[sceneParams.cfgScale]} onValueChange={([v]) => onParamChange("cfgScale", v)}
              min={1} max={20} step={0.5} className="h-1.5" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Sampler</label>
            <Select value={sceneParams.sampler} onValueChange={(v) => onParamChange("sampler", v)}>
              <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLERS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Raw Prompt */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Code2 className="h-3 w-3" /> Raw Prompt (실시간 조합)
        </label>
        <div className="rounded-lg bg-muted/20 border border-border/40 p-3 min-h-[56px]">
          {rawPrompt
            ? <p className="text-[11px] font-mono leading-relaxed text-foreground/70 italic break-words">{rawPrompt}</p>
            : <p className="text-xs text-muted-foreground/50">요소를 입력하면 프롬프트가 자동 조합됩니다...</p>
          }
        </div>
      </div>
    </div>
  )
}
