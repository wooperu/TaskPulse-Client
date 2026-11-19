import { describe, expect, it } from 'vitest';
import { TaskDetailsResponse, TaskResponse } from '../../shared/models/api/task.api';
import { isOverdue } from '../../shared/utils/task-rules';
import { parseUtc, toApiPriority, toApiStatus, toComment, toDateKey, toTask, toTaskFromDetails } from './task-mappers';

const ROW: TaskResponse = {
  id: 't-1',
  workspaceId: 'w-1',
  title: 'Review board',
  description: null,
  dueDate: '2026-11-20T12:00:00Z',
  status: 'Pending',
  priority: 'High',
  assignedTo: 'u-2',
  createdBy: 'u-1',
  createdAtUtc: '2026-11-01T09:00:00Z',
};

describe('task mappers', () => {
  it('maps a list row, with no completion time or document', () => {
    expect(toTask(ROW)).toEqual({
      id: 't-1',
      workspaceId: 'w-1',
      title: 'Review board',
      description: '',
      status: 'pending',
      priority: 'high',
      assigneeId: 'u-2',
      dueDate: toDateKey('2026-11-20T12:00:00Z'),
      dueAtUtc: '2026-11-20T12:00:00Z',
      linkedDocument: null,
      createdById: 'u-1',
      createdAt: '2026-11-01T09:00:00Z',
      completedAt: null,
    });
  });

  it('maps every API status, keeping Overdue as its own status', () => {
    expect(toTask({ ...ROW, status: 'Ongoing' }).status).toBe('ongoing');
    expect(toTask({ ...ROW, status: 'Completed' }).status).toBe('completed');
    expect(toTask({ ...ROW, status: 'Overdue' }).status).toBe('overdue');
  });

  it('maps every priority', () => {
    expect(toTask({ ...ROW, priority: 'Low' }).priority).toBe('low');
    expect(toTask({ ...ROW, priority: 'Urgent' }).priority).toBe('urgent');
  });

  it('maps UI statuses back to API statuses', () => {
    expect(toApiStatus('pending')).toBe('Pending');
    expect(toApiStatus('overdue')).toBe('Overdue');
  });

  it('maps UI priorities back to API priorities', () => {
    expect(toApiPriority('urgent')).toBe('Urgent');
    expect(toApiPriority('low')).toBe('Low');
  });

  it('treats a timestamp without a zone as UTC', () => {
    expect(parseUtc('2026-11-20T12:00:00').toISOString()).toBe('2026-11-20T12:00:00.000Z');
    expect(parseUtc('2026-11-20T12:00:00+02:00').toISOString()).toBe('2026-11-20T10:00:00.000Z');
    expect(parseUtc('2026-11-20T12:00:00Z').toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });

  it('maps task details with completion time and linked document', () => {
    const details: TaskDetailsResponse = {
      id: 't-1',
      workspaceId: 'w-1',
      title: 'Review board',
      description: 'Check everything',
      dueDate: '2026-11-20T12:00:00Z',
      status: 'Completed',
      priority: 'Low',
      assignedTo: 'u-2',
      assignedToName: 'Ana Reyes',
      createdBy: 'u-1',
      createdByName: 'Ben Cruz',
      createdAtUtc: '2026-11-01T09:00:00Z',
      completedAtUtc: '2026-11-18T10:00:00Z',
      linkedDocument: { url: 'https://docs.google.com/document/d/abc', label: 'Spec' },
      comments: [],
    };

    expect(toTaskFromDetails(details)).toMatchObject({
      description: 'Check everything',
      status: 'completed',
      completedAt: '2026-11-18T10:00:00Z',
      linkedDocument: { url: 'https://docs.google.com/document/d/abc', label: 'Spec' },
    });
  });

  it('maps a comment, keeping the author name from the API', () => {
    expect(
      toComment('t-1', {
        id: 'c-1',
        authorId: 'u-2',
        authorName: 'Ana Reyes',
        body: 'Looks good',
        createdAtUtc: '2026-11-02T08:00:00Z',
        updatedAtUtc: null,
      }),
    ).toEqual({
      id: 'c-1',
      taskId: 't-1',
      authorId: 'u-2',
      authorName: 'Ana Reyes',
      text: 'Looks good',
      createdAt: '2026-11-02T08:00:00Z',
    });
  });
});

describe('isOverdue', () => {
  const task = toTask(ROW);

  it('is true exactly when the API says the task is overdue', () => {
    expect(isOverdue({ ...task, status: 'overdue' })).toBe(true);
    expect(isOverdue({ ...task, status: 'pending', dueDate: '2000-01-01' })).toBe(false);
  });

  it('keeps the date rule for sample-data pages that pass today', () => {
    expect(isOverdue({ ...task, status: 'ongoing', dueDate: '2026-11-01' }, '2026-11-17')).toBe(true);
    expect(isOverdue({ ...task, status: 'completed', dueDate: '2026-11-01' }, '2026-11-17')).toBe(false);
  });
});
