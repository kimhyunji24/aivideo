"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Send, Bot, User, Sparkles, RefreshCw, Pencil, Palette, UserCircle, Wand2 } from "lucide-react"
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
    content: "안녕하세요! AI 영상 제작 어시스턴트입니다. 무엇을 도와드릴까요?",
  },
]

interface AIChatPanelProps {
  className?: string
}

export function AIChatPanel({ className }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const quickActions = [
    { icon: RefreshCw, label: "재생성", action: "이 씬을 다시 생성해주세요" },
    { icon: Pencil, label: "프롬프트", action: "프롬프트를 개선해주세요" },
    { icon: Palette, label: "스타일", action: "다른 스타일로 바꿔주세요" },
    { icon: UserCircle, label: "캐릭터", action: "캐릭터를 수정해주세요" },
  ]

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

  const handleQuickAction = (action: string) => {
    setInput(action)
  }

  return (
    <div className={cn("flex flex-col h-full glass-panel", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-foreground/10 flex items-center justify-center">
            <Wand2 className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">AI 어시스턴트</p>
            <p className="text-[10px] text-muted-foreground">제작 도우미</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2.5 border-b border-border/50 bg-muted/20">
        <p className="text-[10px] text-muted-foreground mb-2">빠른 작업</p>
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-2 bg-background/50 hover:bg-background/80 border-border/50"
                  onClick={() => handleQuickAction(action.action)}
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{action.action}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
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
                  "rounded-xl px-3 py-2 text-xs max-w-[85%] leading-relaxed",
                  message.role === "assistant"
                    ? "bg-muted/70 text-foreground"
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
              <div className="bg-muted/70 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border/50 bg-background/30">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 h-9 text-xs bg-background/50 border-border/50"
            disabled={isLoading}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                type="submit" 
                size="icon" 
                className="h-9 w-9 flex-shrink-0" 
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>전송</TooltipContent>
          </Tooltip>
        </form>
      </div>
    </div>
  )
}
