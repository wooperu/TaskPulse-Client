export interface AdminTeam {
    id: string;
    name: string;
    description: string;
    managerId: string | null;
    memberCount: number;
    createdAt: string;
}

export interface AdminTeamDraft {
    name: string;
    description: string;
    managerId: string | null;
}