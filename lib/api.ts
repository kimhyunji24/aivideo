import { PlanningTagsResponse, ProjectState } from "./types"

const API_BASE = "http://localhost:8080/api/v1/sessions"

export async function createSession(): Promise<string> {
    const res = await fetch(API_BASE, { method: "POST" })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to create session: " + res.status + " " + errBody);
    }
    return res.text()
}

export async function getSession(sessionId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}`)
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to get session: " + res.status + " " + errBody);
    }
    return res.json()
}

export async function updateSession(sessionId: string, state: ProjectState): Promise<void> {
    const res = await fetch(`${API_BASE}/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
    })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to update session: " + res.status + " " + errBody);
    }
}

export async function generateLogline(sessionId: string, idea: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}/planning/logline`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: idea,
    })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to generate logline: " + res.status + " " + errBody);
    }
    return res.json()
}

export async function generateCharacters(sessionId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}/planning/characters`, {
        method: "POST"
    })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to generate characters: " + res.status + " " + errBody);
    }
    return res.json()
}

export async function generatePlot(sessionId: string, stageCount: number, userPrompt?: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/${sessionId}/planning/plot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageCount, userPrompt: userPrompt || "" })
    })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to generate plot: " + res.status + " " + errBody);
    }
    return res.json()
}

export async function generatePlanningTags(sessionId: string, logline?: string): Promise<PlanningTagsResponse> {
    const res = await fetch(`${API_BASE}/${sessionId}/planning/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logline: logline || "" }),
    })
    if (!res.ok) {
        const errBody = await res.text().catch(()=>"");
        throw new Error("Failed to generate planning tags: " + res.status + " " + errBody);
    }
    return res.json()
}
