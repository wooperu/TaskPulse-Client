import { TestBed } from '@angular/core/testing';
import { WorkspaceDocument } from '../../../../shared/models/workspace-document.model';
import { GoogleDocsEditor } from './google-docs-editor';

const DOCUMENT: WorkspaceDocument = {
  id: 'local-document',
  workspaceId: 'workspace-a',
  title: 'Sprint notes',
  googleDocumentId: 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-',
  sourceType: 'manual-link',
  addedAt: '2026-11-05T00:00:00.000Z',
};

function mockMatchMedia(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('GoogleDocsEditor', () => {
  it('does not mount the iframe on a wide touch-only landscape phone', async () => {
    const matchMedia = vi.fn((query: string) =>
      mockMatchMedia(
        query.includes('any-hover: hover') && query.includes('any-pointer: fine') ? false : true,
      ),
    );
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    await TestBed.configureTestingModule({ imports: [GoogleDocsEditor] }).compileComponents();
    const fixture = TestBed.createComponent(GoogleDocsEditor);
    fixture.componentRef.setInput('document', DOCUMENT);
    fixture.detectChanges();
    expect(matchMedia).toHaveBeenCalledWith(
      '(min-width: 768px) and (any-hover: hover) and (any-pointer: fine)',
    );
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('unmounts on capability/viewport changes and removes its listener on destruction', async () => {
    const query = mockMatchMedia(true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue(query),
    });
    await TestBed.configureTestingModule({ imports: [GoogleDocsEditor] }).compileComponents();
    const fixture = TestBed.createComponent(GoogleDocsEditor);
    fixture.componentRef.setInput('document', DOCUMENT);
    fixture.detectChanges();
    const listener = vi.mocked(query.addEventListener).mock.calls[0][1] as (
      event: MediaQueryListEvent,
    ) => void;
    listener({ matches: false } as MediaQueryListEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    listener({ matches: true } as MediaQueryListEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).not.toBeNull();
    fixture.destroy();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
  it('does not mount the iframe on a phone-sized viewport', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue(mockMatchMedia(false)),
    });
    await TestBed.configureTestingModule({ imports: [GoogleDocsEditor] }).compileComponents();

    const fixture = TestBed.createComponent(GoogleDocsEditor);
    fixture.componentRef.setInput('document', DOCUMENT);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Editing inside TaskPulse requires a desktop or laptop',
    );
  });

  it('mounts the generated Google Docs URL on a desktop viewport', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue(mockMatchMedia(true)),
    });
    await TestBed.configureTestingModule({ imports: [GoogleDocsEditor] }).compileComponents();

    const fixture = TestBed.createComponent(GoogleDocsEditor);
    fixture.componentRef.setInput('document', DOCUMENT);
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toBe(
      `https://docs.google.com/document/d/${DOCUMENT.googleDocumentId}/edit?embedded=true`,
    );
  });
});
