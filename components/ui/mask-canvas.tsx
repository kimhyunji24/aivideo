"use client"

import React, { useRef, useState, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react"
import { Button } from "@/components/ui/button"
import { Undo, Eraser, Save, X } from "lucide-react"

interface MaskCanvasProps {
  imageUrl: string
  onSave: (maskBase64: string) => void
  onCancel: () => void
}

export function MaskCanvas({ imageUrl, onSave, onCancel }: MaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(30)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  // Load image to get raw dimensions
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous" // in case URLs are cross-origin
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      setIsLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Get exact coordinates accounting for CSS scaling
  const getCoordinates = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return null
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    draw(e)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) ctx.beginPath()
    }
  }

  const draw = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    e.preventDefault()

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const pos = getCoordinates(clientX, clientY)
    if (!pos) return

    ctx.lineWidth = brushSize
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "rgba(0, 255, 0, 1)" // Neon green for visibility

    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const handleClear = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  const handleSave = () => {
    if (!canvasRef.current) return
    const originalCanvas = canvasRef.current
    
    // Create export canvas matching exact size
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = dimensions.width
    exportCanvas.height = dimensions.height
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return

    // Fill background with black
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Draw the user's strokes (which are green) onto this canvas
    ctx.drawImage(originalCanvas, 0, 0)

    // Convert green non-transparent pixels to pure white
    const imageData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      // If it's not pure black (meaning it has our stroke)
      if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) {
        data[i] = 255     // R
        data[i+1] = 255   // G
        data[i+2] = 255   // B
        data[i+3] = 255   // A
      }
    }
    ctx.putImageData(imageData, 0, 0)

    const base64Mask = exportCanvas.toDataURL("image/png")
    onSave(base64Mask)
  }

  return (
    <div className="flex flex-col space-y-4 w-full h-full max-h-[80vh]">
      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">브러시 크기</span>
            <input
              type="range"
              min="10"
              max="150"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-32 accent-black"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2 px-3 text-red-600 hover:text-red-700 hover:bg-red-50">
            <Eraser className="w-4 h-4" />
            지우기
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
            <X className="w-4 h-4" />
            취소
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-2 bg-black hover:bg-gray-800 text-white">
            <Save className="w-4 h-4" />
            마스크 저장
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="relative flex-1 bg-black/5 rounded-xl border border-border overflow-hidden flex items-center justify-center min-h-[400px]"
      >
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            이미지 불러오는 중...
          </div>
        )}
        
        {isLoaded && (
          <div className="relative isolate" style={{ maxWidth: '100%', maxHeight: '100%' }}>
            {/* Base Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imageUrl} 
              alt="Canvas base" 
              className="object-contain pointer-events-none rounded-lg"
              style={{ maxHeight: 'calc(80vh - 100px)' }}
            />
            
            {/* Drawing Canvas */}
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair opacity-50 z-10 rounded-lg"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        이미지 위를 드래그하여 수정할 부분을 형광색으로 칠해주세요.
      </p>
    </div>
  )
}
