import { Suspense } from "react"
import SceneEditPage from "./_pages/scene-edit-page"

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SceneEditPage />
    </Suspense>
  )
}
