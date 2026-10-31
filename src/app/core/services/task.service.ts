import { Injectable, signal } from '@angular/core';
import { Task } from '../../shared/models/task.model';
import { MOCK_CURRENT_USER_ID, MOCK_TASKS } from './mock-tasks';

/**
 * Single boundary between the UI and task data. Components only read from
 * here; later the source changes (API, IndexedDB) without touching them.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly tasksState = signal<readonly Task[]>(MOCK_TASKS);

  /** Tasks across all workspaces. */
  readonly tasks = this.tasksState.asReadonly();

  /** True while data comes from MOCK_TASKS rather than a real source. */
  readonly isSampleData = true;

  /** Stand-in for the signed-in user until the auth session exists. */
  readonly currentUserId = MOCK_CURRENT_USER_ID;

  /** Reads the signal, so calling it inside computed() stays reactive. */
  forWorkspace(workspaceId: string): readonly Task[] {
    return this.tasksState().filter((task) => task.workspaceId === workspaceId);
  }
}