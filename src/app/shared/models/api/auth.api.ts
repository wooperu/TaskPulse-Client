/**
 * Wire shapes of the TaskPulse API for authentication and the current user.
 * They mirror the backend DTOs (camelCase over JSON) and are separate from the
 * UI models, which services map to. Enums arrive as strings.
 */

/** Backend global role (Domain Role enum). */
export type ApiUserRole = 'Admin' | 'Manager' | 'Employee';

/** TokenDto: answer of login and refresh. */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
}

/** UserDto: answer of register, get-user and update-profile. */
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: ApiUserRole;
  isEmailVerified: boolean;
}

/** The `{ message }` object returned by verify-email, resend-verification, forgot-password and reset-password. */
export interface MessageResponse {
  message: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of refresh and logout. */
export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
  currentPassword: string;
}

/** Body of PUT /api/users/{userId}/role (admin only). Answer: 204 No Content. */
export interface ChangeRoleRequest {
  newRole: ApiUserRole;
}
