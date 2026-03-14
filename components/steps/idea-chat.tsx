"use client"

import { useState, useRef, useEffect } from "react"
import type { ProjectState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Send, ArrowRight, Lightbulb } from "lucide-react"

const AI_GREETING =
  "안녕하세요! 저는 AI 기획 어시스턴트입니다. 어떤 이야기를 만들고 싶으신가요? 장르, 주인공, 배경, 분위기 등 떠오르는 것들을 자유롭게 말씀해 주세요."

const QUICK_IDEAS = [
  "사랑받는 애니메이션 캐릭터들의 드라마틱한 재회 장면",
  "기억을 잃은 형사가 자신이 용의자임을 알게 되는 스릴러",
  "판타지 세계에서 두 라이벌이 손을 잡는 감성적인 순간",
  "화려한 액션과 반전이 가득한 첩보 단편",
]

interface ChatMessage {
  role: "ai" | "user"
  content: string
}

interface IdeaChatProps {
  project: ProjectState
  setProject: (p: ProjectState) => void
  onNext: () => void
}

export function IdeaChat({ project, setProject, onNext }: IdeaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: AI_GREETING },
  ])
  const [input, setInput] = useState("")
  const [userSent, setUserSent] = useState(false)
  const [showProceed, setShowProceed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = (idea?: string) => {
    const text = (idea ?? input).trim()
    if (!text || userSent) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setProject({ ...project, idea: text })
    setUserSent(true)

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `훌륭한 아이디어네요! "${text}"를 기반으로 로그라인·캐릭터·플롯을 함께 설계해 볼게요. 기획 워크스페이스에서 캐릭터 설정을 채우면 AI가 각 플롯 단계를 자동으로 제안해드립니다.`,
        },
      ])
      setShowProceed(true)
    }, 700)
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
      {/* Title */}
      <div className="text-center mb-5 flex-shrink-0">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-xs font-medium text-indigo-700">AI 기획 어시스턴트</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">어떤 이야기를 만들고 싶으신가요?</h2>
        <p className="text-sm text-gray-500 mt-1.5">
          아이디어를 이야기해 주시면 로그라인·캐릭터·플롯으로 발전시켜 드립니다
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "ai" && (
                <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "ai"
                    ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                    : "bg-indigo-600 text-white rounded-tr-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {showProceed && (
            <div className="flex justify-center pt-2 pb-1">
              <Button
                onClick={onNext}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-xl"
              >
                기획 워크스페이스로 이동
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
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
            className="resize-none text-sm bg-gray-50 border-gray-200 focus-visible:ring-indigo-500"
            disabled={userSent}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || userSent}
            className="bg-indigo-600 hover:bg-indigo-700 text-white self-end h-9 w-9 p-0 flex-shrink-0"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick ideas */}
      {!userSent && (
        <div className="mt-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">아이디어 예시</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_IDEAS.map((idea, i) => (
              <button
                key={i}
                onClick={() => handleSend(idea)}
                className="text-left text-xs text-gray-600 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl px-3 py-2.5 transition-all"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
