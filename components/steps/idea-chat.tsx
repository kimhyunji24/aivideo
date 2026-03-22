"use client"

import { useEffect, useMemo, useState } from "react"
import type { ProjectState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, ArrowRight, Lightbulb, FileText, RefreshCw, Triangle, PenTool } from "lucide-react"
import { generateCharacters, generateLogline, generatePlanningTags, updateSession } from "@/lib/api"

const AI_GREETING =
  "안녕하세요! 저는 AI 기획 어시스턴트입니다. 어떤 이야기를 만들고 싶으신가요? 장르, 주인공, 배경, 분위기 등 떠오르는 것들을 자유롭게 말씀해 주세요."

const DEFAULT_GENRES = ["SF", "코미디", "사이버펑크", "판타지", "로맨스"] 
const DEFAULT_STYLES = ["3D 애니메이션", "2D 극장판 애니메이션", "실사 시네마틱", "디즈니 스타일"] 
const DEFAULT_WORLDVIEWS = ["우주", "전쟁터", "일상생활"]

const GENRE_OPTIONS = ["SF", "코미디", "사이버펑크", "판타지", "로맨스", "스릴러", "드라마"]
const STYLE_OPTIONS = ["3D 애니메이션", "2D 극장판 애니메이션", "실사 시네마틱", "디즈니 스타일", "수채화풍", "픽셀 아트"]
const WORLDVIEW_OPTIONS = ["우주", "전쟁터", "일상생활", "근미래 도시", "판타지 왕국", "학교"]

interface ChatMessage {
  role: "ai" | "user"
  content: string
}

interface IdeaChatProps {
  project: ProjectState
  setProject: (p: ProjectState) => void
  initialView?: "chat" | "summary"
  onNext: () => void
  sessionId?: string | null
}

const LOGLINE_LOADING_MESSAGE = "로그라인 생성중..."

function appendLoglineContext(existing: string | undefined, next: string): string {
  const incoming = next.trim()
  if (!incoming) return (existing ?? "").trim()
  const base = (existing ?? "").trim()
  if (!base) return incoming
  const lines = base.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const last = lines[lines.length - 1] ?? ""
  if (last === incoming) return base
  const merged = [...lines, incoming]
  return merged.slice(-12).join("\n")
}

function buildLogline(baseIdea: string, latestPrompt?: string): string {
  const coreIdea = baseIdea.trim()
  const revision = latestPrompt?.trim() ?? ""
  if (!coreIdea) return ""

  if (!revision || revision === coreIdea) {
    return `${coreIdea}를 바탕으로, 30초 이내의 숏폼 영상에 어울리는 시각적으로 강렬한 단일 장면.`
  }

  return `${coreIdea}를 기반으로 하되 "${revision}" 요구사항을 반영하여, 30초 이내 숏폼에 적합하게 연출한 임팩트 있는 핵심 장면.`
}

export function IdeaChat({ project, setProject, initialView = "chat", onNext, sessionId }: IdeaChatProps) {
  const [viewMode, setViewMode] = useState<"chat" | "summary">(initialView)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "ai", content: AI_GREETING }])
  const [input, setInput] = useState(project.idea ?? "")
  const [showConfirm, setShowConfirm] = useState(false)
  const [isGeneratingLogline, setIsGeneratingLogline] = useState(false)
  const [isRefreshingTags, setIsRefreshingTags] = useState(false)
  
  const [loglineDraft, setLoglineDraft] = useState(project.logline ?? "")
  const [selectedGenres, setSelectedGenres] = useState<string[]>(project.selectedGenres || DEFAULT_GENRES)
  const [selectedStyles, setSelectedStyles] = useState<string[]>(project.selectedStyles || DEFAULT_STYLES)
  const [selectedWorldviews, setSelectedWorldviews] = useState<string[]>(project.selectedWorldviews || DEFAULT_WORLDVIEWS)
  const [genreOptions, setGenreOptions] = useState<string[]>(project.selectedGenres || GENRE_OPTIONS)
  const [styleOptions, setStyleOptions] = useState<string[]>(project.selectedStyles || STYLE_OPTIONS)
  const [worldviewOptions, setWorldviewOptions] = useState<string[]>(project.selectedWorldviews || WORLDVIEW_OPTIONS)

  const toggleGenre = (tag: string) => {
    setSelectedGenres((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const toggleStyle = (tag: string) => {
    setSelectedStyles((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const toggleWorldview = (tag: string) => {
    setSelectedWorldviews((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const latestUserIdea = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content
    }
    return ""
  }, [messages])

  const loglinePreview = useMemo(() => {
    if (loglineDraft?.trim()) return loglineDraft
    if (project.logline?.trim()) return project.logline
    return buildLogline(project.idea ?? latestUserIdea ?? input, project.planningPrompt ?? latestUserIdea ?? input)
  }, [loglineDraft, project.logline, project.idea, project.planningPrompt, latestUserIdea, input])

  const applyTagSet = (
    genres: string[],
    styles: string[],
    worldviews: string[],
    genreOpts: string[] = genres,
    styleOpts: string[] = styles,
    worldviewOpts: string[] = worldviews
  ) => {
    const safeGenres = genres.length > 0 ? genres : DEFAULT_GENRES
    const safeStyles = styles.length > 0 ? styles : DEFAULT_STYLES
    const safeWorldviews = worldviews.length > 0 ? worldviews : DEFAULT_WORLDVIEWS
    setSelectedGenres(safeGenres)
    setSelectedStyles(safeStyles)
    setSelectedWorldviews(safeWorldviews)
    setGenreOptions(genreOpts.length > 0 ? genreOpts : safeGenres)
    setStyleOptions(styleOpts.length > 0 ? styleOpts : safeStyles)
    setWorldviewOptions(worldviewOpts.length > 0 ? worldviewOpts : safeWorldviews)
    return { safeGenres, safeStyles, safeWorldviews }
  }

  const fetchTagsFromApi = async (loglineText: string) => {
    if (!sessionId || !loglineText.trim()) return null
    try {
      return await generatePlanningTags(sessionId, loglineText)
    } catch (err) {
      console.error("Failed to generate tags via API:", err)
      return null
    }
  }

  const handleSend = async (idea?: string) => {
    if (isGeneratingLogline) return
    const text = (idea ?? input).trim()
    if (!text) return

    const existingBaseIdea = (project.idea ?? "").trim()
    const baseIdea = existingBaseIdea || text
    const nextContext = appendLoglineContext(project.loglineContext, text)

    setInput("")
    setShowConfirm(false)
    setIsGeneratingLogline(true)
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: LOGLINE_LOADING_MESSAGE },
    ])
    setProject({ ...project, idea: baseIdea, planningPrompt: text, loglineContext: nextContext })

    let generatedLogline = buildLogline(baseIdea, text)

    try {
      if (sessionId) {
        await updateSession(sessionId, {
          ...project,
          idea: baseIdea,
          planningPrompt: text,
          loglineContext: nextContext,
        })

        const loglineState = await generateLogline(sessionId, text)
        let merged: ProjectState = {
          ...project,
          ...loglineState,
          scenes: loglineState.scenes ?? project.scenes ?? [],
        }
        generatedLogline = loglineState.logline?.trim() || generatedLogline

        const apiTags = await fetchTagsFromApi(generatedLogline)
        const { safeGenres, safeStyles, safeWorldviews } = applyTagSet(
          apiTags?.selectedGenres ?? DEFAULT_GENRES,
          apiTags?.selectedStyles ?? DEFAULT_STYLES,
          apiTags?.selectedWorldviews ?? DEFAULT_WORLDVIEWS,
          apiTags?.genreOptions ?? [],
          apiTags?.styleOptions ?? [],
          apiTags?.worldviewOptions ?? []
        )

        try {
          const characterState = await generateCharacters(sessionId)
          merged = {
            ...merged,
            ...characterState,
            scenes: characterState.scenes ?? merged.scenes ?? [],
            selectedGenres: safeGenres,
            selectedStyles: safeStyles,
            selectedWorldviews: safeWorldviews,
          }
        } catch (err) {
          console.error("Failed to generate characters via API:", err)
        }

        setProject(merged)
        setLoglineDraft(generatedLogline)
      } else {
        const { safeGenres, safeStyles, safeWorldviews } = applyTagSet(DEFAULT_GENRES, DEFAULT_STYLES, DEFAULT_WORLDVIEWS)
        setProject({
          ...project,
          idea: baseIdea,
          planningPrompt: text,
          loglineContext: nextContext,
          logline: generatedLogline,
          selectedGenres: safeGenres,
          selectedStyles: safeStyles,
          selectedWorldviews: safeWorldviews,
        })
        setLoglineDraft(generatedLogline)
      }
    } catch (err) {
      if (sessionId) {
        console.error("Failed to generate logline via API:", err)
        alert("API Error in Logline: " + err)
        setLoglineDraft(generatedLogline)
      } else {
        setLoglineDraft(generatedLogline)
      }
    } finally {
      setIsGeneratingLogline(false)
    }

    setMessages((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "ai" && next[i].content === LOGLINE_LOADING_MESSAGE) {
          next[i] = { role: "ai", content: generatedLogline }
          break
        }
      }
      return next
    })
    setShowConfirm(true)
  }

  const handleConfirmLogline = () => {
    const idea = (project.idea ?? latestUserIdea ?? "").trim()
    if (!idea) return
    const nextLogline = loglineDraft?.trim() ? loglineDraft : buildLogline(idea, project.planningPrompt ?? latestUserIdea ?? "")
    setLoglineDraft(nextLogline)

    setProject({
      ...project,
      idea,
      logline: nextLogline,
      selectedGenres,
      selectedStyles,
      selectedWorldviews,
    })
    setViewMode("summary")
  }

  const handleMoveToWorkspace = () => {
    const finalizedLogline = loglineDraft.trim() || loglinePreview
    setProject({
      ...project,
      logline: finalizedLogline,
      selectedGenres,
      selectedStyles,
      selectedWorldviews,
    })
    onNext()
  }

  useEffect(() => {
    setViewMode(initialView)
  }, [initialView])

  if (viewMode === "summary") {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <section className="space-y-10">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
              어떤 영상을 만들고 싶은가요?
            </h2>
          </div>

          <div className="mx-auto max-w-2xl rounded-3xl border border-[#BDBDBD] bg-[#F6F6F6] p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-2xl font-bold text-black">
              <Lightbulb className="h-5 w-5 fill-black" />
              <span>아이디어</span>
            </div>
            <div className="rounded-2xl border border-[#CFCFCF] bg-white px-4 py-3 text-sm leading-6 text-black">
              {project.idea}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#BDBDBD] bg-[#F6F6F6] p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-2xl font-bold text-black">
                  <FileText className="h-5 w-5 fill-black" />
                  <span>로그라인</span>
                </div>
              </div>
              <Textarea
                value={loglineDraft}
                onChange={(e) => setLoglineDraft(e.target.value)}
                rows={5}
                className="min-h-[130px] resize-none rounded-2xl border-[#CFCFCF] bg-white px-4 py-3 text-sm leading-6 text-black"
                placeholder="로그라인을 직접 수정해 주세요."
              />
            </div>

            <div className="rounded-3xl border border-[#BDBDBD] bg-[#F6F6F6] p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-2xl font-bold text-black">
                  <Triangle className="h-5 w-5 fill-black" />
                  <span>기획 태그</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (isRefreshingTags) return
                    setIsRefreshingTags(true)
                    try {
                      const currentLogline = (loglineDraft || project.logline || "").trim()
                      const apiTags = await fetchTagsFromApi(currentLogline)
                      applyTagSet(
                        apiTags?.selectedGenres ?? DEFAULT_GENRES,
                        apiTags?.selectedStyles ?? DEFAULT_STYLES,
                        apiTags?.selectedWorldviews ?? DEFAULT_WORLDVIEWS,
                        apiTags?.genreOptions ?? [],
                        apiTags?.styleOptions ?? [],
                        apiTags?.worldviewOptions ?? []
                      )
                    } finally {
                      setIsRefreshingTags(false)
                    }
                  }}
                  disabled={isRefreshingTags}
                  className="rounded-full p-1 text-black hover:bg-black/5"
                  aria-label="태그 다시 생성"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingTags ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="flex flex-wrap items-stretch justify-between gap-y-4">
                <div className="flex w-full flex-col gap-2 sm:w-[30%]">
                  <p className="text-xs font-semibold text-gray-600">스토리 장르</p>
                  <div className="flex flex-wrap gap-2">
                    {genreOptions.map((genre) => (
                      <button
                        type="button"
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selectedGenres.includes(genre)
                            ? "border-black bg-black text-white"
                            : "border-[#CFCFCF] bg-white text-black hover:bg-gray-50"
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden h-auto w-px bg-[#CFCFCF] sm:block" />

                <div className="flex w-full flex-col gap-2 sm:w-[30%]">
                  <p className="text-xs font-semibold text-gray-600">시각적 스타일</p>
                  <div className="flex flex-wrap gap-2">
                    {styleOptions.map((style) => (
                      <button
                        type="button"
                        key={style}
                        onClick={() => toggleStyle(style)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selectedStyles.includes(style)
                            ? "border-black bg-black text-white"
                            : "border-[#CFCFCF] bg-white text-black hover:bg-gray-50"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden h-auto w-px bg-[#CFCFCF] sm:block" />

                <div className="flex w-full flex-col gap-2 sm:w-[30%]">
                  <p className="text-xs font-semibold text-gray-600">세계관 & 배경</p>
                  <div className="flex flex-wrap gap-2">
                    {worldviewOptions.map((worldview) => (
                      <button
                        type="button"
                        key={worldview}
                        onClick={() => toggleWorldview(worldview)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selectedWorldviews.includes(worldview)
                            ? "border-black bg-black text-white"
                            : "border-[#CFCFCF] bg-white text-black hover:bg-gray-50"
                        }`}
                      >
                        {worldview}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleMoveToWorkspace}
              className="h-11 rounded-full bg-black px-8 text-sm font-semibold text-white hover:bg-black/90 btn-unified"
            >
              기획 워크스페이스로 이동
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col px-4 sm:px-0 min-h-0 flex-1" style={{ minHeight: "min(640px, calc(100vh - 180px))" }}>
      <div className="text-center mb-5 sm:mb-6 flex-shrink-0">
        <div className="h-12 sm:h-16"></div>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-black animate-fade-up">어떤 이야기를 만들고 싶으신가요?</h2>
        <p className="text-xl text-gray-500 mt-3 animate-fade-up stagger-1">아이디어를 이야기해 주시면 로그라인·캐릭터·플롯으로 발전시켜 드립니다</p>
      </div>

      <div className="flex-1 glass-surface overflow-hidden flex flex-col min-h-0 animate-fade-up stagger-2">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "items-start"}`}>
              {msg.role === "ai" && (
                <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                  <PenTool className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-3xl px-5 py-4 text-3 leading-relaxed transition-all duration-300 ${
                  msg.role === "ai"
                    ? "glass-surface text-gray-700"
                    : "bg-black text-white shadow-lg"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {showConfirm && (
            <div className="flex justify-center pt-2 pb-1">
              <Button onClick={handleConfirmLogline} className="bg-black hover:bg-gray-800 text-white gap-2 rounded-full px-8 h-11 btn-unified press-down shadow-lg">
                이 로그라인으로 확정
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] p-3 sm:p-4 flex gap-2 flex-shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGeneratingLogline}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (isGeneratingLogline) return
                void handleSend()
              }
            }}
            placeholder={isGeneratingLogline ? "로그라인 생성중에는 입력할 수 없습니다." : "이야기 아이디어를 입력하세요... (Enter로 전송)"}
            rows={2}
            className="resize-none text-sm bg-white focus-visible:ring-0 input-unified outline-none border-none ring-0"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isGeneratingLogline}
            className="bg-black hover:bg-gray-800 text-white self-end h-11 w-11 p-0 flex-shrink-0 rounded-xl press-down shadow-md"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
