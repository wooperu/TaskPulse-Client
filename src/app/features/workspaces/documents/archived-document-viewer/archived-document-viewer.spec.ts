import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { WorkspaceDocument } from '../../../../shared/models/workspace-document.model';
import { ArchivedDocumentViewer, PREVIEW_LOAD_TIMEOUT_MS } from './archived-document-viewer';

const FILE_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';
const DOCUMENT: WorkspaceDocument = {
  id: 'local',
  workspaceId: 'workspace-a',
  title: 'Notes',
  googleDocumentId: FILE_ID,
  sourceType: 'manual-link',
  addedAt: '2026-11-06T00:00:00.000Z',
};

describe('ArchivedDocumentViewer', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ArchivedDocumentViewer] }).compileComponents();
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function create(document = DOCUMENT) {
    const fixture = TestBed.createComponent(ArchivedDocumentViewer);
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('requests a preview with restricted iframe capabilities and no editable URL or controls', () => {
    const { page } = create();
    const iframe = page.querySelector('iframe')!;
    expect(iframe.src).toBe(`https://docs.google.com/document/d/${FILE_ID}/preview`);
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(page.querySelector('a')).toBeNull();
    expect(page.querySelector('select')).toBeNull();
    expect(page.textContent).toContain('Document details');
  });

  it('does not claim content loaded successfully based only on a cross-origin load event', () => {
    const { fixture, page } = create();
    page.querySelector('iframe')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(page.textContent).toContain('If the document is blank');
    expect(page.textContent).not.toContain('Preview loaded successfully');
  });

  it('unmounts on a reported frame error and retains details', () => {
    const { fixture, page } = create();
    page.querySelector('iframe')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('could not be loaded');
    expect(page.textContent).toContain('Document details');
  });

  it('unmounts a timed-out preview and permits an explicit retry', () => {
    const { fixture, page } = create();
    const firstFrame = page.querySelector('iframe');
    vi.advanceTimersByTime(PREVIEW_LOAD_TIMEOUT_MS);
    fixture.detectChanges();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('did not respond in time');
    page.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(page.querySelector('iframe')).not.toBeNull();
    expect(page.querySelector('iframe')).not.toBe(firstFrame);
  });

  it('lets a user close an unsupported/unsafe preview and remembers details-only for this visit', () => {
    const { fixture, page } = create();
    page.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(page.querySelector('iframe')).toBeNull();
    fixture.componentRef.setInput('document', { ...DOCUMENT, id: 'other', title: 'Other' });
    fixture.detectChanges();
    expect(page.querySelector('iframe')).not.toBeNull();
    fixture.componentRef.setInput('document', DOCUMENT);
    fixture.detectChanges();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('preview is closed');
  });

  it('does not send invalid identifiers to resource URL trust APIs', () => {
    const trust = vi.spyOn(TestBed.inject(DomSanitizer), 'bypassSecurityTrustResourceUrl');
    const { page } = create({ ...DOCUMENT, googleDocumentId: 'https://evil.example/preview' });
    expect(trust).not.toHaveBeenCalled();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('saved file type or identifier');
  });

  it('replaces frames on selection and ignores events from the removed frame', () => {
    const { fixture, page } = create();
    const oldFrame = page.querySelector('iframe')!;
    fixture.componentRef.setInput('document', {
      ...DOCUMENT,
      id: 'other',
      googleDocumentId: 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-',
      title: 'Other',
    });
    fixture.detectChanges();
    const newFrame = page.querySelector('iframe')!;
    expect(newFrame).not.toBe(oldFrame);
    oldFrame.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(page.querySelector('iframe')).toBe(newFrame);
    expect(page.textContent).toContain('Other');
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
