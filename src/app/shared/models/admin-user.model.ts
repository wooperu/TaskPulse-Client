import { UserRole } from './current-user.model';

/**
 * Sample-data shape still used by Admin Teams and Admin Tasks. Not an API model:
 * the backend has no isActive (no deactivation) and no endpoint that lists users.
 */
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

export const USER_ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    employee: 'Employee',
};