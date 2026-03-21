"use client"

import { useEffect, useMemo, useState } from "react"
import type { ProjectState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, ArrowRight, Lightbulb, FileText, RefreshCw, Triangle, PenTool } from "lucide-react"
import { generateCharacters, generateLogline, generatePlanningTags } from "@/lib/api"

const AI_GREETING =
  "안녕하세요! 저는 AI 기획 어시스턴트입니다. 어떤 이야기를 만들고 싶으신가요? 장르, 주인공, 배경, 분위기 등 떠오르는 것들을 자유롭게 말씀해 주세요."

const GENRE_POOL = ["SF", "코미디", "사이버펑", "로맨스", "스릴러", "판타지", "미스터리", "액션", "드라마", "느와르"]
const WORLDVIEW_POOL = ["우주", "근미래 도시", "판타지 왕국", "전쟁터", "일상생활", "학교", "디스토피아", "포스트아포칼립스", "해양", "사막"]
const DEFAULT_GENRES = ["SF", "코미디", "드라마"]
const DEFAULT_WORLDVIEWS = ["우주", "근미래 도시", "일상생활"]

type ContextRule = {
  triggers: string[]
  genres: string[]
  worldviews: string[]
}

const CONTEXT_RULES: ContextRule[] = [
  { triggers: ["우주", "행성", "은하", "외계", "우주선"], genres: ["SF", "액션"], worldviews: ["우주", "근미래 도시"] },
  { triggers: ["학교", "교실", "학생", "선생"], genres: ["드라마", "코미디"], worldviews: ["학교", "일상생활"] },
  { triggers: ["전쟁", "전장", "군인", "반란"], genres: ["액션", "드라마", "느와르"], worldviews: ["전쟁터", "디스토피아"] },
  { triggers: ["마법", "왕국", "드래곤", "신화", "검"], genres: ["판타지", "액션"], worldviews: ["판타지 왕국", "사막"] },
  { triggers: ["사랑", "연인", "고백", "이별", "재회"], genres: ["로맨스", "드라마"], worldviews: ["일상생활", "학교"] },
  { triggers: ["추적", "살인", "범인", "비밀", "음모", "위협"], genres: ["스릴러", "미스터리", "느와르"], worldviews: ["디스토피아", "근미래 도시"] },
  { triggers: ["해킹", "네온", "기업", "ai", "로봇", "기계"], genres: ["사이버펑", "SF", "스릴러"], worldviews: ["근미래 도시", "디스토피아"] },
  { triggers: ["생존", "폐허", "멸망", "바이러스"], genres: ["스릴러", "드라마"], worldviews: ["포스트아포칼립스", "사막"] },
]

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

function buildLogline(idea: string): string {
  const coreIdea = idea.trim()
  if (!coreIdea) return ""

  return `${coreIdea}를 바탕으로, 주인공이 예상치 못한 위기 속에서 감정적 성장과 반전을 만들어내는 단편 서사.`
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items))
}

function shuffle(items: string[]): string[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

function buildContextualTags(text: string, randomize = false) {
  const normalized = text.toLowerCase()
  const matchedGenres: string[] = []
  const matchedWorldviews: string[] = []

  CONTEXT_RULES.forEach((rule) => {
    const hit = rule.triggers.some((trigger) => normalized.includes(trigger.toLowerCase()))
    if (!hit) return
    matchedGenres.push(...rule.genres)
    matchedWorldviews.push(...rule.worldviews)
  })

  const baseGenres = unique(matchedGenres)
  const baseWorldviews = unique(matchedWorldviews)

  const genreCandidates =
    baseGenres.length > 0 ? baseGenres : DEFAULT_GENRES
  const worldviewCandidates =
    baseWorldviews.length > 0 ? baseWorldviews : DEFAULT_WORLDVIEWS

  const orderedGenres = randomize ? shuffle(genreCandidates) : genreCandidates
  const orderedWorldviews = randomize ? shuffle(worldviewCandidates) : worldviewCandidates

  return {
    genreOptions: orderedGenres.slice(0, 7),
    worldviewOptions: orderedWorldviews.slice(0, 7),
    selectedGenres: orderedGenres.slice(0, 3),
    selectedWorldviews: orderedWorldviews.slice(0, 3),
  }
}

export function IdeaChat({ project, setProject, initialView = "chat", onNext, sessionId }: IdeaChatProps) {
  const [viewMode, setViewMode] = useState<"chat" | "summary">(initialView)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "ai", content: AI_GREETING }])
  const [input, setInput] = useState(project.idea ?? "")
  const [showConfirm, setShowConfirm] = useState(false)
  const [isGeneratingLogline, setIsGeneratingLogline] = useState(false)
  const [isRefreshingTags, setIsRefreshingTags] = useState(false)
  const [loglineDraft, setLoglineDraft] = useState(project.logline ?? "")
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    project.selectedGenres?.length ? project.selectedGenres : DEFAULT_GENRES
  )
  const [selectedWorldviews, setSelectedWorldviews] = useState<string[]>(
    project.selectedWorldviews?.length ? project.selectedWorldviews : DEFAULT_WORLDVIEWS
  )
  const [genreOptions, setGenreOptions] = useState<string[]>(GENRE_POOL.slice(0, 7))
  const [worldviewOptions, setWorldviewOptions] = useState<string[]>(WORLDVIEW_POOL.slice(0, 7))

  const toggleGenre = (tag: string) => {
    setSelectedGenres((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
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
    return buildLogline(project.idea ?? latestUserIdea ?? input)
  }, [loglineDraft, project.logline, project.idea, latestUserIdea, input])

  const handleSend = async (idea?: string) => {
    if (isGeneratingLogline) return
    const text = (idea ?? input).trim()
    if (!text) return

    setInput("")
    setShowConfirm(false)
    setIsGeneratingLogline(true)
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: LOGLINE_LOADING_MESSAGE },
    ])
    setProject({ ...project, idea: text })

    let generatedLogline = buildLogline(text)

    const applyRecommendedTags = async (generatedText: string) => {
      const sourceText = `${generatedText} ${text}`
      if (sessionId) {
        try {
          const apiTags = await generatePlanningTags(sessionId, generatedText)
          setGenreOptions(apiTags.genreOptions)
          setWorldviewOptions(apiTags.worldviewOptions)
          setSelectedGenres(apiTags.selectedGenres)
          setSelectedWorldviews(apiTags.selectedWorldviews)
          return { recommendedGenres: apiTags.selectedGenres, recommendedWorldviews: apiTags.selectedWorldviews }
        } catch (tagErr) {
          console.error("Failed to generate tags via API:", tagErr)
        }
      }
      const contextual = buildContextualTags(sourceText, true)
      setGenreOptions(contextual.genreOptions)
      setWorldviewOptions(contextual.worldviewOptions)
      setSelectedGenres(contextual.selectedGenres)
      setSelectedWorldviews(contextual.selectedWorldviews)
      return { recommendedGenres: contextual.selectedGenres, recommendedWorldviews: contextual.selectedWorldviews }
    }

    try {
      if (sessionId) {
        const loglineState = await generateLogline(sessionId, text)
        generatedLogline = loglineState.logline?.trim() || generatedLogline
        const { recommendedGenres, recommendedWorldviews } = await applyRecommendedTags(generatedLogline)
        let merged: ProjectState = {
          ...project,
          ...loglineState,
          scenes: loglineState.scenes ?? project.scenes ?? [],
          selectedGenres: recommendedGenres,
          selectedWorldviews: recommendedWorldviews,
        }

        try {
          const characterState = await generateCharacters(sessionId)
          merged = {
            ...merged,
            ...characterState,
            scenes: characterState.scenes ?? merged.scenes ?? [],
            selectedGenres: merged.selectedGenres,
            selectedWorldviews: merged.selectedWorldviews,
          }
        } catch (err) {
          console.error("Failed to generate characters via API:", err)
        }

        setProject(merged)
        setLoglineDraft(generatedLogline)
      } else {
        const { recommendedGenres, recommendedWorldviews } = await applyRecommendedTags(generatedLogline)
        setProject({
          ...project,
          idea: text,
          logline: generatedLogline,
          selectedGenres: recommendedGenres,
          selectedWorldviews: recommendedWorldviews,
        })
        setLoglineDraft(generatedLogline)
      }
    } catch (err) {
      if (sessionId) {
        console.error("Failed to generate logline via API:", err)
        alert("API Error in Logline: " + err)
        const { recommendedGenres, recommendedWorldviews } = await applyRecommendedTags(generatedLogline)
        setProject({
          ...project,
          idea: text,
          logline: generatedLogline,
          selectedGenres: recommendedGenres,
          selectedWorldviews: recommendedWorldviews,
        })
        setLoglineDraft(generatedLogline)
      } else {
        const { recommendedGenres, recommendedWorldviews } = await applyRecommendedTags(generatedLogline)
        setProject({
          ...project,
          idea: text,
          logline: generatedLogline,
          selectedGenres: recommendedGenres,
          selectedWorldviews: recommendedWorldviews,
        })
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
    const nextLogline = loglineDraft?.trim() ? loglineDraft : buildLogline(idea)
    setLoglineDraft(nextLogline)

    setProject({
      ...project,
      idea,
      logline: nextLogline,
      selectedGenres,
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
                  <span>장르 & 스타일</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (isRefreshingTags) return
                    setIsRefreshingTags(true)
                    const sourceText = `${loglineDraft || project.logline || ""} ${project.idea || latestUserIdea || ""}`
                    try {
                      if (sessionId && (loglineDraft || project.logline)) {
                        try {
                          const apiTags = await generatePlanningTags(sessionId, loglineDraft || project.logline)
                          setGenreOptions(apiTags.genreOptions)
                          setWorldviewOptions(apiTags.worldviewOptions)
                          setSelectedGenres(apiTags.selectedGenres)
                          setSelectedWorldviews(apiTags.selectedWorldviews)
                          return
                        } catch (tagErr) {
                          console.error("Failed to refresh tags via API:", tagErr)
                        }
                      }
                      const contextual = buildContextualTags(sourceText, true)
                      setGenreOptions(contextual.genreOptions)
                      setWorldviewOptions(contextual.worldviewOptions)
                      setSelectedGenres(contextual.selectedGenres)
                      setSelectedWorldviews(contextual.selectedWorldviews)
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <div className="flex flex-wrap gap-2">
                  <p className="w-full text-xs font-semibold text-gray-600">장르 & 스타일</p>
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

                <div className="hidden h-full w-px bg-[#CFCFCF] sm:block" />

                <div className="flex flex-wrap gap-2">
                  <p className="w-full text-xs font-semibold text-gray-600">세계관 & 배경</p>
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
        <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full px-4 py-2 mb-3">
          <PenTool className="h-4 w-4 text-black" />
          <span className="text-sm font-semibold text-black">사이트명</span>
        </div>
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
                handleSend()
              }
            }}
            placeholder={isGeneratingLogline ? "로그라인 생성중에는 입력할 수 없습니다." : "이야기 아이디어를 입력하세요... (Enter로 전송)"}
            rows={2}
            className="resize-none text-sm bg-white focus-visible:ring-0 input-unified outline-none border-none ring-0"
          />
          <Button
            onClick={() => handleSend()}
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
