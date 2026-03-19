import {
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
} from "lucide-react"

export interface Asset {
  id: string
  label: string
  category: "character" | "background" | "style"
  icon: React.ElementType
  description: string
}

export const ASSETS: Asset[] = [
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

export const CATEGORIES = [
  { id: "character", label: "캐릭터" },
  { id: "background", label: "배경" },
  { id: "style", label: "스타일" },
] as const
