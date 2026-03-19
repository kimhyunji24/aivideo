"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Layers,
  GripVertical,
  Pen,
  X
} from "lucide-react"
import { ASSETS, CATEGORIES } from "@/lib/constants"
import { ProjectState } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface AssetLibraryProps {
  onDrop?: (assetId: string, sceneId: string | number) => void
  pinnedAssets?: Record<string | number, string[]>
  project?: ProjectState
  setProject?: (project: ProjectState) => void
  onClose?: () => void
}

export function AssetLibrary({ onDrop, pinnedAssets = {}, project, setProject, onClose }: AssetLibraryProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<"character" | "background" | "style">("character")
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  
  const editingAsset = ASSETS.find(a => a.id === editingAssetId)
  const customData = editingAssetId && project?.customAssets ? project.customAssets[editingAssetId] : null
  const [editImageUrl, setEditImageUrl] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const handleEditOpen = (assetId: string) => {
    setEditingAssetId(assetId)
    const cData = project?.customAssets?.[assetId]
    setEditImageUrl(cData?.imageUrl ?? "")
    setEditDesc(cData?.description ?? ASSETS.find(a => a.id === assetId)?.description ?? "")
  }

  const handleEditSave = () => {
    if (!editingAssetId || !setProject || !project) return
    setProject({
      ...project,
      customAssets: {
        ...(project.customAssets || {}),
        [editingAssetId]: {
          imageUrl: editImageUrl,
          description: editDesc,
        }
      }
    })
    setEditingAssetId(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditImageUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">에셋</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150"
              aria-label="에셋 패널 닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
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
      <ScrollArea className="flex-1 px-8 py-8" type="auto">
        <div className="space-y-4 pb-8">
          {filtered.map((asset) => {
            const isPinned = Object.values(pinnedAssets).some(arr => arr.includes(asset.id))
            const custom = project?.customAssets?.[asset.id]
            const bgImage = custom?.imageUrl ? `url(${custom.imageUrl})` : undefined
            const currentDesc = custom?.description || asset.description

            return (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <div className="relative group/wrapper">
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative rounded-xl border border-gray-200 bg-white overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none hover-lift",
                        dragging === asset.id ? "opacity-50 scale-95" : "hover:border-gray-300 hover:shadow-md"
                      )}
                    >
                      <div 
                        className="aspect-[4/3] bg-gray-50 flex items-center justify-center border-b border-gray-100 transition-colors group-hover:bg-gray-100 bg-cover bg-center"
                        style={bgImage ? { backgroundImage: bgImage } : {}}
                      >
                        {!bgImage && <asset.icon className="w-7 h-7 text-gray-400 transition-colors group-hover:text-gray-600" strokeWidth={1.5} />}
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors truncate">{asset.label}</span>
                        {isPinned && (
                          <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        )}
                      </div>
                      {dragging === asset.id && (
                        <div className="absolute inset-0 border border-dashed border-gray-400 rounded-xl pointer-events-none" />
                      )}
                    </div>
                    {/* Hover Edit Button */}
                    <button
                      onClick={() => handleEditOpen(asset.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover/wrapper:opacity-100 transition-opacity bg-white/90 backdrop-blur text-gray-700 p-1.5 rounded-md border border-gray-200 shadow-sm hover:bg-gray-100 z-10"
                    >
                      <Pen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {currentDesc}
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

      {/* Edit Modal */}
      <Dialog open={!!editingAssetId} onOpenChange={(open) => !open && setEditingAssetId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>에셋 수정: {editingAsset?.label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <Label>사진 업로드</Label>
              <div className="flex items-center gap-4">
                {editImageUrl && (
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                    <img src={editImageUrl} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer text-xs flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                placeholder="에셋에 대한 상세 설명을 입력하세요."
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAssetId(null)}>취소</Button>
            <Button onClick={handleEditSave} className="bg-black text-white hover:bg-gray-800">저장하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
