"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "안녕하세요! AI 영상 제작 어시스턴트입니다. 프롬프트 수정, 씬 설명 편집, 특정 씬 재생성, 스타일이나 분위기 조정 등을 도와드릴 수 있어요. 무엇을 도와드릴까요?",
  },
]

interface AIChatPanelProps {
  className?: string
}

export function AIChatPanel({ className }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const responses = [
      "네, 해당 씬의 프롬프트를 수정해드릴게요. 어떤 분위기로 변경하고 싶으신가요?",
      "좋은 아이디어네요! 카메라 앵글을 더 드라마틱하게 조정해볼게요.",
      "스타일을 변경했습니다. 미리보기에서 확인해보세요.",
      "해당 씬을 재생성 중입니다. 잠시만 기다려주세요.",
      "네, 전체적인 색감을 더 따뜻하게 조정할 수 있어요. 적용해드릴까요?",
    ]

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: responses[Math.floor(Math.random() * responses.length)],
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">AI 어시스턴트</p>
            <p className="text-xs text-muted-foreground">영상 제작 도우미</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === "assistant" ? "bg-muted" : "bg-foreground"
                )}
              >
                {message.role === "assistant" ? (
                  <Bot className="h-3 w-3 text-foreground" />
                ) : (
                  <User className="h-3 w-3 text-background" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  message.role === "assistant"
                    ? "bg-muted text-foreground"
                    : "bg-foreground text-background"
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3 w-3 text-foreground" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          프롬프트 수정, 씬 재생성, 스타일 변경 등을 요청하세요
        </p>
      </div>
    </div>
  )
}
