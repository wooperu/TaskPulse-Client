export type UserRole = 'admin' | 'manager' | 'employee';

/**
 * PROVISIONAL shape, modelled on the backend user DTO (id, email, first and
 * last name, role, isEmailVerified) returned by GET /api/users/get-user.
 * Confirm field names before wiring the real call.
 */
export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
}