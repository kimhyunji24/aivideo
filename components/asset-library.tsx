"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Layers,
  CircleUser,
  UserCheck,
  Users,
  Mountain,
  CupSoda,
  Waves,
  Film,
  Paintbrush,
  Wand2,
  Moon,
  GripVertical,
} from "lucide-react"

interface Asset {
  id: string
  label: string
  category: "character" | "background" | "style"
  icon: React.ElementType
  description: string
}

const ASSETS: Asset[] = [
  // Characters
  { id: "char-1", label: "주인공 A", category: "character", icon: CircleUser, description: "메인 캐릭터 A" },
  { id: "char-2", label: "주인공 B", category: "character", icon: UserCheck, description: "메인 캐릭터 B" },
  { id: "char-3", label: "조연 A", category: "character", icon: Users, description: "보조 캐릭터 A" },
  { id: "char-4", label: "조연 B", category: "character", icon: Users, description: "보조 캐릭터 B" },
  // Backgrounds
  { id: "bg-1", label: "도시 거리", category: "background", icon: Mountain, description: "도시 배경" },
  { id: "bg-2", label: "자연 숲", category: "background", icon: Mountain, description: "자연 배경" },
  { id: "bg-3", label: "실내 카페", category: "background", icon: CupSoda, description: "실내 배경" },
  { id: "bg-4", label: "해변", category: "background", icon: Waves, description: "해변 배경" },
  // Styles
  { id: "style-1", label: "시네마틱", category: "style", icon: Film, description: "영화적 스타일" },
  { id: "style-2", label: "수채화", category: "style", icon: Paintbrush, description: "수채화 스타일" },
  { id: "style-3", label: "애니메이션", category: "style", icon: Wand2, description: "애니메이션 스타일" },
  { id: "style-4", label: "누아르", category: "style", icon: Moon, description: "누아르 스타일" },
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
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">에셋</span>
        </div>
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex-1 py-1.5 text-[11px] rounded-md transition-all font-medium press-down",
                activeCategory === cat.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assets grid */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-3 pb-4">
          {filtered.map((asset) => {
            const isPinned = Object.values(pinnedAssets).includes(asset.id)
            return (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "group relative rounded-xl border border-gray-200 bg-white overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none hover-lift",
                      dragging === asset.id ? "opacity-50 scale-95" : "hover:border-gray-300 hover:shadow-md"
                    )}
                  >
                    <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center border-b border-gray-100 transition-colors group-hover:bg-gray-100">
                      <asset.icon className="w-7 h-7 text-gray-400 transition-colors group-hover:text-gray-600" strokeWidth={1.5} />
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{asset.label}</span>
                      {isPinned && (
                        <GripVertical className="h-3 w-3 text-gray-400" strokeWidth={1.5} />
                      )}
                    </div>
                    {dragging === asset.id && (
                      <div className="absolute inset-0 border-2 border-dashed border-gray-400 rounded-xl pointer-events-none" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {asset.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-5 mb-2 px-2">
          씬 카드로 드래그해서 핀 고정
        </p>
      </ScrollArea>

      {/* Pinned count */}
      {Object.keys(pinnedAssets).length > 0 && (
        <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <Badge variant="outline" className="text-[10px] gap-1.5 w-full justify-center border-gray-200 text-gray-500 bg-white">
            <GripVertical className="h-2.5 w-2.5" strokeWidth={1.5} />
            {Object.keys(pinnedAssets).length}개 씬에 핀 고정됨
          </Badge>
        </div>
      )}
    </div>
  )
}
