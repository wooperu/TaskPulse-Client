import { Injectable, signal } from '@angular/core';
import { CurrentUser } from '../../shared/models/current-user.model';

/** Sample user only. Replace with the session / get-user call once auth is integrated. */
const MOCK_CURRENT_USER: CurrentUser = {
  id: 'user-me',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex.rivera@example.com',
  role: 'employee',
  isEmailVerified: true,
};

/** Single boundary between the UI and the signed-in user's data (mock-backed for now). */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly userState = signal<CurrentUser>(MOCK_CURRENT_USER);

  readonly user = this.userState.asReadonly();

  /** True while the user comes from the mock above rather than a real session. */
  readonly isSampleData = true;

  /** In-memory only and lost on reload. Replace with PUT update-profile once auth is wired. */
  updateProfile(firstName: string, lastName: string): void {
    this.userState.update((user) => ({
      ...user,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    }));
  }
}