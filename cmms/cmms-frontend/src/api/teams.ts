import { apiFetch } from "./http";

export type TeamMemberDto = {
    personId: string;
    displayName: string;
};

export type TeamDto = {
    id: string;
    name: string;
    description?: string;
    members: TeamMemberDto[];
};

export async function getTeams() {
    return apiFetch<TeamDto[]>("/api/teams");
}
