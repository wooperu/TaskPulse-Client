import { UserRole } from './current-user.model';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    employee: 'Employee',
};