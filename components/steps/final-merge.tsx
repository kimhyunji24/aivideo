"use client"

import type { ProjectState } from "@/app/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  Play,
  RefreshCw,
  Check,
  Loader2,
  Music,
  Clock,
  Film,
  Share2,
  RotateCcw,
  Settings,
  Volume2,
} from "lucide-react"
import { useState } from "react"

interface FinalMergeProps {
  project: ProjectState
  setProject: (project: ProjectState) => void
  onBack: () => void
  onRestart: () => void
}

export function FinalMerge({ project, setProject, onBack, onRestart }: FinalMergeProps) {
  const [isMerging, setIsMerging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState(0)
  const [isMerged, setIsMerged] = useState(false)

  // Settings
  const [addMusic, setAddMusic] = useState(true)
  const [musicTrack, setMusicTrack] = useState("epic-orchestral")
  const [musicVolume, setMusicVolume] = useState(70)
  const [transition, setTransition] = useState("crossfade")
  const [outputQuality, setOutputQuality] = useState("1080p")

  const videosReady = project.scenes.filter((s) => s.videoUrl).length
  const totalDuration = project.scenes.reduce((sum, s) => sum + s.duration, 0)

  const handleMerge = async () => {
    setIsMerging(true)
    setMergeProgress(0)

    // Simulate merge progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      setMergeProgress(i)
    }

    setIsMerging(false)
    setIsMerged(true)
  }

  const handleDownload = () => {
    // Simulate download
    alert("Download started! (This is a prototype)")
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Final Merge</h2>
        <p className="text-muted-foreground">
          Combine your video clips into one final video. Add music and transitions.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <Film className="h-6 w-6 text-muted-foreground" />
                {videosReady}
              </div>
              <p className="text-sm text-muted-foreground">Video Clips</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <Clock className="h-6 w-6 text-muted-foreground" />
                {totalDuration}s
              </div>
              <p className="text-sm text-muted-foreground">Total Duration</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                {isMerged ? (
                  <Check className="h-6 w-6 text-green-600" />
                ) : (
                  <Settings className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isMerged ? "Ready!" : "Configure"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scene Timeline Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline Preview</CardTitle>
          <CardDescription>Your scenes in order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {project.scenes.map((scene, index) => (
              <div
                key={scene.id}
                className="flex-shrink-0 w-24 space-y-1"
              >
                <div className="aspect-video bg-muted rounded overflow-hidden">
                  {scene.imageUrl ? (
                    <img
                      src={scene.imageUrl}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Film className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium truncate">{scene.title}</p>
                  <p className="text-xs text-muted-foreground">{scene.duration}s</p>
                </div>
                {index < project.scenes.length - 1 && transition !== "none" && (
                  <Badge variant="outline" className="text-xs w-full justify-center">
                    {transition}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Music Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" />
              Background Music
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="add-music">Add Music</Label>
              <Switch
                id="add-music"
                checked={addMusic}
                onCheckedChange={setAddMusic}
              />
            </div>

            {addMusic && (
              <>
                <div className="space-y-2">
                  <Label>Music Track</Label>
                  <Select value={musicTrack} onValueChange={setMusicTrack}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="epic-orchestral">Epic Orchestral</SelectItem>
                      <SelectItem value="emotional-piano">Emotional Piano</SelectItem>
                      <SelectItem value="upbeat-electronic">Upbeat Electronic</SelectItem>
                      <SelectItem value="ambient-chill">Ambient Chill</SelectItem>
                      <SelectItem value="dramatic-tension">Dramatic Tension</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Volume: {musicVolume}%
                    </Label>
                  </div>
                  <Slider
                    value={[musicVolume]}
                    onValueChange={([v]) => setMusicVolume(v)}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Output Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Output Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Transition Style</Label>
              <Select value={transition} onValueChange={setTransition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crossfade">Crossfade</SelectItem>
                  <SelectItem value="cut">Hard Cut</SelectItem>
                  <SelectItem value="fade-black">Fade to Black</SelectItem>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="none">No Transition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Output Quality</Label>
              <Select value={outputQuality} onValueChange={setOutputQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p HD</SelectItem>
                  <SelectItem value="1080p">1080p Full HD</SelectItem>
                  <SelectItem value="4k">4K Ultra HD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Merge Progress / Actions */}
      <Card>
        <CardContent className="pt-6">
          {isMerging ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Merging video clips...</span>
                </div>
                <span className="text-sm text-muted-foreground">{mergeProgress}%</span>
              </div>
              <Progress value={mergeProgress} className="h-2" />
            </div>
          ) : isMerged ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-6 w-6" />
                <span className="font-medium text-lg">Video Ready!</span>
              </div>

              {/* Video Preview Placeholder */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-muted-foreground/20 flex items-center justify-center mx-auto">
                    <Play className="h-8 w-8 text-muted-foreground ml-1" />
                  </div>
                  <p className="text-sm text-muted-foreground">Click to preview</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" size="lg" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Video
                </Button>
                <Button variant="outline" size="lg">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button className="w-full" size="lg" onClick={handleMerge}>
                <Film className="h-4 w-4 mr-2" />
                Merge & Create Final Video
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back to Videos
        </Button>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Start New Project
        </Button>
      </div>
    </div>
  )
}
