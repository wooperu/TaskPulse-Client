import { UserRole } from './current-user.model';

export interface AdminUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    isEmailVerified: boolean;
    createdAt: string;
}

export interface AdminUserDraft {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    employee: 'Employee',
};