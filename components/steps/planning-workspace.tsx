"use client"

import { useState, useRef, useEffect } from "react"
import type { ProjectState, Character, PlotPlan, PlotStage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Square,
  Users,
  Film,
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Wand2,
  RotateCw,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// ─── 목업 컬러 (1. 기획 화면) ───────────────────────────────────────────────
const COLORS = {
  primary: "#3E51B5",
  primaryHover: "#3346A0",
  tabActive: "#333B4E",
  tabInactive: "#F0F0F0",
  border: "#E0E0E0",
} as const

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<3 | 4 | 5, string[]> = {
  3: ["발단", "전개", "결말"],
  4: ["발단", "전개", "위기", "결말"],
  5: ["발단", "전개", "위기", "절정", "결말"],
}

const GENDER_LABEL: Record<"male" | "female", string> = { male: "남", female: "여" }

// ─── AI Auto-generation ─────────────────────────────────────────────────────

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

// ─── Sub-components (목업 스타일) ───────────────────────────────────────────

const GENRE_OPTIONS = ["SF", "코미디", "서바이벌"] as const
const WORLDVIEW_OPTIONS = ["근미래", "일상", "성장"] as const

function LoglineSection({
  logline,
  onChange,
  genreOptions,
  worldviewOptions,
  selectedGenres,
  selectedWorldviews,
  onToggleGenre,
  onToggleWorldview,
  onRefresh,
}: {
  logline: string
  onChange: (v: string) => void
  genreOptions: readonly string[]
  worldviewOptions: readonly string[]
  selectedGenres: string[]
  selectedWorldviews: string[]
  onToggleGenre: (tag: string) => void
  onToggleWorldview: (tag: string) => void
  onRefresh: () => void
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg border border-[#E0E0E0] flex items-center justify-center">
          <Square className="h-4 w-4 text-gray-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">로그라인</h2>
      </div>

      <Card className="border border-[#E0E0E0] shadow-none bg-white rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 text-gray-500 hover:text-gray-700"
            onClick={onRefresh}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Textarea
            value={logline}
            onChange={(e) => onChange(e.target.value)}
            placeholder="기억을 잃은 요리사 잭이 과거의 비밀을 찾아가는 과정에서 진정한 자신을 발견하는 이야기"
            rows={4}
            className="resize-none text-sm border-[#E0E0E0] focus-visible:ring-2 focus-visible:ring-offset-0 rounded-lg min-h-[100px]"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-[#E0E0E0] shadow-none bg-white rounded-xl">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-gray-900">장르 & 스타일</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 flex flex-wrap gap-2">
            {genreOptions.map((tag) => {
              const selected = selectedGenres.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleGenre(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-[#F0F0F0] text-gray-800 border-[#E0E0E0] hover:bg-[#E8E8E8]"
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </CardContent>
        </Card>
        <Card className="border border-[#E0E0E0] shadow-none bg-white rounded-xl">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-gray-900">세계관 & 배경</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 flex flex-wrap gap-2">
            {worldviewOptions.map((tag) => {
              const selected = selectedWorldviews.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleWorldview(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-[#F0F0F0] text-gray-800 border-[#E0E0E0] hover:bg-[#E8E8E8]"
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function CharactersSection({
  characters,
  onAdd,
  onUpdate,
  onRemove,
  onImageUpload,
  onEditClick,
}: {
  characters: Character[]
  onAdd: () => void
  onUpdate: (id: string, field: keyof Character, value: string) => void
  onRemove: (id: string) => void
  onImageUpload: (id: string, file: File) => void
  /** 수정하기 클릭 시 호출 — 캐릭터 수정 모달을 연다 */
  onEditClick: (id: string) => void
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg border border-[#E0E0E0] flex items-center justify-center">
            <Users className="h-4 w-4 text-gray-800" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">캐릭터 시트</h2>
        </div>
        <Button
          onClick={onAdd}
          variant="outline"
          size="sm"
          className="rounded-lg border-[#E0E0E0] text-gray-800 hover:bg-[#F0F0F0]"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          캐릭터 추가
        </Button>
      </div>

      {characters.length === 0 ? (
        <Card
          className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-12 text-center bg-white"
          onClick={onAdd}
        >
          <p className="text-gray-500 text-sm mb-3">아직 캐릭터가 없습니다</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-[#E0E0E0] text-gray-800"
            onClick={(e) => { e.stopPropagation(); onAdd() }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            첫 번째 캐릭터 추가
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char, idx) => (
            <Card
              key={char.id}
              className="border border-[#E0E0E0] shadow-none bg-white rounded-xl overflow-hidden"
            >
              <CardContent className="p-0">
                <div
                  className="h-32 bg-[#F5F5F5] border-b border-[#E0E0E0] flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => fileRefs.current[char.id]?.click()}
                >
                  {char.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={char.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => { fileRefs.current[char.id] = el }}
                  onChange={(e) => e.target.files?.[0] && onImageUpload(char.id, e.target.files[0])}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      value={char.name}
                      onChange={(e) => onUpdate(char.id, "name", e.target.value)}
                      placeholder={`캐릭터 ${idx + 1}`}
                      className="h-8 text-sm font-semibold border-0 border-b border-transparent focus-visible:ring-0 px-0 rounded-none bg-transparent focus:border-gray-300"
                    />
                    <span className="text-xs text-gray-500 shrink-0">
                      {char.gender ? GENDER_LABEL[char.gender] : idx === 0 ? "주인공" : "조연"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[2rem]">
                    {char.appearance || char.personality || "설명을 입력하세요"}
                  </p>
                  <Button
                    onClick={() => onEditClick(char.id)}
                    className="w-full mt-3 rounded-lg text-white text-sm font-medium h-9"
                    style={{ backgroundColor: COLORS.primary }}
                  >
                    수정하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function PlotSection({
  plotPlan,
  onStageCountChange,
  onStageUpdate,
  onAutoGenerate,
  onStageEditClick,
  isGenerating,
  hasCharacters,
  hasLogline,
}: {
  plotPlan: PlotPlan
  onStageCountChange: (n: 3 | 4 | 5) => void
  onStageUpdate: (id: string, content: string) => void
  onAutoGenerate: () => void
  /** 수정하기 클릭 시 호출 — 플롯 수정 모달을 연다 */
  onStageEditClick: (stageId: string) => void
  isGenerating: boolean
  hasCharacters: boolean
  hasLogline: boolean
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg border border-[#E0E0E0] flex items-center justify-center">
          <Film className="h-4 w-4 text-gray-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">플롯</h2>
      </div>

      {/* AI 프롬프트 추가 창 (목업 회색 바) */}
      <div className="rounded-xl border border-[#E0E0E0] bg-[#F5F5F5] px-4 py-3">
        <p className="text-sm text-gray-500">사용자 지시사항 작성하는 AI 프롬프트 추가 창</p>
      </div>

      {(hasCharacters || hasLogline) && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E0E0E0] bg-white p-4">
          <p className="text-sm text-gray-700">로그라인·캐릭터를 바탕으로 플롯을 자동 생성할 수 있습니다.</p>
          <Button
            onClick={onAutoGenerate}
            disabled={isGenerating}
            size="sm"
            className="rounded-lg text-white font-medium shrink-0 gap-1.5"
            style={{ backgroundColor: COLORS.primary }}
          >
            {isGenerating ? (
              <>생성 중...</>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                AI 자동 생성
              </>
            )}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 rounded-lg p-1 bg-[#F0F0F0] border border-[#E0E0E0] w-full sm:w-fit">
        {([3, 4, 5] as const).map((n) => (
          <button
            key={n}
            onClick={() => onStageCountChange(n)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
              plotPlan.stageCount === n
                ? "bg-white text-gray-900 shadow-sm border border-[#E0E0E0]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {n}단계
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plotPlan.stages.map((stage, i) => (
          <Card
            key={stage.id}
            className="border border-[#E0E0E0] shadow-none bg-white rounded-xl overflow-hidden"
          >
            <CardHeader className="py-3 px-4 border-b border-[#E0E0E0]">
              <CardTitle className="text-sm font-semibold text-gray-900">
                {i + 1} {stage.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                value={stage.content}
                onChange={(e) => onStageUpdate(stage.id, e.target.value)}
                placeholder={`${stage.label} 내용`}
                rows={4}
                className="resize-none text-sm border-[#E0E0E0] rounded-lg focus-visible:ring-2 focus-visible:ring-offset-0"
              />
              <Button
                className="w-full mt-3 rounded-lg text-white text-sm font-medium h-9"
                style={{ backgroundColor: COLORS.primary }}
                onClick={() => onStageEditClick(stage.id)}
              >
                수정하기
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ─── 캐릭터 수정 모달 (plan -2 cha modal) ───────────────────────────────────
function CharacterEditModal({
  character,
  open,
  onOpenChange,
  onSave,
  onRemove,
}: {
  character: Character | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (char: Character) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = useState<Character | null>(null)

  useEffect(() => {
    if (character) setDraft({ ...character })
    else setDraft(null)
  }, [character])

  if (!draft) return null

  const handleSave = () => {
    onSave(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border-2 border-[#686868] bg-white shadow-xl flex flex-col"
      >
        <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
          {/* 좌측: 큰 텍스트 영역 (모바일에서는 상단, lg에서 좌측) */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-[#686868] min-h-[160px] lg:min-h-[320px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg border border-[#BABABA] flex items-center justify-center bg-white">
                <Square className="h-4 w-4 text-gray-800" />
              </div>
              <span className="text-sm font-semibold text-gray-900">한 줄 소개</span>
            </div>
            <Textarea
              value={draft?.appearance ?? ""}
              onChange={(e) =>
                setDraft((prev) => (prev ? { ...prev, appearance: e.target.value } : null))
              }
              placeholder="캐릭터를 한 문장으로 설명해 주세요 (외면·인상)"
              rows={5}
              className="flex-1 resize-none rounded-xl border border-[#BABABA] bg-white text-sm focus-visible:ring-2 focus-visible:ring-offset-0"
            />
          </div>

          {/* 우측: 캐릭터 수정 폼 (모바일에서는 하단 풀너비) */}
          <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-base font-semibold text-gray-900">
                캐릭터 수정
              </DialogTitle>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">이름</label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((p) => (p ? { ...p, name: e.target.value } : null))}
                    className="h-9 rounded-lg border border-[#BABABA] bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">성별</label>
                  <div className="flex gap-2 h-9 items-center">
                    {(["male", "female"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setDraft((p) => (p ? { ...p, gender: g } : null))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                          draft.gender === g ? "bg-gray-800 text-white" : "bg-[#F0F0F0] text-gray-800 border border-[#BABABA]"
                        }`}
                      >
                        {GENDER_LABEL[g]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">외면 (외모·인상)</label>
                <Textarea
                  value={draft.appearance}
                  onChange={(e) => setDraft((p) => (p ? { ...p, appearance: e.target.value } : null))}
                  placeholder="짧은 흑발, 날카로운 눈매..."
                  rows={2}
                  className="resize-none rounded-lg border border-[#BABABA] bg-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">성격</label>
                <Input
                  value={draft.personality}
                  onChange={(e) => setDraft((p) => (p ? { ...p, personality: e.target.value } : null))}
                  className="h-9 rounded-lg border border-[#BABABA] bg-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">가치관</label>
                <Input
                  value={draft.values}
                  onChange={(e) => setDraft((p) => (p ? { ...p, values: e.target.value } : null))}
                  className="h-9 rounded-lg border border-[#BABABA] bg-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">트라우마 / 상처</label>
                <Textarea
                  value={draft.trauma}
                  onChange={(e) => setDraft((p) => (p ? { ...p, trauma: e.target.value } : null))}
                  placeholder="과거의 상처나 동기..."
                  rows={2}
                  className="resize-none rounded-lg border border-[#BABABA] bg-white text-sm"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-4 mt-4 border-t border-[#E0E0E0]">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  onRemove(draft.id)
                  onOpenChange(false)
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                삭제
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg border-[#BABABA]">
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg text-white"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  저장
                </Button>
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── 플롯 단계 수정 모달 (plan -2 plot modal) ───────────────────────────────
function PlotStageEditModal({
  stage,
  stageIndex,
  open,
  onOpenChange,
  onSave,
}: {
  stage: PlotStage | null
  stageIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (stage: PlotStage) => void
}) {
  const [draft, setDraft] = useState<PlotStage | null>(null)

  useEffect(() => {
    if (stage) setDraft({ ...stage })
    else setDraft(null)
  }, [stage])

  if (!draft) return null

  const handleSave = () => {
    onSave(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border-2 border-[#686868] bg-white shadow-xl flex flex-col"
      >
        <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
          {/* 좌측: 단계 내용 (모바일에서는 상단) */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-[#686868] min-h-[140px] lg:min-h-[280px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg border border-[#BABABA] flex items-center justify-center bg-white">
                <Film className="h-4 w-4 text-gray-800" />
              </div>
              <span className="text-sm font-semibold text-gray-900">{draft.label} 단계</span>
            </div>
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft((p) => (p ? { ...p, content: e.target.value } : null))}
              placeholder={`${draft.label} 단계의 내용을 작성하세요`}
              rows={6}
              className="flex-1 resize-none rounded-xl border border-[#BABABA] bg-white text-sm focus-visible:ring-2 focus-visible:ring-offset-0"
            />
          </div>

          {/* 우측: 플롯 수정 폼 (모바일에서는 하단 풀너비) */}
          <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-base font-semibold text-gray-900">
                플롯 수정
              </DialogTitle>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">번호</label>
                <Input
                  value={String(stageIndex + 1)}
                  readOnly
                  className="h-9 rounded-lg border border-[#BABABA] bg-gray-50 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">단계명</label>
                <Input
                  value={draft.label}
                  readOnly
                  className="h-9 rounded-lg border border-[#BABABA] bg-gray-50 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">내용</label>
                <Textarea
                  value={draft.content}
                  onChange={(e) => setDraft((p) => (p ? { ...p, content: e.target.value } : null))}
                  placeholder="이 단계에서 일어나는 일을 작성하세요"
                  rows={6}
                  className="resize-none rounded-lg border border-[#BABABA] bg-white text-sm"
                />
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-4 mt-4 border-t border-[#E0E0E0]">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg border-[#BABABA]">
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="rounded-lg text-white"
                style={{ backgroundColor: COLORS.primary }}
              >
                저장
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface PlanningWorkspaceProps {
  project: ProjectState
  setProject: (p: ProjectState) => void
  onNext: () => void
  onBack?: () => void
}

export function PlanningWorkspace({ project, setProject, onNext, onBack }: PlanningWorkspaceProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [characterModalId, setCharacterModalId] = useState<string | null>(null)
  const [plotModalStageId, setPlotModalStageId] = useState<string | null>(null)

  const logline = project.logline ?? ""
  const selectedGenres = project.selectedGenres ?? []
  const selectedWorldviews = project.selectedWorldviews ?? []

  const toggleGenre = (tag: string) => {
    const next = selectedGenres.includes(tag)
      ? selectedGenres.filter((t) => t !== tag)
      : [...selectedGenres, tag]
    setProject({ ...project, selectedGenres: next })
  }
  const toggleWorldview = (tag: string) => {
    const next = selectedWorldviews.includes(tag)
      ? selectedWorldviews.filter((t) => t !== tag)
      : [...selectedWorldviews, tag]
    setProject({ ...project, selectedWorldviews: next })
  }
  const characters: Character[] = project.characters ?? []
  const plotPlan: PlotPlan | null = project.plotPlan ?? null
  const stageCount = plotPlan?.stageCount ?? 3

  const setLogline = (v: string) => setProject({ ...project, logline: v })

  const setCharacters = (chars: Character[]) => setProject({ ...project, characters: chars })

  const addCharacter = () => {
    setCharacters([
      ...characters,
      {
        id: `char-${Date.now()}`,
        name: "",
        appearance: "",
        personality: "",
        values: "",
        trauma: "",
      },
    ])
  }

  const updateCharacter = (id: string, field: keyof Character, value: string) =>
    setCharacters(
      characters.map((c) =>
        c.id === id ? { ...c, [field]: field === "gender" ? (value as Character["gender"]) : value } : c
      )
    )

  const removeCharacter = (id: string) => setCharacters(characters.filter((c) => c.id !== id))

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

  const handleAutoGenerate = async () => {
    setIsGenerating(true)
    await new Promise((r) => setTimeout(r, 1200))
    const stages = generatePlotStages(logline, characters, stageCount)
    setProject({ ...project, plotPlan: { stageCount, stages } })
    setIsGenerating(false)
  }

  useEffect(() => {
    if (!project.plotPlan) {
      const labels = STAGE_LABELS[stageCount]
      const stages = labels.map((label, i) => ({ id: `stage-${i}`, label, content: "" }))
      setProject({ ...project, plotPlan: { stageCount, stages } })
    }
  }, [])

  const plot = project.plotPlan ?? {
    stageCount: 3 as const,
    stages: STAGE_LABELS[3].map((label, i) => ({ id: `stage-${i}`, label, content: "" })),
  }

  const canProceed =
    !!logline.trim() &&
    characters.length > 0 &&
    plot.stages.some((s) => s.content.trim())

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── 상단: 반응형 — 모바일에서 세로 배치 ── */}
      <div className="flex-shrink-0 border-b border-[#E0E0E0] bg-white">
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">1. 기획</h1>
          <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-[#E0E0E0] w-full sm:w-auto">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white rounded-l-md"
              style={{ backgroundColor: COLORS.tabActive }}
            >
              기획
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-[#F0F0F0] hover:bg-[#E8E8E8]"
            >
              시각화
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-[#F0F0F0] hover:bg-[#E8E8E8] rounded-r-md"
            >
              영상화
            </button>
          </div>
        </div>
      </div>

      {/* ── 본문: 반응형 패딩·간격 ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          <LoglineSection
            logline={logline}
            onChange={setLogline}
            genreOptions={GENRE_OPTIONS}
            worldviewOptions={WORLDVIEW_OPTIONS}
            selectedGenres={selectedGenres}
            selectedWorldviews={selectedWorldviews}
            onToggleGenre={toggleGenre}
            onToggleWorldview={toggleWorldview}
            onRefresh={() => setLogline("")}
          />
          <CharactersSection
            characters={characters}
            onAdd={addCharacter}
            onUpdate={updateCharacter}
            onRemove={removeCharacter}
            onImageUpload={handleImageUpload}
            onEditClick={setCharacterModalId}
          />
          <PlotSection
            plotPlan={plot}
            onStageCountChange={setStageCount}
            onStageUpdate={updateStage}
            onAutoGenerate={handleAutoGenerate}
            onStageEditClick={setPlotModalStageId}
            isGenerating={isGenerating}
            hasCharacters={characters.length > 0}
            hasLogline={!!logline.trim()}
          />
        </div>
      </main>

      {/* ── 하단: 반응형 — 모바일에서 버튼 세로·풀너비 ── */}
      <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-4xl mx-auto flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {onBack ? (
            <Button
              variant="outline"
              onClick={onBack}
              className="rounded-lg border-[#E0E0E0] text-gray-800 hover:bg-[#F0F0F0] gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              이전 단계로
            </Button>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="rounded-lg text-white font-medium px-5 py-2.5 gap-2 disabled:opacity-50 w-full sm:w-auto"
            style={{ backgroundColor: canProceed ? COLORS.primary : COLORS.border }}
          >
            다음 단계로
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 캐릭터 수정 모달 (plan -2 cha modal) */}
      <CharacterEditModal
        character={characterModalId ? characters.find((c) => c.id === characterModalId) ?? null : null}
        open={!!characterModalId}
        onOpenChange={(open) => !open && setCharacterModalId(null)}
        onSave={(char) => {
          setCharacters(characters.map((c) => (c.id === char.id ? char : c)))
          setCharacterModalId(null)
        }}
        onRemove={(id) => {
          removeCharacter(id)
          setCharacterModalId(null)
        }}
      />

      {/* 플롯 단계 수정 모달 (plan -2 plot modal) */}
      <PlotStageEditModal
        stage={
          plotModalStageId
            ? plot.stages.find((s) => s.id === plotModalStageId) ?? null
            : null
        }
        stageIndex={
          plotModalStageId
            ? plot.stages.findIndex((s) => s.id === plotModalStageId)
            : 0
        }
        open={!!plotModalStageId}
        onOpenChange={(open) => !open && setPlotModalStageId(null)}
        onSave={(stage) => {
          updateStage(stage.id, stage.content)
          setPlotModalStageId(null)
        }}
      />
    </div>
  )
}
