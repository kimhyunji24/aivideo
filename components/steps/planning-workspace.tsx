"use client"

import { useState, useRef, useEffect } from "react"
import type {
  ProjectState,
  Character,
  PlotPlan,
  PlotStage,
  PlanningSeedRequest,
  PlanningSeedResponse,
} from "@/lib/types"
import { generateCharacters, generatePlot, updateSession } from "@/lib/api"
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
  X,
  RefreshCcw,
  User,
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
  primary: "#000000",
  primaryHover: "#333333",
  tabActive: "#000000",
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

function generateCharactersFromLogline(
  logline: string,
  selectedGenres: string[],
  selectedWorldviews: string[]
): Character[] {
  const now = Date.now()
  const genreHint = selectedGenres.length > 0 ? selectedGenres.join(", ") : "기본"
  const worldviewHint =
    selectedWorldviews.length > 0 ? selectedWorldviews.join(", ") : "현실 세계"
  const shortLogline = logline.length > 60 ? `${logline.slice(0, 60)}...` : logline

  return [
    {
      id: `char-auto-main-${now}`,
      name: "주인공",
      appearance: `${worldviewHint}에서 살아가는 인물`,
      personality: "결핍이 있지만 끝까지 포기하지 않는 성격",
      values: "소중한 관계와 약속을 지키는 것",
      trauma: shortLogline || "예상치 못한 사건으로 생긴 상처",
    },
    {
      id: `char-auto-support-${now + 1}`,
      name: "대립/조력 인물",
      appearance: `${genreHint} 톤을 강화하는 대비적 인물`,
      personality: "냉정하지만 결정적인 순간에 변화를 만드는 성격",
      values: "현실적 선택과 생존",
      trauma: "주인공과 얽힌 과거 사건",
    },
  ]
}

function normalizeStageCount(stageCount?: number): 3 | 4 | 5 {
  if (stageCount === 4) return 4
  if (stageCount === 5) return 5
  return 3
}

function toCharacterSeeds(chars: PlanningSeedResponse["characters"]): Character[] {
  if (!Array.isArray(chars)) return []

  return chars.map((char, idx) => ({
    id: char.id || `char-auto-${Date.now()}-${idx}`,
    name: char.name || (idx === 0 ? "주인공" : "대립/조력 인물"),
    gender: char.gender === "male" || char.gender === "female" ? char.gender : undefined,
    appearance: char.appearance || "",
    personality: char.personality || "",
    values: char.values || "",
    trauma: char.trauma || "",
  }))
}

function toPlotPlanSeed(
  plotPlan: PlanningSeedResponse["plotPlan"]
): PlotPlan | null {
  if (!plotPlan || !Array.isArray(plotPlan.stages) || plotPlan.stages.length === 0) return null

  const stageCount = normalizeStageCount(plotPlan.stageCount)
  const labels = STAGE_LABELS[stageCount]
  const stages = labels.map((defaultLabel, idx) => {
    const seed = plotPlan.stages?.[idx]
    return {
      id: seed?.id || `stage-${idx}`,
      label: seed?.label || defaultLabel,
      content: seed?.content || "",
    }
  })

  if (stages.every((s) => !s.content.trim())) {
    return null
  }

  return { stageCount, stages }
}

// ─── Sub-components (목업 스타일) ───────────────────────────────────────────

function LoglineSection({
  logline,
  selectedGenres,
  selectedWorldviews,
}: {
  logline: string
  selectedGenres: string[]
  selectedWorldviews: string[]
}) {
  const genreStyleText =
    selectedGenres.length > 0 ? selectedGenres.join(", ") : "선택된 장르·스타일 없음"
  const worldviewText =
    selectedWorldviews.length > 0 ? selectedWorldviews.join(", ") : "선택된 세계관·배경 없음"

  const loglineText = logline || "로그라인이 아직 확정되지 않았습니다."
  const summaryText = `로그라인 : ${loglineText}\n장르&스타일 : ${genreStyleText}\n세계관&배경 : ${worldviewText}`

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg border border-[#E0E0E0] flex items-center justify-center">
          <Square className="h-4 w-4 text-gray-800" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">기획 요약</h2>
      </div>

      <Card className="border border-[#E0E0E0] shadow-none bg-white rounded-xl">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm leading-7 text-gray-800 break-keep whitespace-pre-line">{summaryText}</p>
        </CardContent>
      </Card>
    </section>
  )
}

function CharactersSection({
  characters,
  isConfirmed,
  isGenerating,
  canConfirm,
  onAdd,
  onConfirm,
  onUpdate,
  onRemove,
  onImageUpload,
  onEditClick,
}: {
  characters: Character[]
  isConfirmed: boolean
  isGenerating: boolean
  canConfirm: boolean
  onAdd: () => void
  onConfirm: () => void
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
        <div className="flex items-center gap-2">
          <Button
            onClick={onAdd}
            variant="outline"
            size="sm"
            className="rounded-lg border-[#E0E0E0] text-gray-800 hover:bg-[#F0F0F0]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            캐릭터 추가
          </Button>
          <Button
            onClick={onConfirm}
            size="sm"
            disabled={!canConfirm || isConfirmed || isGenerating}
            className="rounded-lg text-white"
            style={{ backgroundColor: isConfirmed ? "#9CA3AF" : COLORS.primary }}
          >
            {isConfirmed ? "캐릭터 확정 완료" : isGenerating ? "확정 중..." : "캐릭터 확정"}
          </Button>
        </div>
      </div>

      {characters.length === 0 ? (
        <Card
          className="border border-dashed border-[#E0E0E0] rounded-xl p-12 text-center bg-white cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={onAdd}
        >
          <p className="text-gray-500 text-sm mb-3">아직 캐릭터가 없습니다</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-[#E0E0E0] text-gray-800"
            onClick={(e) => { e.stopPropagation(); onAdd() }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            첫 번째 캐릭터 추가
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char, idx) => {
            const displayName = char.name || `Jack`;
            return (
              <Card
                key={char.id}
                className="border border-[#E0E0E0] shadow-none bg-white rounded-2xl overflow-hidden p-5 relative flex flex-col justify-between hover-lift animate-fade-up"
              >
                <div className="absolute top-4 right-4">
                  <button type="button" className="icon-btn p-1">
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-24 h-24 rounded-full bg-[#F5F5F5] border border-[#E0E0E0] overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center relative"
                      onClick={() => fileRefs.current[char.id]?.click()}
                    >
                      {char.imageUrl ? (
                        <img src={char.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-gray-400" />
                      )}
                      
                      {/* Image upload input hidden */}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileRefs.current[char.id] = el }}
                        onChange={(e) => e.target.files?.[0] && onImageUpload(char.id, e.target.files[0])}
                      />
                    </div>
                    
                    <div className="flex flex-col flex-1 pt-2">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="font-bold text-gray-900 text-base">{displayName}</span>
                        {char.gender && (
                          <span className="text-sm font-semibold text-gray-800">
                            ({GENDER_LABEL[char.gender]})
                          </span>
                        )}
                        {!char.name && !char.gender && (
                          <span className="text-sm font-semibold text-gray-800">
                            ({idx === 0 ? "주인공" : "남/여"})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed min-h-[4rem] whitespace-pre-wrap mb-4">
                    {char.appearance || char.personality || "통통한 체구...\n요리 기술을 전투 기술로 승화."}
                  </p>
                </div>

                <Button
                  onClick={() => onEditClick(char.id)}
                  className="w-full rounded-full text-white text-sm font-medium h-10 btn-unified press-down"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  수정하기
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  )
}

function PlotSection({
  plotPlan,
  userPrompt,
  onUserPromptChange,
  onStageCountChange,
  onStageUpdate,
  onAutoGenerate,
  onStageEditClick,
  isGenerating,
  hasCharacters,
  isCharacterConfirmed,
  hasLogline,
}: {
  plotPlan: PlotPlan
  userPrompt: string
  onUserPromptChange: (value: string) => void
  onStageCountChange: (n: 3 | 4 | 5) => void
  onStageUpdate: (id: string, content: string) => void
  onAutoGenerate: () => void
  /** 수정하기 클릭 시 호출 — 플롯 수정 모달을 연다 */
  onStageEditClick: (stageId: string) => void
  isGenerating: boolean
  hasCharacters: boolean
  isCharacterConfirmed: boolean
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

      {(hasCharacters || hasLogline) && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E0E0E0] bg-white p-4">
          <p className="text-sm text-gray-700">
            {isCharacterConfirmed
              ? "플롯 단계를 먼저 선택한 뒤, 생성 버튼을 눌러 AI 플롯을 만듭니다."
              : "캐릭터 확정 버튼을 누르면 플롯 자동 생성을 사용할 수 있습니다."}
          </p>
          <Button
            onClick={onAutoGenerate}
            disabled={isGenerating || !isCharacterConfirmed}
            size="sm"
            className="rounded-lg text-white font-medium shrink-0 gap-1.5"
            style={{ backgroundColor: COLORS.primary }}
          >
            {isGenerating ? (
              <>생성 중...</>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                플롯 생성
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
            disabled={isGenerating || !isCharacterConfirmed}
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

      <div className="rounded-2xl border border-[#E0E0E0] bg-[#F5F5F5] px-4 py-3 flex items-center justify-between">
        <Input
          value={userPrompt}
          onChange={(e) => onUserPromptChange(e.target.value)}
          placeholder="추가 요구사항 작성 창"
          className="border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 w-full"
        />
        <button type="button" className="text-gray-500 hover:text-gray-800 ml-2">
           <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plotPlan.stages.map((stage, i) => (
          <Card
            key={stage.id}
          className="border border-[#E0E0E0] shadow-sm bg-white rounded-2xl overflow-hidden flex flex-col p-5 hover-lift animate-fade-up"
          >
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3 mb-4">
               <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 text-xs font-semibold text-gray-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{stage.label}</span>
               </div>
               <button type="button" className="icon-btn p-1">
                  <RefreshCcw className="w-4 h-4" />
               </button>
            </div>
            
            <p className="flex-1 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap mb-6 line-clamp-6">
               {stage.content || `${stage.label} 단계의 내용이 들어갑니다.`}
            </p>
            
            <Button
              className="w-full rounded-full text-white text-sm font-medium h-10 btn-unified press-down mt-auto"
              style={{ backgroundColor: COLORS.primary }}
              onClick={() => onStageEditClick(stage.id)}
            >
              수정하기
            </Button>
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
  const imageInputRef = useRef<HTMLInputElement | null>(null)

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
        className="sm:max-w-none w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-[640px] md:max-w-[860px] xl:max-w-[1120px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border-2 border-[#686868] bg-white shadow-xl flex flex-col"
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
              placeholder="캐릭터를 한 문장으로 설명해 주세요"
              rows={5}
              className="resize-none rounded-xl border border-[#BABABA] bg-white text-sm focus-visible:ring-2 focus-visible:ring-offset-0"
            />

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-600">캐릭터 사진</span>
                <div className="flex items-center gap-2">
                  {draft.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-gray-600 hover:text-gray-900"
                      onClick={() =>
                        setDraft((prev) => (prev ? { ...prev, imageUrl: undefined } : null))
                      }
                    >
                      제거
                    </Button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full h-44 rounded-xl border border-[#BABABA] bg-[#F5F5F5] overflow-hidden flex items-center justify-center"
              >
                {draft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.imageUrl} alt={`${draft.name || "캐릭터"} 이미지`} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-500">
                    <Upload className="h-6 w-6 mx-auto mb-1" />
                    <span className="text-xs">사진을 추가해 주세요</span>
                  </div>
                )}
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const url = URL.createObjectURL(file)
                  setDraft((prev) => (prev ? { ...prev, imageUrl: url } : null))
                }}
              />
            </div>
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
                <label className="text-xs font-medium text-gray-600 block mb-1">캐릭터 관계성</label>
                <Textarea
                  value={draft.trauma}
                  onChange={(e) => setDraft((p) => (p ? { ...p, trauma: e.target.value } : null))}
                  placeholder="다른 캐릭터와의 관계성"
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
        className="sm:max-w-none w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-[640px] md:max-w-[860px] xl:max-w-[1120px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border-2 border-[#686868] bg-white shadow-xl flex flex-col"
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
  sessionId: string | null
}

export function PlanningWorkspace({ project, setProject, onNext, onBack, sessionId }: PlanningWorkspaceProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [characterModalId, setCharacterModalId] = useState<string | null>(null)
  const [plotModalStageId, setPlotModalStageId] = useState<string | null>(null)
  const hasAutoSeededRef = useRef(false)

  const logline = project.logline?.trim() || project.idea || ""
  const selectedGenres = project.selectedGenres ?? []
  const selectedWorldviews = project.selectedWorldviews ?? []
  const planningPrompt = project.planningPrompt ?? ""
  const charactersConfirmed = project.charactersConfirmed ?? false
  const characters: Character[] = project.characters ?? []
  const plotPlan: PlotPlan | null = project.plotPlan ?? null

  const setCharacters = (chars: Character[]) =>
    setProject({ ...project, characters: chars, charactersConfirmed: false })

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

  const confirmCharacters = () => {
    if (charactersConfirmed || isGenerating) return
    setProject({ ...project, charactersConfirmed: true })
  }

  const setStageCount = (n: 3 | 4 | 5) => {
    if (!charactersConfirmed) return
    const labels = STAGE_LABELS[n]
    const stages = labels.map((label, i) => ({
      id: `stage-${i}`,
      label,
      content: "",
    }))
    setProject({
      ...project,
      charactersConfirmed: true,
      plotPlan: { stageCount: n, stages },
    })
  }

  const updateStage = (id: string, content: string) => {
    if (!plotPlan) return
    setProject({
      ...project,
      plotPlan: { ...plotPlan, stages: plotPlan.stages.map((s) => (s.id === id ? { ...s, content } : s)) },
    })
  }

  const generatePlotForStage = async (targetStageCount: 3 | 4 | 5) => {
    if (!sessionId) return
    setIsGenerating(true)
    try {
      await updateSession(sessionId, project)
      const nextState = await generatePlot(sessionId, targetStageCount, planningPrompt)
      setProject(nextState)
    } catch (e) {
      console.error(e);
      alert("API Error in Plot/Characters: " + e);
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAutoGenerate = async () => {
    if (!charactersConfirmed) return
    const targetStageCount = normalizeStageCount(plotPlan?.stageCount)
    await generatePlotForStage(targetStageCount)
  }

  useEffect(() => {
    if (hasAutoSeededRef.current) return
    if (!logline.trim()) return

    const hasCharacters = characters.length > 0
    if (hasCharacters) {
      hasAutoSeededRef.current = true
      return
    }

    hasAutoSeededRef.current = true

    let cancelled = false
    const autoSeed = async () => {
      try {
        if (!sessionId) return
        await updateSession(sessionId, project)
        const nextState = await generateCharacters(sessionId)
        if (!cancelled) setProject({ ...project, ...nextState, scenes: nextState.scenes ?? project.scenes ?? [] })
      } catch (e) {
        console.error(e);
        alert("API Error in autoSeed Characters: " + e);
      }
    }

    void autoSeed()
    return () => {
      cancelled = true
    }
  }, [characters, logline, project, sessionId, setProject])

  const plot = project.plotPlan ?? {
    stageCount: 3 as const,
    stages: STAGE_LABELS[3].map((label, i) => ({ id: `stage-${i}`, label, content: "" })),
  }

  const canProceed = charactersConfirmed && plot.stages.some((s) => s.content.trim())

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* ── 상단: 반응형 — 모바일에서 세로 배치 ── */}
      <div className="flex-shrink-0 border-b border-[#E0E0E0] bg-white">
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        </div>
      </div>

      {/* ── 본문: 반응형 패딩·간격 ── */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          <LoglineSection
            logline={logline}
            selectedGenres={selectedGenres}
            selectedWorldviews={selectedWorldviews}
          />
          <CharactersSection
            characters={characters}
            isConfirmed={charactersConfirmed}
            isGenerating={isGenerating}
            canConfirm={true}
            onAdd={addCharacter}
            onConfirm={confirmCharacters}
            onUpdate={updateCharacter}
            onRemove={removeCharacter}
            onImageUpload={handleImageUpload}
            onEditClick={setCharacterModalId}
          />
          {charactersConfirmed ? (
            <PlotSection
              plotPlan={plot}
              userPrompt={planningPrompt}
              onUserPromptChange={(value) => setProject({ ...project, planningPrompt: value })}
              onStageCountChange={setStageCount}
              onStageUpdate={updateStage}
              onAutoGenerate={handleAutoGenerate}
              onStageEditClick={setPlotModalStageId}
              isGenerating={isGenerating}
              hasCharacters={characters.length > 0}
              isCharacterConfirmed={charactersConfirmed}
              hasLogline={!!logline}
            />
          ) : (
            <Card className="border border-[#E0E0E0] shadow-none bg-white rounded-xl">
              <CardContent className="p-4 sm:p-5">
                <p className="text-sm text-gray-700">
                  캐릭터를 확정하면 플롯 영역이 열리고, 단계(3/4/5)를 선택할 때 AI가 자동 생성합니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* ── 하단: 반응형 — 모바일에서 버튼 세로·풀너비 ── */}
      <div className="flex-shrink-0 border-t border-[#E0E0E0] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-4xl mx-auto flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {onBack ? (
            <Button
              variant="ghost"
              onClick={onBack}
              className="rounded-lg text-gray-500 hover:text-black hover:bg-gray-100 gap-2 w-full sm:w-auto h-10 px-4 transition-all"
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
            className="rounded-lg text-white font-medium px-5 py-2.5 gap-2 disabled:opacity-50 w-full sm:w-auto btn-unified press-down shadow-md"
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
