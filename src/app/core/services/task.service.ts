import { Injectable, signal } from '@angular/core';
import { Task } from '../../shared/models/task.model';
import { MOCK_TASKS } from './mock-tasks';

/**
 * Single boundary between the UI and task data. Components only read from
 * here; later the source changes (API, IndexedDB) without touching them.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly tasksState = signal<readonly Task[]>(MOCK_TASKS);

  readonly tasks = this.tasksState.asReadonly();

  /** True while data comes from MOCK_TASKS rather than a real source. */
  readonly isSampleData = true;
}