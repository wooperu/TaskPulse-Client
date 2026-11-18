import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, UserRole } from '../../shared/models/current-user.model';
import { UpdateProfileRequest, UserResponse } from '../../shared/models/api/auth.api';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';

/** Shown while nobody is signed in, so screens that read user() synchronously never get null. */
const SIGNED_OUT_USER: CurrentUser = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  role: 'employee',
  isEmailVerified: false,
};

const ROLES: readonly UserRole[] = ['admin', 'manager', 'employee'];

function toRole(value: string): UserRole {
  const role = value.toLowerCase() as UserRole;

  return ROLES.includes(role) ? role : 'employee';
}

function toCurrentUser(response: UserResponse): CurrentUser {
  return {
    id: response.id,
    firstName: response.firstName,
    lastName: response.lastName,
    email: response.email,
    role: toRole(response.role),
    isEmailVerified: response.isEmailVerified,
  };
}

/** Single boundary between the UI and the signed-in user's data. */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly http = inject(HttpClient);
  private readonly userState = signal<CurrentUser>(SIGNED_OUT_USER);

  readonly user = this.userState.asReadonly();
  readonly isSignedIn = computed(() => this.userState().id !== '');
  readonly isAdmin = computed(() => this.userState().role === 'admin');

  /** Loads the signed-in user from GET /api/users/get-user. Rejects with the HTTP error. */
  async load(): Promise<CurrentUser> {
    const response = await firstValueFrom(this.http.get<UserResponse>(apiUrl('/api/users/get-user')));

    const user = toCurrentUser(response);

    this.userState.set(user);
    return user;
  }

  clear(): void {
    this.userState.set(SIGNED_OUT_USER);
  }

  /**
   * Saves the name with PUT /api/users/update-profile. The signed-in user changes only after the
   * API confirmed it, using the user the API sends back.
   */
  async updateProfile(firstName: string, lastName: string): Promise<ApiResult<CurrentUser>> {
    const body: UpdateProfileRequest = { firstName: firstName.trim(), lastName: lastName.trim() };
    const result = await toApiResult(this.http.put<UserResponse>(apiUrl('/api/users/update-profile'), body));

    if (!result.ok) return result;

    const user = toCurrentUser(result.value);

    this.userState.set(user);
    return { ok: true, value: user };
  }
}
