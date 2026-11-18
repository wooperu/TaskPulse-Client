import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from '../services/workspace.service';
import { workspacesReadyGuard } from './workspaces-ready.guard';

function runGuard(ensureLoaded: () => Promise<unknown>) {
  TestBed.configureTestingModule({ providers: [{ provide: WorkspaceService, useValue: { ensureLoaded } }] });

  return TestBed.runInInjectionContext(() =>
    workspacesReadyGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

describe('workspacesReadyGuard', () => {
  it('waits for the workspace list before letting the page open', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const ensureLoaded = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    let opened = false;

    const result = runGuard(ensureLoaded) as Promise<boolean>;
    void result.then(() => (opened = true));
    await Promise.resolve();

    expect(ensureLoaded).toHaveBeenCalledOnce();
    expect(opened).toBe(false);

    finish({ ok: true, value: [] });
    expect(await result).toBe(true);
  });

  it('still opens the page when loading failed, so the page can show its own state', async () => {
    const result = runGuard(() => Promise.resolve({ ok: false, error: { kind: 'server' } })) as Promise<boolean>;

    expect(await result).toBe(true);
  });
});
