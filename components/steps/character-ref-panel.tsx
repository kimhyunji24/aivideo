"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MaskCanvas } from "@/components/ui/mask-canvas"
import { Loader2, Plus, X, Sparkles, ChevronDown, ChevronUp, User2, Pencil, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectState, Character } from "@/lib/types"

const MAX_REFS = 10

const VARIANT_BUTTONS: { type: string; label: string; emoji: string }[] = [
  { type: "smile", label: "웃음", emoji: "😊" },
  { type: "cry",   label: "울음", emoji: "😢" },
  { type: "angry", label: "화남", emoji: "😠" },
  { type: "back",  label: "뒷모습", emoji: "🔙" },
  { type: "side",  label: "옆모습", emoji: "👤" },
]

interface CharacterRefPanelProps {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  sessionId?: string | null
}

type ActiveRef = { charId: string; index: number; url: string }
type DialogMode = "preview" | "pose" | "edit"

export function CharacterRefPanel({ project, setProject, sessionId }: CharacterRefPanelProps) {
  const [loadingCharId, setLoadingCharId] = useState<string | null>(null)
  const [loadingVariant, setLoadingVariant] = useState<string | null>(null)
  const [collapsedChars, setCollapsedChars] = useState<Set<string>>(new Set())

  // 이미지 액션 상태
  const [activeRef, setActiveRef] = useState<ActiveRef | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>("preview")
  const [posePrompt, setPosePrompt] = useState("")
  const [isActionLoading, setIsActionLoading] = useState(false)

  const characters = project.characters ?? []

  const resolveSessionId = () => {
    if (sessionId?.trim()) return sessionId
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("aivideo:sessionId")
  }

  const syncChar = (updated: Character) => {
    setProject(prev => ({
      ...prev,
      characters: (prev.characters ?? []).map(c => c.id === updated.id ? updated : c),
    }))
  }

  const handleGenerateBase = async (charId: string) => {
    const sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    setLoadingCharId(charId)
    try {
      const res = await fetch(
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/characters/${encodeURIComponent(charId)}/references/generate`,
        { method: "POST" }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `요청 실패 (${res.status})`)
      }
      const updated: Character = await res.json()
      syncChar(updated)
    } catch (e: any) {
      alert(e.message || "베이스 이미지 생성 중 오류가 발생했습니다.")
    } finally {
      setLoadingCharId(null)
    }
  }

  const handleGenerateVariant = async (charId: string, variantType: string) => {
    const sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    setLoadingVariant(`${charId}-${variantType}`)
    try {
      const res = await fetch(
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/characters/${encodeURIComponent(charId)}/references/variant`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantType }),
        }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `요청 실패 (${res.status})`)
      }
      const updated: Character = await res.json()
      syncChar(updated)
    } catch (e: any) {
      alert(e.message || "변형 이미지 생성 중 오류가 발생했습니다.")
    } finally {
      setLoadingVariant(null)
    }
  }

  const handleDeleteRef = async (charId: string, index: number) => {
    const sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    try {
      const res = await fetch(
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/characters/${encodeURIComponent(charId)}/references/${index}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
      const updated: Character = await res.json()
      syncChar(updated)
    } catch (e: any) {
      alert(e.message || "삭제 중 오류가 발생했습니다.")
    }
  }

  // 자세/동작 변경
  const handlePoseChange = async () => {
    if (!activeRef || !posePrompt.trim()) return
    const sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    setIsActionLoading(true)
    try {
      const res = await fetch(
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/characters/${encodeURIComponent(activeRef.charId)}/references/${activeRef.index}/pose`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: posePrompt.trim() }),
        }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `요청 실패 (${res.status})`)
      }
      const updated: Character = await res.json()
      syncChar(updated)
      const newUrl = updated.referenceImageUrls?.[activeRef.index] ?? activeRef.url
      setActiveRef({ ...activeRef, url: newUrl })
      setDialogMode("preview")
      setPosePrompt("")
    } catch (e: any) {
      alert(e.message || "자세 변경 중 오류가 발생했습니다.")
    } finally {
      setIsActionLoading(false)
    }
  }

  // 부분 수정 (인페인팅)
  const handleEditSave = async (maskBase64: string) => {
    if (!activeRef) return
    const sid = resolveSessionId()
    if (!sid) { alert("세션이 확인되지 않습니다."); return }

    const editPrompt = window.prompt("수정할 내용을 입력하세요 (비워두면 AI가 문맥에 맞게 채웁니다):") || ""
    setIsActionLoading(true)
    try {
      const res = await fetch(
        `/api/v1/sessions/${encodeURIComponent(sid)}/generation/characters/${encodeURIComponent(activeRef.charId)}/references/${activeRef.index}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: editPrompt, maskBase64 }),
        }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `요청 실패 (${res.status})`)
      }
      const updated: Character = await res.json()
      syncChar(updated)
      const newUrl = updated.referenceImageUrls?.[activeRef.index] ?? activeRef.url
      setActiveRef({ ...activeRef, url: newUrl })
      setDialogMode("preview")
    } catch (e: any) {
      alert(e.message || "부분 수정 중 오류가 발생했습니다.")
    } finally {
      setIsActionLoading(false)
    }
  }

  const openRefDialog = (charId: string, index: number, url: string) => {
    setActiveRef({ charId, index, url })
    setDialogMode("preview")
    setPosePrompt("")
  }

  const closeDialog = () => {
    setActiveRef(null)
    setPosePrompt("")
  }

  const toggleCollapse = (charId: string) => {
    setCollapsedChars(prev => {
      const next = new Set(prev)
      next.has(charId) ? next.delete(charId) : next.add(charId)
      return next
    })
  }

  const isLoading = (charId: string) =>
    loadingCharId === charId || (loadingVariant?.startsWith(charId + "-") ?? false)

  if (characters.length === 0) return null

  return (
    <>
      <div className="flex flex-col h-full bg-white/80 backdrop-blur-sm border-r border-gray-100 overflow-hidden">
        {/* 헤더 */}
        <div className="px-3 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <User2 className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700 tracking-wide">캐릭터 레퍼런스</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">이미지를 생성해 프레임 참조에 활용하세요</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-3">
            {characters.map((char) => {
              const refs = char.referenceImageUrls ?? []
              const hasBase = refs.length > 0
              const isCollapsed = collapsedChars.has(char.id)
              const charLoading = isLoading(char.id)

              return (
                <div
                  key={char.id}
                  className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
                >
                  {/* 캐릭터 헤더 */}
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCollapse(char.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {char.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={char.imageUrl}
                          alt={char.name}
                          className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User2 className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                      )}
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{char.name}</p>
                        <p className="text-[10px] text-gray-400">{refs.length}/{MAX_REFS} 이미지</p>
                      </div>
                    </div>
                    {isCollapsed
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      : <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    }
                  </button>

                  {!isCollapsed && (
                    <div className="px-2 pb-3 space-y-2">
                      {/* 이미지 그리드 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {refs.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${char.name} ref ${idx + 1}`}
                              className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer"
                              onClick={() => openRefDialog(char.id, idx, url)}
                            />
                            {idx === 0 && (
                              <Badge className="absolute top-0.5 left-0.5 text-[8px] px-1 py-0 h-3.5 bg-black/70 text-white border-0 hover:bg-black/70 pointer-events-none">
                                BASE
                              </Badge>
                            )}
                            {/* 호버 오버레이: 클릭 유도 + 빠른 삭제 */}
                            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity flex items-center justify-center gap-1">
                              <button
                                className="w-5 h-5 rounded-full bg-white/90 text-gray-700 flex items-center justify-center hover:bg-white shadow-sm"
                                onClick={(e) => { e.stopPropagation(); openRefDialog(char.id, idx, url) }}
                                title="편집 옵션"
                              >
                                <ZoomIn className="w-2.5 h-2.5" />
                              </button>
                              <button
                                className="w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 shadow-sm"
                                onClick={(e) => { e.stopPropagation(); handleDeleteRef(char.id, idx) }}
                                title="삭제"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* 빈 슬롯 */}
                        {refs.length < MAX_REFS && !hasBase && (
                          <button
                            className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors group col-span-3"
                            onClick={() => handleGenerateBase(char.id)}
                            disabled={charLoading}
                          >
                            {charLoading && loadingCharId === char.id ? (
                              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Plus className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                                <span className="text-[10px] text-gray-400 group-hover:text-gray-600">
                                  {char.imageUrl?.startsWith("data:") ? "📷 사진 참조로 생성" : "베이스 생성"}
                                </span>
                              </div>
                            )}
                          </button>
                        )}
                        {refs.length < MAX_REFS && hasBase && (
                          <div className="aspect-square rounded-lg border-2 border-dashed border-gray-100 flex items-center justify-center text-gray-300">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* 베이스 이미지 재생성 버튼 */}
                      {hasBase && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[11px] gap-1 border-gray-200"
                          onClick={() => handleGenerateBase(char.id)}
                          disabled={charLoading}
                        >
                          {charLoading && loadingCharId === char.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Sparkles className="w-3 h-3" />
                          }
                          {char.imageUrl?.startsWith("data:") ? "📷 사진 참조로 재생성" : "베이스 재생성"}
                        </Button>
                      )}

                      {/* 변형 버튼들 */}
                      {hasBase && refs.length < MAX_REFS && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-400 px-0.5">변형 추가 (베이스 참조)</p>
                          <div className="grid grid-cols-3 gap-1">
                            {VARIANT_BUTTONS.map(({ type, label, emoji }) => {
                              const loading = loadingVariant === `${char.id}-${type}`
                              return (
                                <button
                                  key={type}
                                  className={cn(
                                    "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 hover:border-gray-200 transition-colors text-center disabled:opacity-50",
                                    loading && "opacity-70"
                                  )}
                                  onClick={() => handleGenerateVariant(char.id, type)}
                                  disabled={charLoading}
                                >
                                  {loading
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                                    : <span className="text-sm leading-none">{emoji}</span>
                                  }
                                  <span className="text-[9px] text-gray-600 font-medium">{label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {refs.length >= MAX_REFS && (
                        <p className="text-[10px] text-center text-gray-400">최대 {MAX_REFS}개 도달</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── 이미지 액션 다이얼로그 ── */}
      <Dialog open={activeRef !== null && dialogMode === "preview"} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-sm bg-white/95 backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">레퍼런스 이미지</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              {activeRef?.index === 0 ? "BASE 이미지" : `변형 ${activeRef?.index}`} — 자세나 외형을 수정할 수 있습니다
            </DialogDescription>
          </DialogHeader>
          {activeRef && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeRef.url}
                alt="Reference"
                className="w-full rounded-xl object-contain max-h-[50vh]"
              />
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setDialogMode("pose")}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  자세/동작 변경
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setDialogMode("edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  부분 수정
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50"
                  onClick={async () => {
                    const { charId, index } = activeRef
                    closeDialog()
                    await handleDeleteRef(charId, index)
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                  삭제
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 자세/동작 변경 다이얼로그 */}
      <Dialog open={activeRef !== null && dialogMode === "pose"} onOpenChange={(open) => { if (!open) setDialogMode("preview") }}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">자세 / 동작 변경</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              레퍼런스 이미지의 외형을 유지하면서 자세나 동작을 변경합니다
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            {activeRef && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeRef.url} alt="Reference" className="w-full max-h-40 object-contain rounded-lg bg-gray-50" />
            )}
            <Textarea
              value={posePrompt}
              onChange={(e) => setPosePrompt(e.target.value)}
              placeholder="예: 웃으면서 팔짱을 낀 자세, 뒤를 돌아보는 자세, 앉아서 책을 읽는 자세..."
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDialogMode("preview")} disabled={isActionLoading}>취소</Button>
              <Button
                size="sm"
                disabled={!posePrompt.trim() || isActionLoading}
                onClick={handlePoseChange}
                className="gap-1.5 bg-black hover:bg-gray-800 text-white"
              >
                {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                변경하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 부분 수정 (인페인팅) 다이얼로그 */}
      <Dialog open={activeRef !== null && dialogMode === "edit"} onOpenChange={(open) => { if (!open) setDialogMode("preview") }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col pt-6 bg-white/95 backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">부분 수정 (Canvas Inpainting)</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              수정하고 싶은 부분에 형광색 브러시를 칠해주세요. 이 영역만 AI가 다시 그립니다.
            </DialogDescription>
          </DialogHeader>
          {activeRef && (
            <div className="flex-1 overflow-hidden min-h-[350px] mt-2 border rounded-xl bg-gray-50 shadow-inner">
              <MaskCanvas
                imageUrl={activeRef.url}
                onCancel={() => setDialogMode("preview")}
                onSave={handleEditSave}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
