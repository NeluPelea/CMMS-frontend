import { apiFetch } from "./http";

// AI Chat types
export interface AiChatRequest {
    message: string;
    assetId?: string;
    fromUtc?: string;
    toUtc?: string;
}

export interface AiChatResponse {
    answer: string;
}

export async function chatAi(request: AiChatRequest): Promise<AiChatResponse> {
    return apiFetch<AiChatResponse>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}
