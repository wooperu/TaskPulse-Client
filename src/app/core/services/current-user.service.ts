import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, UserRole } from '../../shared/models/current-user.model';
import { apiUrl } from '../config/api.config';

/** Shown while nobody is signed in, so screens that read user() synchronously never get null. */
const SIGNED_OUT_USER: CurrentUser = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  role: 'employee',
  isEmailVerified: false,
};

/** The API's UserDto (camelCase over JSON). Its role arrives as a string such as "Admin". */
interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
}

const ROLES: readonly UserRole[] = ['admin', 'manager', 'employee'];

function toRole(value: string): UserRole {
  const role = value.toLowerCase() as UserRole;

  return ROLES.includes(role) ? role : 'employee';
}

/** Single boundary between the UI and the signed-in user's data. */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly http = inject(HttpClient);
  private readonly userState = signal<CurrentUser>(SIGNED_OUT_USER);

  readonly user = this.userState.asReadonly();
  readonly isSignedIn = computed(() => this.userState().id !== '');
  readonly isAdmin = computed(() => this.userState().role === 'admin');

  /**
   * Still true on purpose: the Account page's profile, email and password forms are not
   * saved to the API yet, and its banner is driven by this flag. Revisit when those are wired.
   */
  readonly isSampleData = true;

  /** Loads the signed-in user from GET /api/users/get-user. Rejects with the HTTP error. */
  async load(): Promise<CurrentUser> {
    const response = await firstValueFrom(this.http.get<UserResponse>(apiUrl('/api/users/get-user')));

    const user: CurrentUser = {
      id: response.id,
      firstName: response.firstName,
      lastName: response.lastName,
      email: response.email,
      role: toRole(response.role),
      isEmailVerified: response.isEmailVerified,
    };

    this.userState.set(user);
    return user;
  }

  clear(): void {
    this.userState.set(SIGNED_OUT_USER);
  }

  /** In-memory only and lost on reload. Replace with PUT /api/users/update-profile later. */
  updateProfile(firstName: string, lastName: string): void {
    this.userState.update((user) => ({
      ...user,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    }));
  }
}
