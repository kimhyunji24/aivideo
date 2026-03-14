"use client"

import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Send, Bot, User, Sparkles, RefreshCw, Pencil,
  Palette, UserCircle, Wand2, CheckCircle2, Camera, Sun, Moon, Wind,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, SceneElements } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  action?: { sceneIndex: number; field: string; value: string }
}

type CommandResult = {
  sceneIndex: number
  field: keyof SceneElements | "description" | "title"
  value: string
  description: string
}

// ─── Command Parser ────────────────────────────────────────────────────────────

function parseStateCommand(
  msg: string,
  sceneCount: number,
  currentSceneIndex: number
): CommandResult | null {
  const lower = msg.toLowerCase()

  // Extract scene reference: "N번 씬"
  const sceneMatch = lower.match(/(\d+)번\s*씬/)
  const sceneIndex = sceneMatch
    ? Math.max(0, Math.min(parseInt(sceneMatch[1]) - 1, sceneCount - 1))
    : currentSceneIndex

  // ── Lighting ──
  if (/더\s*밝게|밝게\s*해|밝게\s*변경/.test(lower))
    return { sceneIndex, field: "lighting", value: "bright, high-key lighting, well-lit", description: "조명을 더 밝게" }
  if (/더\s*어둡게|어둡게|어두운/.test(lower))
    return { sceneIndex, field: "lighting", value: "dark, low-key, moody shadows", description: "조명을 어둡게" }
  if (/역광|실루엣/.test(lower))
    return { sceneIndex, field: "lighting", value: "backlit, silhouette, rim lighting", description: "역광 조명으로" }
  if (/노을|황혼|골든아워/.test(lower))
    return { sceneIndex, field: "lighting", value: "golden hour, warm sunset glow", description: "황혼 조명으로" }
  if (/형광등|실내\s*조명/.test(lower))
    return { sceneIndex, field: "lighting", value: "fluorescent indoor lighting", description: "실내 형광등으로" }

  // ── Time / Atmosphere ──
  if (/밤으로|밤\s*배경|야간/.test(lower))
    return { sceneIndex, field: "time", value: "night", description: "시간대를 밤으로" }
  if (/낮으로|낮\s*배경|오전|오후/.test(lower))
    return { sceneIndex, field: "time", value: "daytime", description: "시간대를 낮으로" }
  if (/새벽|이른\s*아침/.test(lower))
    return { sceneIndex, field: "time", value: "early morning, dawn", description: "시간대를 새벽으로" }

  // ── Camera / Composition ──
  if (/클로즈업/.test(lower))
    return { sceneIndex, field: "composition", value: "close-up shot, tight framing", description: "카메라를 클로즈업으로" }
  if (/와이드|전체\s*샷|풀\s*샷/.test(lower))
    return { sceneIndex, field: "composition", value: "wide shot, full body", description: "와이드샷으로" }
  if (/조감도|버드.아이|탑뷰/.test(lower))
    return { sceneIndex, field: "composition", value: "bird's eye view, top-down", description: "조감도 시점으로" }
  if (/로우앵글|아래에서/.test(lower))
    return { sceneIndex, field: "composition", value: "low angle, worm's eye view", description: "로우앵글로" }
  if (/측면|사이드/.test(lower))
    return { sceneIndex, field: "composition", value: "side profile shot", description: "측면 구도로" }

  // ── Mood ──
  if (/따뜻하게|따뜻한\s*느낌/.test(lower))
    return { sceneIndex, field: "mood", value: "warm, cozy, intimate", description: "분위기를 따뜻하게" }
  if (/차갑게|쿨한|냉랭/.test(lower))
    return { sceneIndex, field: "mood", value: "cold, distant, cool tone", description: "분위기를 차갑게" }
  if (/긴장감|서스펜스|스릴/.test(lower))
    return { sceneIndex, field: "mood", value: "tense, suspenseful, thriller", description: "긴장감 있게" }
  if (/로맨틱|감성|감동/.test(lower))
    return { sceneIndex, field: "mood", value: "romantic, emotional, heartfelt", description: "로맨틱한 분위기로" }
  if (/활기|에너지|신나/.test(lower))
    return { sceneIndex, field: "mood", value: "energetic, vibrant, upbeat", description: "활기찬 분위기로" }

  // ── Background ──
  if (/실내로|실내\s*배경/.test(lower))
    return { sceneIndex, field: "background", value: "indoor interior setting", description: "배경을 실내로" }
  if (/야외|실외|바깥/.test(lower))
    return { sceneIndex, field: "background", value: "outdoor exterior setting", description: "배경을 야외로" }
  if (/도시|도심|번화가/.test(lower))
    return { sceneIndex, field: "background", value: "urban city street", description: "배경을 도시로" }
  if (/자연|숲|산/.test(lower))
    return { sceneIndex, field: "background", value: "nature, forest, serene", description: "배경을 자연으로" }

  return null
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Sun, label: "더 밝게", action: "이 씬을 더 밝게 해줘" },
  { icon: Moon, label: "밤으로", action: "밤으로 바꿔줘" },
  { icon: Camera, label: "클로즈업", action: "클로즈업으로 바꿔줘" },
  { icon: Wind, label: "따뜻하게", action: "분위기를 따뜻하게 해줘" },
  { icon: RefreshCw, label: "재생성", action: "이 씬을 재생성해줘" },
  { icon: Palette, label: "스타일", action: "스타일을 시네마틱으로 바꿔줘" },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface AIChatPanelProps {
  className?: string
  project: ProjectState
  setProject: Dispatch<SetStateAction<ProjectState>>
  currentSceneIndex: number
}

export function AIChatPanel({ className, project, setProject, currentSceneIndex }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: `안녕하세요! AI 디렉터입니다 🎬\n\n씬의 조명, 카메라, 분위기 등을 채팅으로 수정할 수 있어요.\n\n예) "2번 씬의 카메라를 클로즈업으로 바꿔"\n예) "더 밝게 해줘"\n예) "밤으로 바꿔줘"`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const currentSceneName = project.scenes[currentSceneIndex]
    ? `${currentSceneIndex + 1}번 씬 (${project.scenes[currentSceneIndex].title})`
    : "씬 없음"

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 600))

    const cmd = parseStateCommand(input, project.scenes.length, currentSceneIndex)

    if (cmd) {
      // Apply state change
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === cmd.sceneIndex
            ? { ...s, elements: { ...s.elements, [cmd.field]: cmd.value } }
            : s
        ),
      }))

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `✅ ${cmd.sceneIndex + 1}번 씬의 **${cmd.description}** 변경했습니다.\n\n→ ${cmd.field}: "${cmd.value}"`,
        action: { sceneIndex: cmd.sceneIndex, field: cmd.field, value: cmd.value },
      }
      setMessages((prev) => [...prev, assistantMsg])
    } else {
      // Fallback response
      const fallbacks = [
        `현재 **${currentSceneName}**을 편집 중입니다. 어떤 부분을 바꿔드릴까요?\n\n조명, 카메라, 배경, 분위기 등을 말씀해 주세요.`,
        `구체적으로 알려주시면 도와드릴게요!\n\n예시: "더 밝게", "밤으로", "클로즈업으로", "2번 씬 따뜻하게"`,
        `죄송해요, 아직 그 명령은 인식하지 못해요 😅\n조명, 시간대, 카메라, 분위기, 배경 관련 변경을 시도해보세요!`,
      ]
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      }
      setMessages((prev) => [...prev, assistantMsg])
    }

    setIsLoading(false)
  }

  return (
    <div className={cn("flex flex-col h-full bg-card/40 backdrop-blur-sm border-l border-border/50", className)}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Wand2 className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-semibold">AI 디렉터</p>
            <p className="text-[10px] text-muted-foreground">프로젝트 상태 제어</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[9px] border-purple-400/30 text-purple-400">
            실시간
          </Badge>
        </div>
      </div>

      {/* Current scene indicator */}
      <div className="px-3 py-2 bg-muted/20 border-b border-border/50">
        <p className="text-[10px] text-muted-foreground">
          현재 편집 중: <span className="text-foreground font-medium">{currentSceneName}</span>
        </p>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-border/50">
        <p className="text-[10px] text-muted-foreground mb-1.5">빠른 명령</p>
        <div className="grid grid-cols-3 gap-1">
          {QUICK_ACTIONS.map((a) => (
            <Tooltip key={a.label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-1.5 justify-start hover:bg-muted/60"
                  onClick={() => setInput(a.action)}
                >
                  <a.icon className="h-3 w-3 flex-shrink-0" />
                  {a.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">{a.action}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "assistant" ? "bg-purple-500/20" : "bg-foreground"
              )}>
                {msg.role === "assistant"
                  ? <Bot className="h-3 w-3 text-purple-400" />
                  : <User className="h-2.5 w-2.5 text-background" />
                }
              </div>
              <div className={cn(
                "rounded-xl px-3 py-2 text-[11px] max-w-[88%] leading-relaxed",
                msg.role === "assistant" ? "bg-muted/50" : "bg-foreground text-background"
              )}>
                {msg.action && (
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span className="text-[10px] text-green-400 font-medium">상태 변경됨</span>
                  </div>
                )}
                <span className="whitespace-pre-line">{msg.content}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Bot className="h-3 w-3 text-purple-400" />
              </div>
              <div className="bg-muted/50 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1 h-1 bg-purple-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예) 2번 씬 더 밝게 해줘"
            className="flex-1 h-8 text-xs bg-muted/30 border-border/50"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}
