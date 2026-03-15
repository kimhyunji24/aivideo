"use client"

import { useEffect, useMemo, useState } from "react"
import type { ProjectState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Send, ArrowRight, Lightbulb, FileText, RefreshCw, Triangle } from "lucide-react"

const AI_GREETING =
  "안녕하세요! 저는 AI 기획 어시스턴트입니다. 어떤 이야기를 만들고 싶으신가요? 장르, 주인공, 배경, 분위기 등 떠오르는 것들을 자유롭게 말씀해 주세요."

const DEFAULT_GENRES = ["SF", "코미디", "사이버펑", "픽사(Pixar) 스타일", "화려한 색감"]
const DEFAULT_WORLDVIEWS = ["우주", "전쟁터", "일상생활"]
const GENRE_OPTIONS = ["SF", "코미디", "사이버펑", "픽사(Pixar) 스타일", "화려한 색감", "로맨스", "스릴러"]
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
}

function buildLogline(idea: string): string {
  const coreIdea = idea.trim()
  if (!coreIdea) return ""

  return `${coreIdea}를 바탕으로, 주인공이 예상치 못한 위기 속에서 감정적 성장과 반전을 만들어내는 단편 서사.`
}

export function IdeaChat({ project, setProject, initialView = "chat", onNext }: IdeaChatProps) {
  const [viewMode, setViewMode] = useState<"chat" | "summary">(initialView)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "ai", content: AI_GREETING }])
  const [input, setInput] = useState(project.idea ?? "")
  const [showConfirm, setShowConfirm] = useState(false)
  const [loglineDraft, setLoglineDraft] = useState(project.logline ?? "")
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    project.selectedGenres?.length ? project.selectedGenres : DEFAULT_GENRES
  )
  const [selectedWorldviews, setSelectedWorldviews] = useState<string[]>(
    project.selectedWorldviews?.length ? project.selectedWorldviews : DEFAULT_WORLDVIEWS
  )

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
    if (project.logline?.trim()) return project.logline
    return buildLogline(project.idea ?? latestUserIdea ?? input)
  }, [project.logline, project.idea, latestUserIdea, input])

  const handleSend = (idea?: string) => {
    const text = (idea ?? input).trim()
    if (!text) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setProject({ ...project, idea: text, charactersConfirmed: false })

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `훌륭한 아이디어네요! "${text}"를 기반으로 로그라인·캐릭터·플롯을 함께 설계해 볼게요. 기획 워크스페이스로 이동하면 캐릭터 시트가 자동 생성되고, 캐릭터 확정 후 1차 플롯을 생성할 수 있습니다.`,
        },
      ])
      setShowConfirm(true)
    }, 500)
  }

  const handleConfirmLogline = () => {
    const idea = (project.idea ?? latestUserIdea ?? "").trim()
    if (!idea) return
    const nextLogline = buildLogline(idea)
    setLoglineDraft(nextLogline)

    setProject({
      ...project,
      idea,
      logline: nextLogline,
      charactersConfirmed: false,
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
      charactersConfirmed: false,
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
                <button
                  type="button"
                  onClick={() => setLoglineDraft(buildLogline(project.idea ?? latestUserIdea ?? ""))}
                  className="rounded-full p-1 text-black hover:bg-black/5"
                  aria-label="로그라인 다시 생성"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
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
                  onClick={() => {
                    setSelectedGenres(DEFAULT_GENRES)
                    setSelectedWorldviews(DEFAULT_WORLDVIEWS)
                  }}
                  className="rounded-full p-1 text-black hover:bg-black/5"
                  aria-label="태그 다시 생성"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <div className="flex flex-wrap gap-2">
                  <p className="w-full text-xs font-semibold text-gray-600">장르 & 스타일</p>
                  {GENRE_OPTIONS.map((genre) => (
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
                  {WORLDVIEW_OPTIONS.map((worldview) => (
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
              className="h-11 rounded-full bg-black px-8 text-sm font-semibold text-white hover:bg-black/90"
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
        <div className="inline-flex items-center gap-2 bg-[#E9ECF9] border border-[#D8DCF4] rounded-full px-4 py-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#4F46E5]" />
          <span className="text-sm font-semibold text-[#4F46E5]">AI 기획 어시스턴트</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111827]">어떤 이야기를 만들고 싶으신가요?</h2>
        <p className="text-xl text-[#6B7280] mt-3">아이디어를 이야기해 주시면 로그라인·캐릭터·플롯으로 발전시켜 드립니다</p>
      </div>

      <div className="flex-1 bg-[#F9FAFB] rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "items-start"}`}>
              {msg.role === "ai" && (
                <div className="h-10 w-10 rounded-full bg-[#4F46E5] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-3xl px-5 py-4 text-3 leading-relaxed ${
                  msg.role === "ai"
                    ? "bg-[#ECEEF2] text-[#374151]"
                    : "bg-[#4F46E5] text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {showConfirm && (
            <div className="flex justify-center pt-2 pb-1">
              <Button onClick={handleConfirmLogline} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white gap-2 rounded-full px-8 h-11">
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="이야기 아이디어를 입력하세요... (Enter로 전송)"
            rows={2}
            className="resize-none text-sm bg-white border-[#E5E7EB] focus-visible:ring-[#4F46E5]"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white self-end h-11 w-11 p-0 flex-shrink-0 rounded-xl"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
