export interface Frame {
    id: string;
    imageUrl?: string;
    script: string;
}

export interface SceneElements {
    mainCharacter: string;
    subCharacter: string;
    action: string;
    pose: string;
    background: string;
    time: string;
    composition: string; // Camera / Composition
    lighting: string;
    mood: string;
    story: string;
    quality?: string;
}

export interface SceneParams {
    seed: number;
    steps: number;
    cfgScale: number;
    sampler: string;
}

export interface Scene {
    id: string | number;
    title: string;
    description: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    duration: number;
    status: "pending" | "generating" | "generating_video" | "completed" | "done" | "error";
    elements: SceneElements;
    params?: SceneParams;
    styleChip?: string;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    lastErrorRetryable?: boolean;
    lastErrorRequestId?: string;
    pinnedAssets?: string[];
    /** Up to 4 frames for the scene's flow */
    frames?: Frame[];
}

export interface Plot {
    id: string;
    title: string;
    summary: string;
    tone: string;
    sceneCount: number;
    scenes: Scene[];
}

export interface Character {
    id: string;
    name: string;
    imageUrl?: string;
    /** 표시용 성별: (남)/(여) */
    gender?: "male" | "female";
    appearance: string;
    personality: string;
    values: string;
    trauma: string;
    /** 캐릭터 레퍼런스 이미지 URL 목록 (최대 10개) */
    referenceImageUrls?: string[];
}

export interface PlotStage {
    id: string;
    label: string;
    content: string;
    elements?: SceneElements;
}

export interface PlotPlan {
    stageCount: 3 | 4 | 5;
    stages: PlotStage[];
}

export interface ProjectState {
    id?: number;
    idea: string;
    logline?: string;
    /** 로그라인 보정을 위한 누적 사용자 문맥 */
    loglineContext?: string;
    /** 플롯 재생성 시 반영할 사용자 지시사항 */
    planningPrompt?: string;
    /** 캐릭터 확정 버튼 클릭 여부 */
    charactersConfirmed?: boolean;
    characters?: Character[];
    plotPlan?: PlotPlan | null;
    generatedPlots: Plot[];
    selectedPlot: Plot | null;
    scenes: Scene[];
    mode?: "beginner" | "advanced";
    backgroundReferenceImageUrl?: string;
    backgroundReferenceDescription?: string;
}

export interface PlanningSeedRequest {
    idea?: string;
    logline?: string;
    userPrompt?: string;
    stageCount?: 3 | 4 | 5;
}

export interface PlanningSeedCharacter {
    id?: string;
    name?: string;
    gender?: "male" | "female" | string;
    appearance?: string;
    personality?: string;
    values?: string;
    trauma?: string;
}

export interface PlanningSeedStage {
    id?: string;
    label?: string;
    content?: string;
    elements?: Partial<SceneElements>;
}

export interface PlanningSeedResponse {
    source?: string;
    characters?: PlanningSeedCharacter[];
    plotPlan?: {
        stageCount?: 3 | 4 | 5 | number;
        stages?: PlanningSeedStage[];
    };
}

