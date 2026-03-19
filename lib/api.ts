import { ProjectState } from "./types"

const API_BASE = "http://localhost:8080/api/v1/sessions"

export async function createSession(): Promise<string> {
    const res = await fetch(API_BASE, { method: "POST" })
    if (!res.ok) throw new Error("Failed to create session")
    return res.text()
}

export async function getSession(sessionId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}`)
    if (!res.ok) throw new Error("Failed to get session")
    return res.json()
}

export async function updateSession(sessionId: string, state: ProjectState): Promise<void> {
    const res = await fetch(`${API_BASE}/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
    })
    if (!res.ok) throw new Error("Failed to update session")
}

export async function generateLogline(sessionId: string, idea: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}/planning/logline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }), // Note: Should match backend. Backend expects raw string or JSON. Let's send raw string for now based on backend @RequestBody String
    })
    if (!res.ok) throw new Error("Failed to generate logline")
    return res.json()
}
