"use client"

import { useState, useRef } from "react"
import type { ProjectState, Character, PlotPlan, PlotStage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sparkles,
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  Check,
  Wand2,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "logline" as const, icon: "✍️", label: "로그라인", desc: "이야기의 핵심 한 문장" },
  { id: "characters" as const, icon: "👤", label: "캐릭터 설정", desc: "등장인물 외면·내면" },
  { id: "plot" as const, icon: "🎬", label: "플롯 엔진", desc: "이야기 구조 설계" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const STAGE_LABELS: Record<3 | 4 | 5, string[]> = {
  3: ["발단", "전개", "결말"],
  4: ["발단", "전개", "위기", "결말"],
  5: ["발단", "전개", "위기", "절정", "결말"],
}

const AI_TIPS: Record<SectionId, string[]> = {
  logline: [
    "좋은 로그라인은 주인공 + 목표 + 갈등 세 요소를 담습니다",
    "한 문장으로 이야기 전체를 설명할 수 있어야 합니다",
    "구체적인 명사와 능동적인 동사를 사용하세요",
  ],
  characters: [
    "트라우마는 캐릭터의 행동 동기와 직결되어야 합니다",
    "외면과 내면이 충돌할 때 입체적인 캐릭터가 완성됩니다",
    "상반된 가치관을 가진 인물들이 이야기를 풍성하게 합니다",
  ],
  plot: [
    "캐릭터의 가치관이 핵심 선택 장면에 반영되어야 합니다",
    "각 단계마다 인물의 내면 변화를 담아보세요",
    "AI 자동 생성 후 세부 내용을 직접 다듬어 완성하세요",
  ],
}

// ─── AI Auto-generation Logic ──────────────────────────────────────────────

function generatePlotStages(
  logline: string,
  characters: Character[],
  stageCount: 3 | 4 | 5
): PlotStage[] {
  const labels = STAGE_LABELS[stageCount]
  const main = characters[0]
  const name = main?.name || "주인공"

  const templates: Record<string, string> = {
    발단: `${name}${main?.appearance ? `(${main.appearance})` : ""}은(는) 평범한 일상을 보내던 중 ${logline || "새로운 여정"} 속으로 끌려들어간다. 아직 자신이 마주할 운명을 모른 채 첫 번째 선택의 기로에 선다.`,
    전개: `${name}은(는) ${main?.personality ? `${main.personality}한 성격` : "자신만의 방식"}으로 장애물에 맞서기 시작한다. 하나씩 위기를 헤쳐 나가며 성장하지만, 진짜 시험은 아직 시작되지 않았다.`,
    위기: `${main?.trauma ? `과거의 상처 "${main.trauma}"` : "예상치 못한 사건"}이 폭발하며 ${name}은(는) 모든 것을 잃을 위기에 처한다. 지금까지 쌓아온 것들이 무너지는 순간, 진짜 자신과 마주해야 한다.`,
    절정: `${name}은(는) ${main?.values ? `"${main.values}"라는 신념` : "자신이 믿는 것"}을 선택하고 운명과 맞서는 최후의 결전에 나선다. 이 순간을 위해 모든 여정이 준비되어 왔다.`,
    결말: `모든 갈등이 해소되고 ${name}은(는) 변화한 모습으로 새로운 길을 걷는다. ${logline || "이 이야기"}의 여정은 끝났지만, 그가 남긴 여운은 오래도록 지속된다.`,
  }

  return labels.map((label, i) => ({
    id: `stage-${i}`,
    label,
    content: templates[label] ?? `${label} 단계의 내용을 작성해 주세요.`,
  }))
}

// ─── Sub-components ────────────────────────────────────────────────────────

function LoglineSection({
  logline,
  onChange,
}: {
  logline: string
  onChange: (v: string) => void
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">로그라인</h2>
        <p className="text-sm text-gray-500 mt-1">이야기의 핵심을 한 문장으로 정리하세요</p>
      </div>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-start gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
              예시
            </span>
            <span className="text-xs text-gray-500 leading-relaxed">
              기억을 잃은 형사가 자신이 연쇄살인마라는 사실을 알게 되는 심리 스릴러
            </span>
          </div>
          <Textarea
            value={logline}
            onChange={(e) => onChange(e.target.value)}
            placeholder="주인공이 ___을(를) 목표로, ___와(과) 맞서는 이야기"
            rows={3}
            className="resize-none text-sm border-gray-200 focus-visible:ring-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-2 text-right">{logline.length} / 200자</p>
        </CardContent>
      </Card>
    </div>
  )
}

function CharactersSection({
  characters,
  onAdd,
  onUpdate,
  onRemove,
  onImageUpload,
}: {
  characters: Character[]
  onAdd: () => void
  onUpdate: (id: string, field: keyof Character, value: string) => void
  onRemove: (id: string) => void
  onImageUpload: (id: string, file: File) => void
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">캐릭터 설정</h2>
          <p className="text-sm text-gray-500 mt-1">등장인물의 외면과 내면을 설계하세요</p>
        </div>
        <Button
          onClick={onAdd}
          variant="outline"
          size="sm"
          className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="h-3.5 w-3.5" />
          캐릭터 추가
        </Button>
      </div>

      {characters.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">아직 캐릭터가 없습니다</p>
          <Button
            onClick={onAdd}
            variant="outline"
            size="sm"
            className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" />
            첫 번째 캐릭터 추가
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {characters.map((char, idx) => (
          <Card key={char.id} className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Image upload */}
                <div
                  className="h-16 w-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer overflow-hidden hover:border-indigo-300 transition-colors flex-shrink-0"
                  onClick={() => fileRefs.current[char.id]?.click()}
                >
                  {char.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={char.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => {
                    fileRefs.current[char.id] = el
                  }}
                  onChange={(e) => e.target.files?.[0] && onImageUpload(char.id, e.target.files[0])}
                />
                <div>
                  <Input
                    value={char.name}
                    onChange={(e) => onUpdate(char.id, "name", e.target.value)}
                    placeholder={`캐릭터 ${idx + 1} 이름`}
                    className="h-8 text-sm font-semibold border-0 border-b border-gray-200 rounded-none px-0 bg-transparent focus-visible:ring-0 w-36"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">{idx === 0 ? "주인공" : "조연"}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => onRemove(char.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-0">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  외면 — 외모·인상·분위기
                </label>
                <Textarea
                  value={char.appearance}
                  onChange={(e) => onUpdate(char.id, "appearance", e.target.value)}
                  placeholder="예: 짧은 흑발, 날카로운 눈매, 왼손에 희미한 흉터..."
                  rows={2}
                  className="resize-none text-xs border-gray-200 focus-visible:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  성격
                </label>
                <Textarea
                  value={char.personality}
                  onChange={(e) => onUpdate(char.id, "personality", e.target.value)}
                  placeholder="예: 냉철하지만 약자를 보면 못 참는..."
                  rows={2}
                  className="resize-none text-xs border-gray-200 focus-visible:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  가치관
                </label>
                <Textarea
                  value={char.values}
                  onChange={(e) => onUpdate(char.id, "values", e.target.value)}
                  placeholder="예: 정의는 결과로 증명된다..."
                  rows={2}
                  className="resize-none text-xs border-gray-200 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  트라우마 / 상처
                </label>
                <Textarea
                  value={char.trauma}
                  onChange={(e) => onUpdate(char.id, "trauma", e.target.value)}
                  placeholder="예: 어린 시절 가족을 잃은 사건, 지금도 그 죄책감에서 벗어나지 못하고 있다..."
                  rows={2}
                  className="resize-none text-xs border-gray-200 focus-visible:ring-indigo-500"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PlotSection({
  plotPlan,
  onStageCountChange,
  onStageUpdate,
  onAutoGenerate,
  isGenerating,
  hasCharacters,
  hasLogline,
}: {
  plotPlan: PlotPlan
  onStageCountChange: (n: 3 | 4 | 5) => void
  onStageUpdate: (id: string, content: string) => void
  onAutoGenerate: () => void
  isGenerating: boolean
  hasCharacters: boolean
  hasLogline: boolean
}) {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">플롯 엔진</h2>
          <p className="text-sm text-gray-500 mt-1">이야기의 호흡과 구조를 설계하세요</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([3, 4, 5] as const).map((n) => (
            <button
              key={n}
              onClick={() => onStageCountChange(n)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                plotPlan.stageCount === n
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {n}단계
            </button>
          ))}
        </div>
      </div>

      {/* Auto-generate banner */}
      {(hasCharacters || hasLogline) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-800">AI 자동 생성 사용 가능</p>
            <p className="text-xs text-indigo-500 mt-0.5">
              {[hasCharacters && "캐릭터 설정", hasLogline && "로그라인"]
                .filter(Boolean)
                .join(" + ")}을 분석하여 각 단계를 채워드립니다
            </p>
          </div>
          <Button
            onClick={onAutoGenerate}
            disabled={isGenerating}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 flex-shrink-0"
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                생성 중...
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                자동 생성
              </>
            )}
          </Button>
        </div>
      )}

      {/* Stage cards */}
      <div className="space-y-3">
        {plotPlan.stages.map((stage, i) => (
          <Card key={stage.id} className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <CardTitle className="text-sm font-semibold text-gray-800">{stage.label}</CardTitle>
                {stage.content && <Check className="h-3.5 w-3.5 text-green-500 ml-auto" />}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Textarea
                value={stage.content}
                onChange={(e) => onStageUpdate(stage.id, e.target.value)}
                placeholder={`${stage.label} 단계의 내용을 작성하거나 AI 자동 생성을 사용하세요`}
                rows={3}
                className="resize-none text-sm border-gray-200 focus-visible:ring-indigo-500"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface PlanningWorkspaceProps {
  project: ProjectState
  setProject: (p: ProjectState) => void
  onNext: () => void
}

export function PlanningWorkspace({ project, setProject, onNext }: PlanningWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("logline")
  const [isGenerating, setIsGenerating] = useState(false)

  const logline = project.logline ?? ""
  const characters: Character[] = project.characters ?? []
  const plotPlan: PlotPlan | null = project.plotPlan ?? null
  const stageCount = plotPlan?.stageCount ?? 5

  // ── Setters ──────────────────────────────────────────────────────────────

  const setLogline = (v: string) => setProject({ ...project, logline: v })

  const setCharacters = (chars: Character[]) => setProject({ ...project, characters: chars })

  const addCharacter = () => {
    setCharacters([
      ...characters,
      { id: `char-${Date.now()}`, name: "", appearance: "", personality: "", values: "", trauma: "" },
    ])
  }

  const updateCharacter = (id: string, field: keyof Character, value: string) =>
    setCharacters(characters.map((c) => (c.id === id ? { ...c, [field]: value } : c)))

  const removeCharacter = (id: string) =>
    setCharacters(characters.filter((c) => c.id !== id))

  const handleImageUpload = (charId: string, file: File) => {
    const url = URL.createObjectURL(file)
    updateCharacter(charId, "imageUrl", url)
  }

  const setStageCount = (n: 3 | 4 | 5) => {
    const labels = STAGE_LABELS[n]
    const stages = labels.map((label, i) => ({
      id: `stage-${i}`,
      label,
      content: plotPlan?.stages.find((s) => s.label === label)?.content ?? "",
    }))
    setProject({ ...project, plotPlan: { stageCount: n, stages } })
  }

  const updateStage = (id: string, content: string) => {
    if (!plotPlan) return
    setProject({
      ...project,
      plotPlan: { ...plotPlan, stages: plotPlan.stages.map((s) => (s.id === id ? { ...s, content } : s)) },
    })
  }

  // ── AI Auto-generate ─────────────────────────────────────────────────────

  const handleAutoGenerate = async () => {
    setIsGenerating(true)
    await new Promise((r) => setTimeout(r, 1200))
    const stages = generatePlotStages(logline, characters, stageCount)
    setProject({ ...project, plotPlan: { stageCount, stages } })
    setIsGenerating(false)
  }

  // ── Section navigation ───────────────────────────────────────────────────

  const handleSectionClick = (id: SectionId) => {
    if (id === "plot" && !plotPlan) {
      const labels = STAGE_LABELS[stageCount]
      const stages = labels.map((label, i) => ({ id: `stage-${i}`, label, content: "" }))
      setProject({ ...project, plotPlan: { stageCount, stages } })
    }
    setActiveSection(id)
  }

  const isSectionDone = (id: SectionId) => {
    if (id === "logline") return !!logline
    if (id === "characters") return characters.length > 0
    return !!plotPlan?.stages.some((s) => s.content)
  }

  const canProceed = isSectionDone("logline") && isSectionDone("characters") && isSectionDone("plot")

  return (
    <div className="flex h-full">
      {/* ── Left Sidebar ── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">기획 단계</h3>
          <p className="text-xs text-gray-400 mt-0.5">순서대로 채워가세요</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => handleSectionClick(sec.id)}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                activeSection === sec.id
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                  : "hover:bg-gray-50 text-gray-700 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{sec.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{sec.label}</span>
                    {isSectionDone(sec.id) && (
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{sec.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </nav>

        {/* Proceed */}
        <div className="p-3 border-t border-gray-100">
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1 disabled:opacity-40"
            size="sm"
          >
            스토리보드 제작
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {!canProceed && (
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              3단계를 모두 완성하면 활성화됩니다
            </p>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 min-w-0">
        {activeSection === "logline" && (
          <LoglineSection logline={logline} onChange={setLogline} />
        )}
        {activeSection === "characters" && (
          <CharactersSection
            characters={characters}
            onAdd={addCharacter}
            onUpdate={updateCharacter}
            onRemove={removeCharacter}
            onImageUpload={handleImageUpload}
          />
        )}
        {activeSection === "plot" && plotPlan && (
          <PlotSection
            plotPlan={plotPlan}
            onStageCountChange={setStageCount}
            onStageUpdate={updateStage}
            onAutoGenerate={handleAutoGenerate}
            isGenerating={isGenerating}
            hasCharacters={characters.length > 0}
            hasLogline={!!logline}
          />
        )}
      </main>

      {/* ── Right AI Assistant ── */}
      <aside className="w-60 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">AI 어시스턴트</h3>
              <p className="text-[10px] text-gray-400">기획 도우미</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 px-1 py-1">
            {activeSection === "logline"
              ? "💡 로그라인 팁"
              : activeSection === "characters"
              ? "💡 캐릭터 설정 팁"
              : "💡 플롯 설계 팁"}
          </p>
          {AI_TIPS[activeSection].map((tip, i) => (
            <div key={i} className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <p className="text-xs text-indigo-700 leading-relaxed">{tip}</p>
            </div>
          ))}

          {activeSection === "plot" && (characters.length > 0 || logline) && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <Button
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs gap-1.5"
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    캐릭터 기반 자동 생성
                  </>
                )}
              </Button>
              <p className="text-[10px] text-gray-400 text-center mt-1.5 leading-relaxed">
                캐릭터 설정을 분석하여
                <br />
                플롯을 자동으로 작성합니다
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
