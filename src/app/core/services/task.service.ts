import { Injectable, signal } from '@angular/core';
import {
  Task,
  TaskComment,
  TaskDraft,
  TaskStatus,
} from '../../shared/models/task.model';
import { MOCK_COMMENTS, MOCK_CURRENT_USER_ID, MOCK_TASKS } from './mock-tasks';

const MAX_COMMENT_LENGTH = 500;

/**
 * Single boundary between the UI and task data. Components only read from
 * here; later the source changes (API, IndexedDB) without touching them.
 * Everything below mutates in-memory mock state only.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly tasksState = signal<readonly Task[]>(MOCK_TASKS);
  private readonly commentsState = signal<readonly TaskComment[]>(MOCK_COMMENTS);
  private nextMockId = 1;

  /** Tasks across all workspaces. */
  readonly tasks = this.tasksState.asReadonly();

  /** True while data comes from mock files rather than a real source. */
  readonly isSampleData = true;

  /** Stand-in for the signed-in user until the auth session exists. */
  readonly currentUserId = MOCK_CURRENT_USER_ID;

  /** Reads the signal, so calling it inside computed() stays reactive. */
  forWorkspace(workspaceId: string): readonly Task[] {
    return this.tasksState().filter((task) => task.workspaceId === workspaceId);
  }

  getById(taskId: string): Task | undefined {
    return this.tasksState().find((task) => task.id === taskId);
  }

  commentsFor(taskId: string): readonly TaskComment[] {
    return this.commentsState()
      .filter((comment) => comment.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  create(workspaceId: string, draft: TaskDraft): Task {
    const task: Task = {
      ...draft,
      id: `mock-task-${this.nextMockId++}`,
      workspaceId,
      status: 'pending',
      createdById: this.currentUserId,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    this.tasksState.update((list) => [...list, task]);
    return task;
  }

  /** Completed tasks cannot be edited (reopen them first), matching the backend rule. */
  update(taskId: string, draft: TaskDraft): Task | undefined {
    const existing = this.getById(taskId);

    if (!existing || existing.status === 'completed') {
      return undefined;
    }

    const updated: Task = { ...existing, ...draft };
    this.replace(updated);
    return updated;
  }

  /** Pending -> Ongoing. */
  start(taskId: string): boolean {
    return this.transition(taskId, 'pending', 'ongoing');
  }

  /** Ongoing -> Completed. A pending task must be started first, as in the backend. */
  complete(taskId: string): boolean {
    return this.transition(taskId, 'ongoing', 'completed');
  }

  /** Completed -> Pending. */
  reopen(taskId: string): boolean {
    return this.transition(taskId, 'completed', 'pending');
  }

  addComment(taskId: string, text: string): TaskComment | undefined {
    const body = text.trim();

    if (!this.getById(taskId) || !body || body.length > MAX_COMMENT_LENGTH) {
      return undefined;
    }

    const comment: TaskComment = {
      id: `mock-comment-${this.nextMockId++}`,
      taskId,
      authorId: this.currentUserId,
      text: body,
      createdAt: new Date().toISOString(),
    };

    this.commentsState.update((list) => [...list, comment]);
    return comment;
  }

  /** Only the author can delete a comment, as in the backend. */
  deleteComment(taskId: string, commentId: string): boolean {
    const comment = this.commentsState().find(
      (item) => item.id === commentId && item.taskId === taskId,
    );

    if (!comment || comment.authorId !== this.currentUserId) {
      return false;
    }

    this.commentsState.update((list) => list.filter((item) => item.id !== commentId));
    return true;
  }

  private transition(taskId: string, from: TaskStatus, to: TaskStatus): boolean {
    const existing = this.getById(taskId);

    if (!existing || existing.status !== from) {
      return false;
    }

    this.replace({
      ...existing,
      status: to,
      completedAt: to === 'completed' ? new Date().toISOString() : null,
    });
    return true;
  }

  private replace(task: Task): void {
    this.tasksState.update((list) => list.map((item) => (item.id === task.id ? task : item)));
  }
}