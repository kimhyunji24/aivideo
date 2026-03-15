"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ImageIcon, Pin, User, UserCheck, Users, MountainSnow, Coffee, Umbrella, Film, Palette, Sparkles, Moon } from "lucide-react"

interface Asset {
  id: string
  label: string
  category: "character" | "background" | "style"
  icon: React.ElementType
}

const ASSETS: Asset[] = [
  // Characters
  { id: "char-1", label: "주인공 A", category: "character", icon: User },
  { id: "char-2", label: "주인공 B", category: "character", icon: UserCheck },
  { id: "char-3", label: "조연 A", category: "character", icon: Users },
  { id: "char-4", label: "조연 B", category: "character", icon: Users },
  // Backgrounds
  { id: "bg-1", label: "도시 거리", category: "background", icon: ImageIcon },
  { id: "bg-2", label: "자연 숲", category: "background", icon: MountainSnow },
  { id: "bg-3", label: "실내 카페", category: "background", icon: Coffee },
  { id: "bg-4", label: "해변", category: "background", icon: Umbrella },
  // Styles
  { id: "style-1", label: "시네마틱", category: "style", icon: Film },
  { id: "style-2", label: "수채화", category: "style", icon: Palette },
  { id: "style-3", label: "애니메이션", category: "style", icon: Sparkles },
  { id: "style-4", label: "누아르", category: "style", icon: Moon },
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
    <div className="flex flex-col h-full border-r border-border/50 bg-[#111] text-white">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-[#888]" />
          <span className="text-xs font-bold text-[#888] tracking-wider">에셋 라이브러리</span>
        </div>
        <div className="flex gap-1 p-1 bg-[#222] rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex-1 py-1.5 text-[11px] rounded-md transition-all font-medium",
                activeCategory === cat.id
                  ? "bg-[#333] text-white shadow-sm"
                  : "text-[#888] hover:text-[#ccc]"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assets grid */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {filtered.map((asset) => {
            const isPinned = Object.values(pinnedAssets).includes(asset.id)
            return (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group relative rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none",
                  dragging === asset.id ? "opacity-50 scale-95" : "hover:border-[#555] hover:shadow-lg"
                )}
              >
                <div className="aspect-video bg-[#222] flex items-center justify-center border-b border-[#2a2a2a] transition-colors group-hover:bg-[#2a2a2a]">
                  <asset.icon className="w-8 h-8 text-[#666] transition-colors group-hover:text-[#aaa]" strokeWidth={1.5} />
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#ccc] group-hover:text-white transition-colors">{asset.label}</span>
                  {isPinned && (
                    <Pin className="h-3 w-3 text-purple-400 fill-purple-400" />
                  )}
                </div>
                {dragging === asset.id && (
                  <div className="absolute inset-0 border-2 border-dashed border-[#888] rounded-xl pointer-events-none" />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-[#666] text-center mt-6 mb-2 px-2">
          씬 카드로 드래그해서 핀 고정
        </p>
      </ScrollArea>

      {/* Pinned count */}
      {Object.keys(pinnedAssets).length > 0 && (
        <div className="px-3 py-2 border-t border-[#2a2a2a] bg-[#1a1a1a]">
          <Badge variant="outline" className="text-[10px] gap-1.5 w-full justify-center border-[#333] text-[#888] bg-[#222]">
            <Pin className="h-2.5 w-2.5" />
            {Object.keys(pinnedAssets).length}개 씬에 핀 고정됨
          </Badge>
        </div>
      )}
    </div>
  )
}
