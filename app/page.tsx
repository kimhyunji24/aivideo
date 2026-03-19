import { Suspense } from "react"
import MainWorkflowPage from "./_pages/main-workflow-page"

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainWorkflowPage />
    </Suspense>
  )
}
