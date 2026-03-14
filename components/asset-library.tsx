"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ImageIcon, Pin } from "lucide-react"

interface Asset {
  id: string
  label: string
  category: "character" | "background" | "style"
  color: string
  emoji: string
}

const ASSETS: Asset[] = [
  // Characters
  { id: "char-1", label: "주인공 A", category: "character", color: "from-blue-500/30 to-purple-500/30", emoji: "👤" },
  { id: "char-2", label: "주인공 B", category: "character", color: "from-pink-500/30 to-rose-500/30", emoji: "👩" },
  { id: "char-3", label: "조연 A", category: "character", color: "from-green-500/30 to-emerald-500/30", emoji: "🧑" },
  { id: "char-4", label: "조연 B", category: "character", color: "from-orange-500/30 to-amber-500/30", emoji: "👦" },
  // Backgrounds
  { id: "bg-1", label: "도시 거리", category: "background", color: "from-slate-500/30 to-zinc-500/30", emoji: "🏙️" },
  { id: "bg-2", label: "자연 숲", category: "background", color: "from-green-600/30 to-teal-500/30", emoji: "🌲" },
  { id: "bg-3", label: "실내 카페", category: "background", color: "from-amber-500/30 to-yellow-400/30", emoji: "☕" },
  { id: "bg-4", label: "해변", category: "background", color: "from-cyan-500/30 to-blue-400/30", emoji: "🏖️" },
  // Styles
  { id: "style-1", label: "시네마틱", category: "style", color: "from-red-600/30 to-orange-500/30", emoji: "🎬" },
  { id: "style-2", label: "수채화", category: "style", color: "from-indigo-400/30 to-purple-400/30", emoji: "🎨" },
  { id: "style-3", label: "애니메이션", category: "style", color: "from-yellow-400/30 to-pink-400/30", emoji: "✨" },
  { id: "style-4", label: "누아르", category: "style", color: "from-gray-600/30 to-gray-800/30", emoji: "🌑" },
]

const CATEGORIES = [
  { id: "character", label: "캐릭터" },
  { id: "background", label: "배경" },
  { id: "style", label: "스타일" },
] as const

interface AssetLibraryProps {
  onDrop?: (assetId: string, sceneId: string | number) => void
  pinnedAssets?: Record<string | number, string>
}

export function AssetLibrary({ onDrop, pinnedAssets = {} }: AssetLibraryProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<"character" | "background" | "style">("character")

  const filtered = ASSETS.filter((a) => a.category === activeCategory)

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData("assetId", assetId)
    setDragging(assetId)
  }

  const handleDragEnd = () => setDragging(null)

  return (
    <div className="flex flex-col h-full border-r border-border/50 bg-card/40 backdrop-blur-sm">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">에셋 라이브러리</span>
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex-1 py-1 text-[10px] rounded transition-all",
                activeCategory === cat.id
                  ? "bg-foreground/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assets grid */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-2">
          {filtered.map((asset) => {
            const isPinned = Object.values(pinnedAssets).includes(asset.id)
            return (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative rounded-lg border border-border/40 overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none",
                  dragging === asset.id ? "opacity-50 scale-95" : "hover:border-border/70 hover:shadow-sm"
                )}
              >
                <div className={cn("aspect-video bg-gradient-to-br flex items-center justify-center", asset.color)}>
                  <span className="text-2xl">{asset.emoji}</span>
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium">{asset.label}</span>
                  {isPinned && (
                    <Pin className="h-2.5 w-2.5 text-purple-400 fill-purple-400" />
                  )}
                </div>
                {dragging === asset.id && (
                  <div className="absolute inset-0 border-2 border-dashed border-purple-400/60 rounded-lg pointer-events-none" />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-4 px-2">
          씬 카드로 드래그해서 핀 고정
        </p>
      </ScrollArea>

      {/* Pinned count */}
      {Object.keys(pinnedAssets).length > 0 && (
        <div className="px-3 py-2 border-t border-border/50">
          <Badge variant="secondary" className="text-[10px] gap-1 w-full justify-center">
            <Pin className="h-2.5 w-2.5" />
            {Object.keys(pinnedAssets).length}개 씬에 핀 고정됨
          </Badge>
        </div>
      )}
    </div>
  )
}
