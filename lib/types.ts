export interface SceneElements {
    mainCharacter: string;
    subCharacter: string;
    action: string;
    pose: string;
    background: string;
    time: string;
    composition: string;
    lighting: string;
    mood: string;
    story: string;
}

export interface Scene {
    id: string | number;
    title: string;
    description: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    duration: number;
    status: "pending" | "generating" | "done" | "error";
    elements: SceneElements;
}

export interface Plot {
    id: string;
    title: string;
    summary: string;
    tone: string;
    sceneCount: number;
    scenes: Scene[];
}

export interface ProjectState {
    id?: number;
    idea: string;
    generatedPlots: Plot[];
    selectedPlot: Plot | null;
    scenes: Scene[];
    mode: "beginner" | "advanced";
}
