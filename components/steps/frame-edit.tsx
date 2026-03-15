"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, Edit3, Image as ImageIcon, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, Frame } from "@/lib/types"

interface FrameEditProps {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  sceneIndex: number
  onComplete: () => void
  onBack: () => void
  onNext: () => void
  selectedFrameIndex?: number
  onSelectedFrameIndexChange?: (index: number) => void
}

export function FrameEdit({
  project,
  setProject,
  sceneIndex,
  onComplete,
  onBack,
  onNext,
  selectedFrameIndex: selectedFrameIndexProp = 0,
  onSelectedFrameIndexChange,
}: FrameEditProps) {
  const scene = project.scenes[sceneIndex]
  if (!scene) return null

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(selectedFrameIndexProp)
  const [isGenerating, setIsGenerating] = useState(false)
  const frames = scene.frames ?? []
  const safeSelectedFrameIndex =
    frames.length === 0 ? 0 : Math.max(0, Math.min(selectedFrameIndex, frames.length - 1))
  const currentFrame = frames[safeSelectedFrameIndex]

  useEffect(() => {
    setSelectedFrameIndex(selectedFrameIndexProp)
  }, [selectedFrameIndexProp])

  useEffect(() => {
    if (frames.length === 0) {
      const defaultFrames: Frame[] = [
        { id: "f1", script: scene.description || "", imageUrl: scene.imageUrl },
        { id: "f2", script: "", imageUrl: undefined },
        { id: "f3", script: "", imageUrl: undefined },
        { id: "f4", script: "", imageUrl: undefined },
      ]
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) => (i === sceneIndex ? { ...s, frames: defaultFrames } : s)),
      }))
    }
  }, [frames.length, scene.description, scene.imageUrl, sceneIndex, setProject])

  useEffect(() => {
    if (safeSelectedFrameIndex !== selectedFrameIndex) {
      setSelectedFrameIndex(safeSelectedFrameIndex)
    }
  }, [safeSelectedFrameIndex, selectedFrameIndex])

  useEffect(() => {
    onSelectedFrameIndexChange?.(safeSelectedFrameIndex)
  }, [onSelectedFrameIndexChange, safeSelectedFrameIndex])

  const updateFrameScript = (script: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => {
        if (i !== sceneIndex || !s.frames) return s
        const newFrames = [...s.frames]
        newFrames[safeSelectedFrameIndex] = { ...newFrames[safeSelectedFrameIndex], script }
        return { ...s, frames: newFrames }
      }),
    }))
  }

  if (!currentFrame) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-sm text-muted-foreground">
        프레임을 준비하는 중입니다...
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 text-sm font-semibold rounded-full">
            S#{sceneIndex + 1}
          </Badge>
          <h2 className="text-xl font-bold">{scene.title}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onComplete}
          className="gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-700"
        >
          <Edit3 className="h-4 w-4" />
          수정 완료
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        <Card className="col-span-1 lg:col-span-8 flex flex-col overflow-hidden border-border/60 shadow-sm glass-card">
          <div className="relative flex-1 bg-black/5 min-h[200px] flex items-center justify-center p-4">
            {currentFrame.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentFrame.imageUrl}
                alt={`Frame ${safeSelectedFrameIndex + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground/50">
                <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
                <p className="text-sm font-medium">이미지가 없습니다</p>
              </div>
            )}
            <div className="absolute top-6 left-6">
              <Badge className="bg-black/70 hover:bg-black/70 text-white backdrop-blur-md border-0 gap-1.5 py-1.5 px-3">
                <Edit3 className="h-3.5 w-3.5" />
                {safeSelectedFrameIndex === 0 ? "Start Frame" : `Frame ${safeSelectedFrameIndex + 1}`} 편집 중
              </Badge>
            </div>
          </div>

          <div className="p-4 bg-white border-t">
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="frame-flow" className="rounded border-gray-300 text-blue-600 h-3 w-3" defaultChecked />
              <label htmlFor="frame-flow" className="text-xs font-medium text-gray-700">프레임 흐름 (최대 4개)</label>
            </div>

            <div className="flex items-center gap-4">
              {frames.map((frame, idx) => (
                <div key={frame.id} className="flex items-center gap-4 flex-1">
                  <button
                    onClick={() => setSelectedFrameIndex(idx)}
                    className={cn(
                      "relative aspect-video w-full rounded-lg overflow-hidden border-2 transition-all p-0 focus:outline-none",
                      safeSelectedFrameIndex === idx
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "border-transparent bg-gray-100 hover:bg-gray-200 opacity-70 hover:opacity-100"
                    )}
                  >
                    {frame.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frame.imageUrl} alt={`F${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-200">
                        <div className="absolute inset-0 bg-white/40 mask-diagonal-stripes" />
                      </div>
                    )}
                  </button>
                  {idx < frames.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-2 px-8">
              {frames.map((_, idx) => (
                <span
                  key={idx}
                  className={cn("text-[11px] font-medium", safeSelectedFrameIndex === idx ? "text-blue-600" : "text-gray-400")}
                >
                  F{idx + 1}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="col-span-1 lg:col-span-4 flex flex-col border-border/60 shadow-sm glass-card">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50/50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold text-gray-700">T</span>
              <span className="font-semibold text-sm">스크립트</span>
            </div>
            <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50">F{safeSelectedFrameIndex + 1} 종속</Badge>
          </div>
          <ScrollArea className="flex-1 p-4 flex flex-col">
            <Textarea
              value={currentFrame.script}
              onChange={(e) => updateFrameScript(e.target.value)}
              placeholder={`F${safeSelectedFrameIndex + 1} 프레임에 대한 스크립트를 입력하세요...`}
              className="min-h-[250px] resize-none border-0 focus-visible:ring-0 p-0 text-sm leading-relaxed text-gray-700 bg-transparent mb-4"
            />
            <div className="mt-8 pt-4 border-t border-border/50">
              <Button
                size="sm"
                onClick={async () => {
                  setIsGenerating(true)
                  setTimeout(() => setIsGenerating(false), 2000)
                }}
                disabled={isGenerating || !currentFrame.script.trim()}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-sm h-10"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                F{safeSelectedFrameIndex + 1} 프레임 생성하기
              </Button>
            </div>
          </ScrollArea>
        </Card>
      </div>

      <div className="flex justify-between pt-4 mt-6 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onBack} className="h-10 gap-2 px-4 shadow-sm">
          <ChevronLeft className="h-4 w-4" />
          이전 단계로
        </Button>
      </div>
    </div>
  )
}
